import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  gameSpin, gameKeep, gameConvert, gameStartBonus, gameEndBonus, gameFinish, gameNextStep, gameAnalysis, gameAwards,
} from '../src/js/game.js';
import {
  storeSetBackend, DEFAULT_CONFIG, sessionNew, sessionLoad, capCounts, capAllows, awardCreate, redeem, redeemCheck,
  codeIsWellFormed, formatCode, ledgerAll, ledgerPrune, statsSummary, setPins, checkPin, opDay, addDays,
} from '../src/js/store.js';
import { PRESETS } from '../src/js/presets.js';
import { WEIGHT_TOTAL } from '../src/js/math.js';
import { OUTCOMES } from '../src/js/paytable.js';

function memBackend() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

const NOW = new Date('2026-11-19T21:00:00');
let cfg;
beforeEach(() => {
  storeSetBackend(memBackend());
  cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
});

// Gioca una sessione completa con una strategia per le decisioni.
function playSession(session, decide, now = NOW) {
  let s = session;
  let guard = 0;
  for (;;) {
    if (++guard > 100000) throw new Error('sessione infinita');
    const step = gameNextStep(s);
    if (step === 'decision') {
      s = decide(s) ? gameConvert(s, s.pendingDecision, cfg, now).session : gameKeep(s);
    } else if (step === 'bonusIntro') s = gameStartBonus(s);
    else if (step === 'bonusOutro') s = gameEndBonus(s);
    else if (step === 'baseSpin' || step === 'bonusSpin') {
      const r = gameSpin(s, cfg, now);
      assert.deepEqual(sessionLoad(), r.session, 'la sessione deve essere salvata prima dell\'animazione');
      s = r.session;
    } else if (step === 'end') return s;
    else throw new Error('passo inatteso ' + step);
  }
}

test('Monte Carlo: costo reale per drink coerente con il calcolo analitico (100.000 drink)', () => {
  const a = gameAnalysis(cfg);
  const N = 100000;
  let value = 0;
  const count = { P10: 0, P20: 0, DRINK: 0, C10: 0, C100: 0 };
  for (let i = 0; i < N; i++) {
    const s = playSession(sessionNew(1, cfg, true), () => false);
    for (const aw of gameAwards(s)) { value += OUTCOMES[aw.type].value; count[aw.type]++; }
  }
  const perDrink = value / N;
  // tolleranza dominata dalla varianza dei premi grandi: confronto sui premi piccoli
  const small = (count.P10 * 0.1 + count.P20 * 0.2 + count.DRINK * 1) / N;
  const smallExp = a.perDrink.P10 * 0.1 + a.perDrink.P20 * 0.2 + a.perDrink.DRINK * 1;
  assert.ok(Math.abs(small - smallExp) / smallExp < 0.04, 'piccoli ' + small + ' vs ' + smallExp);
  for (const p of ['P10', 'P20', 'DRINK']) {
    const exp = a.perDrink[p] * N;
    assert.ok(Math.abs(count[p] - exp) < 5 * Math.sqrt(exp), p + ' ' + count[p] + ' vs ' + exp);
  }
  assert.ok(perDrink < 0.08, 'costo osservato ' + perDrink);
});

test('conversione: rinunciare ai premi riduce il costo atteso', () => {
  const N = 30000;
  let keep = 0, conv = 0;
  for (let i = 0; i < N; i++) {
    for (const aw of gameAwards(playSession(sessionNew(1, cfg, true), () => false))) {
      if (aw.status !== 'converted' && aw.type !== 'C10' && aw.type !== 'C100') keep += OUTCOMES[aw.type].value;
    }
    for (const aw of gameAwards(playSession(sessionNew(1, cfg, true), () => true))) {
      if (aw.status !== 'converted' && aw.type !== 'C10' && aw.type !== 'C100') conv += OUTCOMES[aw.type].value;
    }
  }
  assert.ok(conv < keep, 'conv ' + conv + ' keep ' + keep);
});

test('tetti: premio esaurito scende al premio inferiore e la griglia lo rispecchia', () => {
  PRESETS.__test = { base: { DRINK: WEIGHT_TOTAL }, bonus: { DRINK: WEIGHT_TOTAL } };
  cfg.preset = '__test';
  cfg.caps.DRINK = { day: 2, month: 0, year: 0 };
  cfg.caps.P20 = { day: 1, month: 0, year: 0 };
  cfg.caps.P10 = { day: 1, month: 0, year: 0 };
  let s = sessionNew(1, cfg, false);
  const got = [];
  for (let i = 0; i < 6; i++) {
    const r = gameSpin(s, cfg, NOW);
    got.push(r.result.outcome);
    if (r.result.outcome !== 'NONE') assert.equal(r.result.wins[0].outcome, r.result.outcome);
    else assert.equal(r.result.wins.length, 0);
    s = r.session.pendingDecision ? gameKeep(r.session) : r.session;
  }
  assert.deepEqual(got, ['DRINK', 'DRINK', 'P20', 'P10', 'NONE', 'NONE']);
  assert.equal(capCounts('DRINK', NOW, cfg).day, 2);
  assert.equal(capAllows('DRINK', NOW, cfg), false);
  // nuova giornata operativa: tetto giornaliero di nuovo disponibile
  const tomorrow = new Date(NOW.getTime() + 24 * 3600000);
  assert.equal(capAllows('DRINK', tomorrow, cfg), true);
  delete PRESETS.__test;
});

test('tetti: un premio convertito libera il posto nel tetto', () => {
  cfg.caps.DRINK = { day: 1, month: 0, year: 0 };
  let s = sessionNew(1, cfg, false);
  const a = awardCreate('DRINK', s.id, NOW, cfg, false);
  s = { ...s, awards: [a.id], pendingDecision: a.id };
  assert.equal(capAllows('DRINK', NOW, cfg), false);
  const r = gameConvert(s, a.id, cfg, NOW);
  assert.ok(r.spins > 0);
  assert.equal(r.session.pendingBonusIntro, true);
  assert.equal(r.session.bonusSpins, r.spins);
  assert.equal(capAllows('DRINK', NOW, cfg), true);
});

test('rigioca: limite di rigiocate per drink', () => {
  let s = sessionNew(1, cfg, true);
  for (let i = 0; i < cfg.maxConversionsPerDrink; i++) {
    const a = awardCreate('P10', s.id, NOW, cfg, true);
    s = { ...s, demoAwards: [...s.demoAwards, a], awards: [...s.awards, a.id], pendingBonusIntro: false, mode: 'base' };
    s = gameConvert(s, a.id, cfg, NOW).session;
  }
  const extra = awardCreate('P10', s.id, NOW, cfg, true);
  s = { ...s, demoAwards: [...s.demoAwards, extra], awards: [...s.awards, extra.id] };
  assert.throws(() => gameConvert(s, extra.id, cfg, NOW), /limite/);
});

test('giornata operativa: le 2 di notte appartengono al giorno precedente', () => {
  assert.equal(opDay(new Date('2026-11-20T02:00:00'), 6), '2026-11-19');
  assert.equal(opDay(new Date('2026-11-20T07:00:00'), 6), '2026-11-20');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});

test('sessione: limiti su giri extra e giri bonus per drink', () => {
  PRESETS.__x = { base: { X3: WEIGHT_TOTAL }, bonus: {} };
  cfg.preset = '__x';
  const s = playSession(sessionNew(1, cfg, true), () => false);
  assert.equal(s.extraGranted, 15);
  assert.equal(s.spinsPlayed, 10 + 15);
  PRESETS.__b = { base: { BONUS: WEIGHT_TOTAL }, bonus: { RETRIG: 9000000 } };
  cfg.preset = '__b';
  const s2 = playSession(sessionNew(1, cfg, true), () => false);
  assert.ok(s2.bonusGranted <= cfg.maxBonusSpinsPerDrink);
  delete PRESETS.__x; delete PRESETS.__b;
});

test('fine sessione: buoni emessi, verificabili e riscattabili una sola volta', () => {
  let s = sessionNew(1, cfg, false);
  const a1 = awardCreate('P10', s.id, NOW, cfg, false);
  const a2 = awardCreate('C10', s.id, NOW, cfg, false);
  s = { ...s, awards: [a1.id, a2.id], baseSpins: 0 };
  assert.equal(gameNextStep(s), 'end');
  assert.equal(redeemCheck(a1.code, NOW, cfg).ok, false, 'non riscattabile prima della chiusura');
  const issued = gameFinish(s, cfg, NOW);
  assert.equal(issued.length, 2);
  assert.ok(codeIsWellFormed(formatCode(a1.code)));
  assert.equal(issued[0].expiresOpDay, addDays('2026-11-19', 30));
  assert.equal(redeem(formatCode(a1.code).toLowerCase(), 1, NOW, cfg).ok, true);
  assert.equal(redeem(a1.code, 1, NOW, cfg).ok, false, 'secondo utilizzo rifiutato');
  // tessera 10 cocktail: max 2 al giorno
  assert.equal(redeem(a2.code, 3, NOW, cfg).ok, false);
  assert.equal(redeem(a2.code, 2, NOW, cfg).ok, true);
  assert.equal(redeem(a2.code, 1, NOW, cfg).ok, false);
  const tomorrow = new Date(NOW.getTime() + 24 * 3600000);
  assert.equal(redeem(a2.code, 2, tomorrow, cfg).ok, true);
  // scadenza
  const later = new Date(NOW.getTime() + 400 * 24 * 3600000);
  assert.match(redeemCheck(a2.code, later, cfg).reason, /scaduto/);
  // codice con un carattere sbagliato
  const bad = a1.code.slice(0, 3) + (a1.code[3] === 'A' ? 'B' : 'A') + a1.code.slice(4);
  assert.equal(codeIsWellFormed(bad), false);
});

test('statistiche e pulizia registro', () => {
  let s = sessionNew(1, cfg, false);
  const a = awardCreate('DRINK', s.id, NOW, cfg, false);
  s = { ...s, awards: [a.id], baseSpins: 0 };
  gameFinish(s, cfg, NOW);
  redeem(a.code, 1, NOW, cfg);
  const st = statsSummary('2026-11');
  assert.equal(st.prizes.DRINK.won, 1);
  assert.equal(st.redeemedD, 1);
  assert.equal(ledgerAll().length, 1);
  assert.equal(ledgerPrune(new Date(NOW.getTime() + 30 * 86400000), cfg), 0);
  assert.equal(ledgerPrune(new Date(NOW.getTime() + 61 * 86400000), cfg), 1);
  assert.equal(statsSummary('2026-11').prizes.DRINK.won, 1, 'le statistiche restano dopo la pulizia');
});

test('PIN: ruoli e blocco dopo 5 tentativi', () => {
  const c = setPins(cfg, '1234', '987654');
  assert.equal(checkPin(c, '1234', NOW).role, 'staff');
  assert.equal(checkPin(c, '987654', NOW).role, 'manager');
  for (let i = 0; i < 4; i++) assert.equal(checkPin(c, '0000', NOW).locked, false);
  assert.equal(checkPin(c, '0000', NOW).locked, true);
  assert.equal(checkPin(c, '1234', NOW).role, null, 'bloccato anche con PIN giusto');
  assert.equal(checkPin(c, '1234', new Date(NOW.getTime() + 61000)).role, 'staff');
});
