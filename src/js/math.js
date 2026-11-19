// Calcolo analitico ESATTO del costo atteso dei premi e delle frequenze.
// Tutti i valori sono in "D" = prezzo medio di un drink al listino.

import { OUTCOMES, PRIZES } from './paytable.js';

export const WEIGHT_TOTAL = 100000000; // pesi espressi su 100 milioni

export function weightsToProbs(weights) {
  const p = {};
  let sum = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (!Number.isInteger(w) || w < 0) throw new RangeError('peso non valido per ' + k);
    p[k] = w / WEIGHT_TOTAL;
    sum += w;
  }
  if (sum > WEIGHT_TOTAL) throw new RangeError('somma dei pesi oltre il 100%');
  p.NONE = (WEIGHT_TOTAL - sum) / WEIGHT_TOTAL;
  return p;
}

// Quanti Giri Bonus si ottengono rinunciando a un premio convertibile.
// eta = quota massima del valore restituita in valore atteso (es. 0,75 = il bar trattiene il 25%).
export function conversionSpins(prizeValue, vf, eta) {
  if (!(vf > 0) || !(eta > 0)) return 0;
  const raw = Math.floor((eta * prizeValue) / vf + 1e-9);
  if (raw >= 10) return Math.floor(raw / 5) * 5;
  return raw;
}

// preset: { base: pesi giro normale, bonus: pesi giro bonus }
// cfg: { spinsPerDrink, bonusSpins, retriggerSpins, conversionEta }
export function analyze(preset, cfg) {
  const S = cfg.spinsPerDrink;
  const B = cfg.bonusSpins;
  const R = cfg.retriggerSpins;
  const pb = weightsToProbs(preset.base);
  const pf = weightsToProbs(preset.bonus);
  const g = (p, k) => p[k] || 0;

  const rf = g(pf, 'RETRIG') * R;
  if (rf >= 1) throw new RangeError('ritrigger troppo frequente: la modalità bonus non terminerebbe');
  const eb = g(pb, 'X1') * 1 + g(pb, 'X2') * 2 + g(pb, 'X3') * 3;
  if (eb >= 1) throw new RangeError('giri extra troppo frequenti: la sessione non terminerebbe');

  let af = 0, ab = 0;
  for (const o of PRIZES) {
    af += g(pf, o) * OUTCOMES[o].value;
    ab += g(pb, o) * OUTCOMES[o].value;
  }
  const vf = af / (1 - rf); // valore atteso di un giro bonus (incluse le riattivazioni)
  const vb = (ab + g(pb, 'BONUS') * B * vf) / (1 - eb); // valore atteso di un giro normale
  const sessionValue = S * vb; // valore atteso dei premi per drink venduto (in D)

  const nb = S / (1 - eb); // giri normali attesi per drink
  const nf = nb * g(pb, 'BONUS') * B / (1 - rf); // giri bonus attesi per drink
  const perDrink = {};
  for (const o of PRIZES) perDrink[o] = nb * g(pb, o) + nf * g(pf, o);
  const bonusPerDrink = nb * g(pb, 'BONUS');

  const eta = cfg.conversionEta;
  const conversion = {};
  for (const o of PRIZES) {
    if (!OUTCOMES[o].convertible) continue;
    const spins = conversionSpins(OUTCOMES[o].value, vf, eta);
    conversion[o] = { spins, evRatio: spins * vf / OUTCOMES[o].value };
  }

  let hitRateBase = 0;
  for (const [k, v] of Object.entries(pb)) if (k !== 'NONE') hitRateBase += v;

  return {
    pb, pf, vb, vf, sessionValue, costPct: sessionValue * 100,
    baseSpinsPerDrink: nb, bonusSpinsPerDrink: nf, bonusPerDrink,
    perDrink, conversion, hitRateBase,
    featureValue: B * vf,
  };
}

// Costo massimo annuo garantito dai tetti (in D), utile per cauzione / montepremi.
export function maxPrizeValueFromCaps(caps) {
  // caps: { P10: {day, month, year}, ... } -> limite annuo più stringente
  let total = 0;
  const detail = {};
  for (const o of PRIZES) {
    const c = caps[o] || {};
    const lims = [];
    if (c.day > 0) lims.push(c.day * 366);
    if (c.month > 0) lims.push(c.month * 12);
    if (c.year > 0) lims.push(c.year);
    const n = lims.length ? Math.min(...lims) : Infinity;
    detail[o] = n;
    total += n * OUTCOMES[o].value;
  }
  return { perYear: detail, totalD: total };
}
