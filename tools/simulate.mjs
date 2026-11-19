// Simulazione Monte Carlo con la VERA logica di sessione (sessioni demo, senza tetti).
// Uso: node tools/simulate.mjs [drink=200000] [profilo=bilanciato] [rigioca=0..1]
import { gameSpin, gameKeep, gameConvert, gameStartBonus, gameEndBonus, gameNextStep, gameAwards, gameAnalysis } from '../src/js/game.js';
import { storeSetBackend, DEFAULT_CONFIG, sessionNew } from '../src/js/store.js';
import { OUTCOMES, PRIZES } from '../src/js/paytable.js';

const N = Number(process.argv[2] || 200000);
const cfg = { ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), preset: process.argv[3] || 'bilanciato' };
const convertProb = Number(process.argv[4] || 0);
const mem = new Map();
storeSetBackend({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) });

const a = gameAnalysis(cfg);
const count = Object.fromEntries(PRIZES.map((p) => [p, 0]));
let value = 0, spins = 0, maxSpins = 0, bonusSessions = 0;
const now = new Date();
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  let s = sessionNew(1, cfg, true);
  let hadBonus = false;
  for (;;) {
    const st = gameNextStep(s);
    if (st === 'end') break;
    if (st === 'decision') s = Math.random() < convertProb ? gameConvert(s, s.pendingDecision, cfg, now).session : gameKeep(s);
    else if (st === 'bonusIntro') { s = gameStartBonus(s); hadBonus = true; }
    else if (st === 'bonusOutro') s = gameEndBonus(s);
    else s = gameSpin(s, cfg, now).session;
  }
  spins += s.spinsPlayed;
  maxSpins = Math.max(maxSpins, s.spinsPlayed);
  if (hadBonus) bonusSessions++;
  for (const aw of gameAwards(s)) if (aw.status !== 'converted') { count[aw.type]++; value += OUTCOMES[aw.type].value; }
}
const pct = (x) => (x * 100).toFixed(3) + '%';
console.log(`Profilo ${cfg.preset} · ${N.toLocaleString('it-IT')} drink simulati in ${((Date.now() - t0) / 1000).toFixed(1)} s · rigioca ${convertProb}`);
console.log('Costo premi / prezzo drink: simulato ' + pct(value / N) + ' · teorico (senza rigioca) ' + pct(a.sessionValue));
console.log('Giri medi per drink ' + (spins / N).toFixed(2) + ' · massimo in una sessione ' + maxSpins + ' · sessioni con bonus 1 su ' + (N / Math.max(1, bonusSessions)).toFixed(1));
for (const p of PRIZES) {
  const exp = a.perDrink[p] * N;
  console.log(OUTCOMES[p].label.padEnd(14) + ' simulati ' + String(count[p]).padStart(7) + ' · attesi ' + exp.toFixed(1).padStart(9));
}
