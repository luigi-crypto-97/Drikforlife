// Logica di sessione (senza grafica): giri, giri extra, modalità bonus, premi, conversioni.
// Ogni giro viene deciso e SALVATO prima dell'animazione: ricaricare la pagina non
// permette di ripetere un giro né di cambiarne l'esito.

import { OUTCOMES, isPrize, downgrade } from './paytable.js';
import { drawOutcome, buildGrid, pickSpecial } from './engine.js';
import { analyze } from './math.js';
import { PRESETS } from './presets.js';
import {
  capAllows, awardCreate, awardConvert, awardIssue, awardGet, dayAdd, sessionSave,
} from './store.js';

export function gameAnalysis(cfg) {
  const preset = PRESETS[cfg.preset] || PRESETS.bilanciato;
  return analyze(preset, cfg);
}

export function gameAward(session, id) {
  const demo = (session.demoAwards || []).find((a) => a.id === id);
  return demo || awardGet(id);
}

export function gameAwards(session) {
  return session.awards.map((id) => gameAward(session, id)).filter(Boolean);
}

export function gameSpinsLeft(session) { return session.baseSpins + session.bonusSpins; }

// Rigiocate ancora disponibili in questa sessione (limite per non monopolizzare il tablet).
export function gameCanConvert(session, cfg) {
  return !!cfg.conversionEnabled && (session.conversions || 0) < cfg.maxConversionsPerDrink * session.drinks;
}

// Quale passo deve eseguire l'interfaccia adesso.
export function gameNextStep(session) {
  if (!session) return 'idle';
  if (session.pendingDecision) return 'decision';
  if (session.pendingBonusIntro) return 'bonusIntro';
  if (session.mode === 'bonus') return session.bonusSpins > 0 ? 'bonusSpin' : 'bonusOutro';
  if (session.baseSpins > 0) return 'baseSpin';
  return 'end';
}

function gameLimit(drawn, session, cfg, now) {
  let o = drawn;
  const meta = OUTCOMES[o];
  if (meta.kind === 'spins' && session.extraGranted + meta.spins > cfg.maxExtraSpinsPerDrink * session.drinks) o = 'NONE';
  if (o === 'BONUS' || o === 'RETRIG') {
    const amount = o === 'BONUS' ? cfg.bonusSpins : cfg.retriggerSpins;
    if (session.bonusGranted + amount > cfg.maxBonusSpinsPerDrink * session.drinks) o = 'NONE';
  }
  if (!session.demo) {
    while (isPrize(o) && !capAllows(o, now, cfg)) o = downgrade(o);
  }
  return o;
}

export function gameSpin(session, cfg, now) {
  const step = gameNextStep(session);
  if (step !== 'baseSpin' && step !== 'bonusSpin') throw new Error('giro non consentito ora (' + step + ')');
  const s = JSON.parse(JSON.stringify(session));
  const mode = s.mode;
  const preset = PRESETS[cfg.preset] || PRESETS.bilanciato;
  const drawn = drawOutcome(mode === 'base' ? preset.base : preset.bonus);
  const outcome = gameLimit(drawn, s, cfg, now);
  const special = mode === 'bonus' ? s.special : null;
  const { grid, wins } = buildGrid(outcome, mode, special); // può lanciare: in quel caso nulla è consumato

  const result = { drawn, outcome, mode, special, grid, wins, award: null, extra: 0, bonusStart: false, retrigger: 0 };
  if (mode === 'base') s.baseSpins--; else { s.bonusSpins--; s.bonusPlayed++; }
  s.spinsPlayed++;

  const meta = OUTCOMES[outcome];
  if (meta.kind === 'spins') {
    s.baseSpins += meta.spins;
    s.extraGranted += meta.spins;
    result.extra = meta.spins;
  } else if (outcome === 'BONUS') {
    s.bonusSpins += cfg.bonusSpins;
    s.bonusGranted += cfg.bonusSpins;
    s.special = pickSpecial();
    s.bonusTotal = cfg.bonusSpins;
    s.bonusPlayed = 0;
    s.bonusWins = [];
    s.pendingBonusIntro = true;
    result.bonusStart = true;
    result.special = s.special;
  } else if (outcome === 'RETRIG') {
    s.bonusSpins += cfg.retriggerSpins;
    s.bonusGranted += cfg.retriggerSpins;
    s.bonusTotal += cfg.retriggerSpins;
    result.retrigger = cfg.retriggerSpins;
  } else if (isPrize(outcome)) {
    const a = awardCreate(outcome, s.id, now, cfg, s.demo);
    if (s.demo) s.demoAwards.push(a);
    s.awards.push(a.id);
    if (mode === 'bonus') s.bonusWins.push(a.id);
    if (meta.convertible && gameCanConvert(s, cfg)) s.pendingDecision = a.id;
    result.award = a;
  }
  s.lastGrid = grid;
  s.lastMode = mode;
  s.lastSpecial = special;
  sessionSave(s);
  if (!s.demo) dayAdd(now, cfg, mode === 'base' ? { spinsBase: 1 } : { spinsBonus: 1 });
  return { session: s, result };
}

export function gameKeep(session) {
  const s = { ...session, pendingDecision: null };
  sessionSave(s);
  return s;
}

// Rinuncia a un premio convertibile in cambio di Giri Bonus.
export function gameConvert(session, awardId, cfg, now) {
  const s = JSON.parse(JSON.stringify(session));
  if (!s.awards.includes(awardId)) throw new Error('premio non appartenente alla sessione');
  const a = gameAward(s, awardId);
  if (!a || a.status !== 'pending') throw new Error('premio non convertibile');
  if (!OUTCOMES[a.type].convertible || !cfg.conversionEnabled) throw new Error('premio non convertibile');
  if (s.pendingDecision && s.pendingDecision !== awardId) throw new Error('decisione in sospeso su un altro premio');
  if (!gameCanConvert(s, cfg)) throw new Error('limite di rigiocate raggiunto per questa sessione');
  const spins = gameAnalysis(cfg).conversion[a.type].spins;
  if (!(spins > 0)) throw new Error('conversione non disponibile');
  if (s.demo) {
    const d = s.demoAwards.find((x) => x.id === awardId);
    d.status = 'converted';
  } else {
    awardConvert(awardId, now);
  }
  if (s.pendingDecision === awardId) s.pendingDecision = null;
  s.conversions = (s.conversions || 0) + 1;
  s.bonusSpins += spins;
  if (s.mode === 'bonus') {
    s.bonusTotal += spins;
  } else {
    s.special = pickSpecial();
    s.bonusTotal = spins;
    s.bonusPlayed = 0;
    s.bonusWins = [];
    s.pendingBonusIntro = true;
  }
  sessionSave(s);
  if (!s.demo) dayAdd(now, cfg, { conversions: 1 });
  return { session: s, spins };
}

export function gameStartBonus(session) {
  const s = { ...session, pendingBonusIntro: false, mode: 'bonus' };
  sessionSave(s);
  return s;
}

export function gameEndBonus(session) {
  const s = { ...session, mode: 'base', special: null, bonusTotal: 0, bonusPlayed: 0, bonusWins: [] };
  sessionSave(s);
  return s;
}

// Fine sessione: tutti i premi ancora in sospeso diventano buoni validi.
export function gameFinish(session, cfg, now) {
  const out = [];
  for (const id of session.awards) {
    const a = gameAward(session, id);
    if (!a || a.status !== 'pending') continue;
    if (session.demo) {
      out.push({ ...a, status: 'issued', expiresOpDay: null });
    } else {
      out.push(awardIssue(id, now, cfg));
    }
  }
  return out;
}
