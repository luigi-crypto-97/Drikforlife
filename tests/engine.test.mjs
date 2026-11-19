import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, buildGrid, winsMatch, drawOutcome, gridIsValid } from '../src/js/engine.js';
import { SYM, WILD, SPECIAL_CANDIDATES, OUTCOMES } from '../src/js/paytable.js';
import { WEIGHT_TOTAL } from '../src/js/math.js';
import { PRESETS } from '../src/js/presets.js';
import { sha256Hex } from '../src/js/sha256.js';
import { randInt, randDistinct } from '../src/js/rng.js';

const { LIME: L, ARANCIA: A, CILIEGIA: C, GHIACCIO: G, SHAKER: SH, COPPA: CO, ELISIR: E, MAESTRO: M } = SYM;
const W = WILD;

// griglia scritta per righe (più leggibile) -> grid[rullo][riga]
function rows(r0, r1, r2) {
  return [0, 1, 2, 3, 4].map((r) => [r0[r], r1[r], r2[r]]);
}

test('sha256: vettori di riferimento', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('a'.repeat(1000)), '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
});

test('rng: randInt uniforme e nei limiti', () => {
  const n = 7, N = 140000;
  const c = Array(n).fill(0);
  for (let i = 0; i < N; i++) c[randInt(n)]++;
  for (const x of c) assert.ok(Math.abs(x - N / n) < 5 * Math.sqrt(N / n), 'conteggio ' + x);
  assert.throws(() => randInt(0));
  assert.deepEqual(randDistinct(5, 5).sort(), [0, 1, 2, 3, 4]);
});

test('evaluate: griglia senza vincite', () => {
  const g = rows([L, A, C, G, L], [SH, CO, E, M, SH], [A, L, G, C, A]);
  assert.deepEqual(evaluate(g, 'base', null), []);
});

test('evaluate: 3 Shaker sulla linea centrale = Sconto 10%', () => {
  const g = rows([L, A, C, G, L], [SH, SH, SH, M, CO], [A, L, G, C, A]);
  const w = evaluate(g, 'base', null);
  assert.equal(w.length, 1);
  assert.equal(w[0].outcome, 'P10');
  assert.equal(w[0].line, 0);
  assert.equal(w[0].count, 3);
});

test('evaluate: il Grimorio sostituisce i simboli sulle linee', () => {
  const g = rows([L, A, C, G, L], [W, CO, CO, CO, A], [A, L, G, C, A]);
  const w = evaluate(g, 'base', null);
  assert.equal(w.length, 1);
  assert.equal(w[0].outcome, 'P20');
  assert.equal(w[0].count, 4);
});

test('evaluate: 5 Maestro = 100 Cocktail, 4 Elisir = Drink', () => {
  const g = rows([M, M, M, M, M], [L, A, C, G, A], [E, E, E, E, L]);
  const w = evaluate(g, 'base', null).map((x) => x.outcome).sort();
  assert.deepEqual(w, ['C100', 'DRINK']);
});

test('evaluate: 3 Grimori ovunque = Giri Bonus (in bonus = riattivazione)', () => {
  // rulli 1 e 2 con 6 simboli tutti diversi: nessuna linea può formarsi
  const g = rows([L, G, W, A, C], [A, SH, E, W, G], [C, CO, M, L, W]);
  assert.deepEqual(evaluate(g, 'base', null).map((x) => x.outcome), ['BONUS']);
  assert.deepEqual(evaluate(g, 'bonus', SH).map((x) => x.outcome), ['RETRIG']);
});

test('evaluate: Simbolo Speciale su rulli non adiacenti si espande', () => {
  const g = rows([C, L, G, A, C], [SH, M, E, CO, SH], [A, G, C, L, E]);
  // speciale = Ciliegia, presente sui rulli 0, 2, 3? no: rullo 0 (C), rullo 2 (C in basso), rullo 4 (C in alto)
  const w = evaluate(g, 'bonus', C);
  assert.equal(w.length, 1);
  assert.equal(w[0].kind, 'expand');
  assert.equal(w[0].outcome, 'P10');
  assert.deepEqual(w[0].reels, [0, 2, 4]);
});

test('buildGrid: ogni griglia generata produce esattamente l\'esito estratto', () => {
  const baseOutcomes = ['NONE', 'X1', 'X2', 'X3', 'BONUS', 'P10', 'P20', 'DRINK', 'C10', 'C100'];
  for (const o of baseOutcomes) {
    for (let i = 0; i < 3000; i++) {
      const { grid, wins } = buildGrid(o, 'base', null);
      assert.ok(gridIsValid(grid));
      const again = evaluate(grid, 'base', null);
      assert.ok(winsMatch(again, o, 'base'), 'base ' + o + ' ' + JSON.stringify(grid));
      assert.deepEqual(again, wins);
      const books = grid.flat().filter((s) => s === WILD).length;
      if (o !== 'BONUS') assert.ok(books < 3);
    }
  }
  const bonusOutcomes = ['NONE', 'RETRIG', 'P10', 'P20', 'DRINK', 'C10', 'C100'];
  for (const sp of SPECIAL_CANDIDATES) {
    for (const o of bonusOutcomes) {
      for (let i = 0; i < 600; i++) {
        const { grid } = buildGrid(o, 'bonus', sp);
        assert.ok(gridIsValid(grid));
        assert.ok(winsMatch(evaluate(grid, 'bonus', sp), o, 'bonus'), 'bonus ' + o + ' sp ' + sp);
      }
    }
  }
});

test('drawOutcome: frequenze coerenti con i pesi (2 milioni di estrazioni)', () => {
  const w = PRESETS.bilanciato.base;
  const N = 2000000;
  const c = {};
  for (let i = 0; i < N; i++) { const o = drawOutcome(w); c[o] = (c[o] || 0) + 1; }
  let sum = 0;
  for (const [k, v] of Object.entries(w)) {
    sum += v;
    const p = v / WEIGHT_TOTAL;
    const exp = N * p;
    const sd = Math.sqrt(N * p * (1 - p));
    assert.ok(Math.abs((c[k] || 0) - exp) <= 5 * sd + 1, k + ': ' + c[k] + ' atteso ' + exp);
  }
  const pn = 1 - sum / WEIGHT_TOTAL;
  assert.ok(Math.abs(c.NONE - N * pn) <= 5 * Math.sqrt(N * pn * (1 - pn)));
  for (const k of Object.keys(c)) assert.ok(k in OUTCOMES);
});
