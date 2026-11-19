// Motore di gioco.
// 1) si estrae l'ESITO del giro dalla tabella delle probabilità (crypto RNG);
// 2) si applicano i tetti (premio non disponibile -> premio inferiore);
// 3) si costruisce una griglia 5x3 che, valutata con le regole pubbliche,
//    produce esattamente quell'esito e nient'altro.
// La valutazione della griglia è quindi sempre coerente con la tabella vincite mostrata.

import { randInt, pickWeightedIndex, randDistinct } from './rng.js';
import {
  WILD, REELS, ROWS, LINES, PAY, EXPAND_PAY, OUTCOMES, LINE_REPS,
  FILLER_WEIGHTS, SPECIAL_CANDIDATES, NUM_SYMBOLS,
} from './paytable.js';
import { WEIGHT_TOTAL } from './math.js';

export const ENGINE_MAX_ATTEMPTS = 20000;

// ---------- estrazione esito ----------
export function drawOutcome(weights) {
  const keys = Object.keys(weights);
  const ws = keys.map((k) => weights[k]);
  const sum = ws.reduce((a, b) => a + b, 0);
  if (sum > WEIGHT_TOTAL) throw new RangeError('pesi oltre il totale');
  keys.push('NONE');
  ws.push(WEIGHT_TOTAL - sum);
  return keys[pickWeightedIndex(ws)];
}

export function pickSpecial() {
  return SPECIAL_CANDIDATES[randInt(SPECIAL_CANDIDATES.length)];
}

// ---------- valutazione ----------
export function evaluate(grid, mode, special) {
  const wins = [];
  const books = [];
  for (let r = 0; r < REELS; r++) {
    for (let row = 0; row < ROWS; row++) if (grid[r][row] === WILD) books.push([r, row]);
  }
  if (books.length >= 3) {
    wins.push({ kind: 'scatter', outcome: mode === 'bonus' ? 'RETRIG' : 'BONUS', cells: books, count: books.length });
  }
  for (let li = 0; li < LINES.length; li++) {
    const line = LINES[li];
    let base = -1;
    for (let r = 0; r < REELS; r++) {
      const s = grid[r][line[r]];
      if (s !== WILD) { base = s; break; }
    }
    if (base < 0) continue; // linea di soli Grimori: paga solo come scatter
    let n = 0;
    while (n < REELS) {
      const s = grid[n][line[n]];
      if (s === base || s === WILD) n++; else break;
    }
    if (n >= 3) {
      const cells = [];
      for (let r = 0; r < n; r++) cells.push([r, line[r]]);
      wins.push({ kind: 'line', outcome: PAY[base][n], line: li, symbol: base, count: n, cells });
    }
  }
  if (mode === 'bonus' && special != null) {
    const reels = [];
    const cells = [];
    for (let r = 0; r < REELS; r++) {
      let has = false;
      for (let row = 0; row < ROWS; row++) {
        if (grid[r][row] === special) { has = true; cells.push([r, row]); }
      }
      if (has) reels.push(r);
    }
    if (reels.length >= 3) {
      wins.push({ kind: 'expand', outcome: EXPAND_PAY[reels.length], symbol: special, reels, cells, count: reels.length });
    }
  }
  return wins;
}

// La griglia è accettabile solo se produce esattamente l'esito estratto.
export function winsMatch(wins, outcome, mode) {
  if (outcome === 'NONE') return wins.length === 0;
  if (wins.length !== 1) return false;
  const w = wins[0];
  if (w.outcome !== outcome) return false;
  if (mode === 'bonus' && (outcome === 'P10' || outcome === 'P20' || outcome === 'DRINK')) return w.kind === 'expand';
  if (outcome === 'BONUS' || outcome === 'RETRIG') return w.kind === 'scatter';
  return w.kind === 'line';
}

// ---------- costruzione griglia ----------
function engFiller(excluded) {
  const ws = FILLER_WEIGHTS.map((w, i) => (excluded && excluded.includes(i) ? 0 : w));
  return pickWeightedIndex(ws);
}

function engEmpty() {
  return Array.from({ length: REELS }, () => Array(ROWS).fill(-1));
}

function engFill(grid, excluded) {
  for (let r = 0; r < REELS; r++) {
    for (let row = 0; row < ROWS; row++) if (grid[r][row] < 0) grid[r][row] = engFiller(excluded);
  }
  return grid;
}

function engPropose(outcome, mode, special) {
  const meta = OUTCOMES[outcome];
  if (outcome === 'NONE') return engFill(engEmpty(), null);

  if (outcome === 'BONUS' || outcome === 'RETRIG') {
    const roll = randInt(100);
    const k = roll < 85 ? 3 : roll < 98 ? 4 : 5;
    const g = engEmpty();
    for (const r of randDistinct(REELS, k)) g[r][randInt(ROWS)] = WILD;
    return engFill(g, [WILD]);
  }

  if (mode === 'bonus' && (outcome === 'P10' || outcome === 'P20' || outcome === 'DRINK')) {
    const n = Number(Object.keys(EXPAND_PAY).find((c) => EXPAND_PAY[c] === outcome));
    const g = engEmpty();
    for (const r of randDistinct(REELS, n)) g[r][randInt(ROWS)] = special;
    return engFill(g, [special]);
  }

  // vincita su linea
  const reps = LINE_REPS[outcome];
  if (!reps) throw new Error('nessuna rappresentazione per ' + outcome);
  const [sym, n] = reps[randInt(reps.length)];
  const line = LINES[randInt(LINES.length)];
  const g = engEmpty();
  for (let r = 0; r < n; r++) g[r][line[r]] = sym;
  const smallWin = meta.kind === 'spins' || (meta.tier && meta.tier <= 3);
  if (smallWin && n <= 4 && randInt(4) === 0) {
    const pos = randInt(n);
    g[pos][line[pos]] = WILD;
  }
  if (n < REELS) g[n][line[n]] = engFiller([sym, WILD]);
  const excl = mode === 'bonus' && special != null ? [special] : null;
  return engFill(g, excl);
}

export function buildGrid(outcome, mode, special) {
  if (!(outcome in OUTCOMES)) throw new Error('esito sconosciuto ' + outcome);
  if (mode === 'bonus' && special == null) throw new Error('simbolo speciale mancante');
  for (let attempt = 0; attempt < ENGINE_MAX_ATTEMPTS; attempt++) {
    const grid = engPropose(outcome, mode, special);
    const wins = evaluate(grid, mode, special);
    if (winsMatch(wins, outcome, mode)) return { grid, wins, attempts: attempt + 1 };
  }
  throw new Error('impossibile costruire la griglia per ' + outcome);
}

export function randomGrid() {
  return engFill(engEmpty(), [WILD]);
}

export function gridIsValid(grid) {
  if (!Array.isArray(grid) || grid.length !== REELS) return false;
  return grid.every((col) => Array.isArray(col) && col.length === ROWS &&
    col.every((s) => Number.isInteger(s) && s >= 0 && s < NUM_SYMBOLS));
}
