// Persistenza locale (localStorage del tablet): configurazione, registro premi/buoni,
// sessione di gioco in corso, statistiche giornaliere.

import { randInt } from './rng.js';
import { OUTCOMES, PRIZES } from './paytable.js';
import { sha256Hex } from './sha256.js';

const STORE_KEYS = {
  config: 'gdm.config.v1',
  ledger: 'gdm.ledger.v1',
  session: 'gdm.session.v1',
  days: 'gdm.days.v1',
  prefs: 'gdm.prefs.v1',
  security: 'gdm.security.v1',
};

export const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  barName: 'Drink for Life',
  avgDrinkPrice: 10,
  foodCostPct: 25,
  preset: 'bilanciato',
  spinsPerDrink: 10,
  bonusSpins: 10,
  retriggerSpins: 10,
  conversionEnabled: true,
  conversionEta: 0.75,
  opDayStartHour: 6,
  maxExtraSpinsPerDrink: 15,
  maxBonusSpinsPerDrink: 40,
  maxConversionsPerDrink: 3,
  maxDrinksPerLoad: 10,
  caps: {
    P10: { day: 60, month: 0, year: 0 },
    P20: { day: 25, month: 0, year: 0 },
    DRINK: { day: 8, month: 150, year: 0 },
    C10: { day: 1, month: 2, year: 12 },
    C100: { day: 1, month: 1, year: 1 },
  },
  validityDays: { P10: 30, P20: 30, DRINK: 30, C10: 365, C100: 730 },
  cardMaxPerDay: { C10: 2, C100: 2 },
  staffPinHash: null,
  managerPinHash: null,
  pinSalt: null,
});

// ---------- backend ----------
const storeMem = new Map();
let storeBackend = null;
let storeHealthy = true;

function storeGetBackend() {
  if (storeBackend) return storeBackend;
  try {
    if (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage) {
      const t = '__gdm_test__';
      globalThis.localStorage.setItem(t, '1');
      globalThis.localStorage.removeItem(t);
      storeBackend = globalThis.localStorage;
      return storeBackend;
    }
  } catch (e) { /* storage bloccato */ }
  storeHealthy = false;
  storeBackend = {
    getItem: (k) => (storeMem.has(k) ? storeMem.get(k) : null),
    setItem: (k, v) => { storeMem.set(k, String(v)); },
    removeItem: (k) => { storeMem.delete(k); },
  };
  return storeBackend;
}

export function storeSetBackend(b) { storeBackend = b; storeHealthy = true; ledgerCache = null; daysCache = null; }
export function storeIsPersistent() { storeGetBackend(); return storeHealthy; }

function storeRead(key, fallback) {
  try {
    const s = storeGetBackend().getItem(key);
    if (s == null) return fallback;
    return JSON.parse(s);
  } catch (e) {
    return fallback;
  }
}

function storeWrite(key, value) {
  try {
    storeGetBackend().setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    storeHealthy = false;
    return false;
  }
}

function storeClone(o) { return JSON.parse(JSON.stringify(o)); }

// ---------- date / giornata operativa ----------
function pad2(n) { return String(n).padStart(2, '0'); }

// Il bar chiude dopo mezzanotte: la "giornata" inizia alle opDayStartHour.
export function opDay(date, startHour) {
  const d = new Date(date.getTime() - (startHour || 0) * 3600000);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function addDays(dayStr, n) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate());
}

export function formatDay(dayStr) {
  const [y, m, d] = dayStr.split('-');
  return d + '/' + m + '/' + y;
}

// ---------- configurazione ----------
function mergeConfig(saved) {
  const base = storeClone(DEFAULT_CONFIG);
  if (!saved || typeof saved !== 'object') return base;
  const out = { ...base, ...saved };
  for (const k of ['caps', 'validityDays', 'cardMaxPerDay']) {
    out[k] = { ...base[k] };
    for (const p of Object.keys(base[k])) {
      if (saved[k] && saved[k][p] != null) {
        out[k][p] = typeof base[k][p] === 'object' ? { ...base[k][p], ...saved[k][p] } : saved[k][p];
      }
    }
  }
  return out;
}

export function loadConfig() { return mergeConfig(storeRead(STORE_KEYS.config, null)); }
export function saveConfig(cfg) { return storeWrite(STORE_KEYS.config, mergeConfig(cfg)); }

export function prefsLoad() {
  return { sound: true, volume: 0.7, turbo: false, ...storeRead(STORE_KEYS.prefs, {}) };
}
export function prefsSave(p) { storeWrite(STORE_KEYS.prefs, p); }

// ---------- PIN ----------
function newSalt() {
  let s = '';
  for (let i = 0; i < 16; i++) s += randInt(16).toString(16);
  return s;
}

export function pinHash(salt, pin) { return sha256Hex(salt + ':' + pin); }

export function setPins(cfg, staffPin, managerPin) {
  const c = { ...cfg };
  c.pinSalt = c.pinSalt || newSalt();
  if (staffPin != null) c.staffPinHash = pinHash(c.pinSalt, staffPin);
  if (managerPin != null) c.managerPinHash = pinHash(c.pinSalt, managerPin);
  return c;
}

export function isConfigured(cfg) { return !!(cfg.staffPinHash && cfg.managerPinHash && cfg.pinSalt); }

const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 60000;

export function pinLockRemaining(now) {
  const sec = storeRead(STORE_KEYS.security, { fails: 0, lockUntil: 0 });
  return Math.max(0, (sec.lockUntil || 0) - now.getTime());
}

// Restituisce 'manager' | 'staff' | null, con blocco dopo 5 tentativi errati.
export function checkPin(cfg, pin, now) {
  const sec = storeRead(STORE_KEYS.security, { fails: 0, lockUntil: 0 });
  if ((sec.lockUntil || 0) > now.getTime()) return { role: null, locked: true };
  const h = pinHash(cfg.pinSalt || '', pin);
  let role = null;
  if (h === cfg.managerPinHash) role = 'manager';
  else if (h === cfg.staffPinHash) role = 'staff';
  if (role) {
    storeWrite(STORE_KEYS.security, { fails: 0, lockUntil: 0 });
    return { role, locked: false };
  }
  const fails = (sec.fails || 0) + 1;
  const lockUntil = fails >= PIN_MAX_FAILS ? now.getTime() + PIN_LOCK_MS : 0;
  storeWrite(STORE_KEYS.security, { fails: fails >= PIN_MAX_FAILS ? 0 : fails, lockUntil });
  return { role: null, locked: lockUntil > 0 };
}

// ---------- codici buono ----------
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 simboli, niente 0/O/1/I

function codeCheckChar(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += (2 * i + 1) * CODE_ALPHABET.indexOf(body[i]);
  return CODE_ALPHABET[sum % 32];
}

export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function codeIsWellFormed(input) {
  const c = normalizeCode(input);
  if (c.length !== 8) return false;
  for (const ch of c) if (!CODE_ALPHABET.includes(ch)) return false;
  return codeCheckChar(c.slice(0, 7)) === c[7];
}

export function formatCode(c) { return c.slice(0, 4) + '-' + c.slice(4); }

function newCode(existing) {
  for (;;) {
    let body = '';
    for (let i = 0; i < 7; i++) body += CODE_ALPHABET[randInt(32)];
    const c = body + codeCheckChar(body);
    if (!existing.has(c)) return c;
  }
}

function newId(prefix) {
  let s = prefix + Date.now().toString(36);
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randInt(32)].toLowerCase();
  return s;
}

// ---------- registro premi ----------
// Il registro contiene i buoni "vivi" e quelli chiusi da meno di LEDGER_KEEP_DAYS giorni.
// I conteggi per i tetti e le statistiche stanno nei contatori giornalieri (compatti),
// così la memoria del tablet non si riempie anche dopo anni di utilizzo.
const LEDGER_KEEP_DAYS = 60;
let ledgerCache = null;
let daysCache = null;

export function ledgerAll() {
  if (!ledgerCache) ledgerCache = storeRead(STORE_KEYS.ledger, []);
  return ledgerCache;
}
function ledgerSave(list) { ledgerCache = list; return storeWrite(STORE_KEYS.ledger, list); }

export function storeResetCache() { ledgerCache = null; daysCache = null; }

// Conteggio premi assegnati (esclusi quelli convertiti in Giri Bonus).
export function capCounts(type, now, cfg) {
  const today = opDay(now, cfg.opDayStartHour);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const c = { day: 0, month: 0, year: 0 };
  for (const [k, d] of Object.entries(daysAll())) {
    if (!k.startsWith(year)) continue;
    const n = ((d.won && d.won[type]) || 0) - ((d.conv && d.conv[type]) || 0);
    c.year += n;
    if (k.startsWith(month)) c.month += n;
    if (k === today) c.day += n;
  }
  return c;
}

export function capAllows(type, now, cfg) {
  const cap = cfg.caps[type];
  if (!cap) return true;
  const c = capCounts(type, now, cfg);
  if (cap.day > 0 && c.day >= cap.day) return false;
  if (cap.month > 0 && c.month >= cap.month) return false;
  if (cap.year > 0 && c.year >= cap.year) return false;
  return true;
}

function awardStatusNow(a, now, cfg) {
  if (a.status === 'issued' && a.expiresOpDay && opDay(now, cfg.opDayStartHour) > a.expiresOpDay) return 'expired';
  return a.status;
}

export function awardView(a, now, cfg) {
  return { ...a, status: awardStatusNow(a, now, cfg) };
}

// Crea un premio "in sospeso" (appartiene alla sessione finché non viene ritirato o convertito).
export function awardCreate(type, sessionId, now, cfg, demo) {
  if (!PRIZES.includes(type)) throw new Error('tipo premio non valido');
  const list = demo ? [] : ledgerAll();
  const codes = new Set(list.map((a) => a.code));
  const meta = OUTCOMES[type];
  const a = {
    id: newId('a'),
    code: newCode(codes),
    type,
    status: 'pending',
    demo: !!demo,
    sessionId,
    createdAt: now.toISOString(),
    opDay: opDay(now, cfg.opDayStartHour),
    uses: meta.card ? meta.uses : 1,
    used: 0,
    redemptions: [],
  };
  if (!demo) {
    if (!ledgerSave([...list, a])) {
      ledgerCache = null;
      throw new Error('memoria del tablet piena o non disponibile');
    }
    dayAddPrize(a.opDay, 'won', type, 1);
  }
  return a;
}

function ledgerUpdate(id, fn) {
  const list = ledgerAll().slice();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return null;
  list[i] = fn({ ...list[i] }) || list[i];
  ledgerSave(list);
  return list[i];
}

export function awardGet(id) { return ledgerAll().find((a) => a.id === id) || null; }

export function awardConvert(id, now) {
  let changed = false;
  const res = ledgerUpdate(id, (a) => {
    if (a.status !== 'pending') return a;
    a.status = 'converted';
    a.convertedAt = now.toISOString();
    changed = true;
    return a;
  });
  if (changed) dayAddPrize(res.opDay, 'conv', res.type, 1);
  return res;
}

export function awardIssue(id, now, cfg) {
  return ledgerUpdate(id, (a) => {
    if (a.status !== 'pending') return a;
    const today = opDay(now, cfg.opDayStartHour);
    a.status = 'issued';
    a.issuedAt = now.toISOString();
    a.expiresOpDay = addDays(today, cfg.validityDays[a.type] || 30);
    return a;
  });
}

export function awardVoid(id, now, note) {
  return ledgerUpdate(id, (a) => {
    if (a.status === 'redeemed' || a.status === 'converted') return a;
    a.status = 'void';
    a.voidedAt = now.toISOString();
    a.note = note || '';
    return a;
  });
}

export function awardFindByCode(input) {
  const c = normalizeCode(input);
  return ledgerAll().find((a) => a.code === c) || null;
}

export function cardUsedToday(a, now, cfg) {
  const today = opDay(now, cfg.opDayStartHour);
  return (a.redemptions || []).filter((r) => r.opDay === today).reduce((s, r) => s + r.qty, 0);
}

// Verifica senza modificare. Restituisce { ok, reason, award, maxQty }
export function redeemCheck(input, now, cfg) {
  if (!codeIsWellFormed(input)) return { ok: false, reason: 'Codice non valido: controlla di averlo digitato correttamente.' };
  const a = awardFindByCode(input);
  if (!a) return { ok: false, reason: 'Codice inesistente in questo tablet.' };
  const status = awardStatusNow(a, now, cfg);
  const view = { ...a, status };
  if (status === 'pending') return { ok: false, reason: 'Premio non ancora ritirato: chiudi prima la sessione di gioco.', award: view };
  if (status === 'converted') return { ok: false, reason: 'Premio convertito in Giri Bonus: non è più valido.', award: view };
  if (status === 'void') return { ok: false, reason: 'Buono annullato.', award: view };
  if (status === 'expired') return { ok: false, reason: 'Buono scaduto il ' + formatDay(a.expiresOpDay) + '.', award: view };
  if (status === 'redeemed') return { ok: false, reason: 'Buono già utilizzato.', award: view };
  const left = a.uses - a.used;
  let maxQty = left;
  if (OUTCOMES[a.type].card) {
    const perDay = cfg.cardMaxPerDay[a.type] || left;
    maxQty = Math.min(left, perDay - cardUsedToday(a, now, cfg));
    if (maxQty <= 0) return { ok: false, reason: 'Limite giornaliero della tessera già raggiunto (' + perDay + ' al giorno).', award: view };
  }
  return { ok: true, award: view, maxQty };
}

export function redeem(input, qty, now, cfg) {
  const chk = redeemCheck(input, now, cfg);
  if (!chk.ok) return chk;
  const q = Math.floor(qty);
  if (!(q >= 1 && q <= chk.maxQty)) return { ok: false, reason: 'Quantità non valida (massimo ' + chk.maxQty + ').', award: chk.award };
  const updated = ledgerUpdate(chk.award.id, (a) => {
    a.used += q;
    a.redemptions = [...(a.redemptions || []), { at: now.toISOString(), opDay: opDay(now, cfg.opDayStartHour), qty: q }];
    if (a.used >= a.uses) a.status = 'redeemed';
    return a;
  });
  dayAddPrize(opDay(now, cfg.opDayStartHour), 'red', updated.type, q);
  return { ok: true, award: updated, qty: q };
}

// ---------- statistiche giornaliere ----------
export function daysAll() {
  if (!daysCache) daysCache = storeRead(STORE_KEYS.days, {});
  return daysCache;
}

function dayGet(days, k) {
  return days[k] || { drinks: 0, sessions: 0, spinsBase: 0, spinsBonus: 0, conversions: 0, won: {}, conv: {}, red: {} };
}

export function dayAdd(now, cfg, patch) {
  const days = { ...daysAll() };
  const k = opDay(now, cfg.opDayStartHour);
  const d = { ...dayGet(days, k) };
  for (const [f, v] of Object.entries(patch)) d[f] = (d[f] || 0) + v;
  days[k] = d;
  daysCache = days;
  storeWrite(STORE_KEYS.days, days);
}

function dayAddPrize(k, field, type, n) {
  const days = { ...daysAll() };
  const d = { ...dayGet(days, k) };
  d[field] = { ...(d[field] || {}) };
  d[field][type] = (d[field][type] || 0) + n;
  days[k] = d;
  daysCache = days;
  storeWrite(STORE_KEYS.days, days);
}

// Rimuove dal registro i buoni chiusi (usati, convertiti, annullati, scaduti) da oltre 60 giorni.
export function ledgerPrune(now, cfg) {
  const limit = addDays(opDay(now, cfg.opDayStartHour), -LEDGER_KEEP_DAYS);
  const list = ledgerAll();
  const keep = list.filter((a) => {
    if (a.status === 'pending') return true;
    if (a.status === 'issued') return !(a.expiresOpDay && a.expiresOpDay < limit);
    const closed = (a.redemptions && a.redemptions.length ? a.redemptions[a.redemptions.length - 1].opDay : null) || a.opDay;
    return closed >= limit;
  });
  if (keep.length !== list.length) ledgerSave(keep);
  return list.length - keep.length;
}

// Riepilogo per un intervallo di giornate (prefisso 'YYYY-MM-DD', 'YYYY-MM', 'YYYY' o '').
export function statsSummary(prefix) {
  const tot = { drinks: 0, sessions: 0, spinsBase: 0, spinsBonus: 0, conversions: 0 };
  const prizes = {};
  for (const p of PRIZES) prizes[p] = { won: 0, redeemedUses: 0 };
  let valueD = 0;
  let redeemedD = 0;
  for (const [k, d] of Object.entries(daysAll())) {
    if (!k.startsWith(prefix)) continue;
    for (const f of Object.keys(tot)) tot[f] += d[f] || 0;
    for (const p of PRIZES) {
      const won = ((d.won && d.won[p]) || 0) - ((d.conv && d.conv[p]) || 0);
      const red = (d.red && d.red[p]) || 0;
      prizes[p].won += won;
      prizes[p].redeemedUses += red;
      valueD += won * OUTCOMES[p].value;
      redeemedD += red * (OUTCOMES[p].value / (OUTCOMES[p].uses || 1));
    }
  }
  const pct = tot.drinks > 0 ? (valueD / tot.drinks) * 100 : 0;
  return { ...tot, prizes, valueD, redeemedD, pct };
}

// ---------- sessione ----------
export function sessionLoad() { return storeRead(STORE_KEYS.session, null); }
export function sessionSave(s) {
  if (!storeWrite(STORE_KEYS.session, s)) throw new Error('impossibile salvare la sessione');
}
export function sessionClear() { try { storeGetBackend().removeItem(STORE_KEYS.session); } catch (e) { /* */ } }

export function sessionNew(drinks, cfg, demo) {
  return {
    id: newId('s'),
    demo: !!demo,
    startedAt: new Date().toISOString(),
    drinks,
    baseSpins: drinks * cfg.spinsPerDrink,
    bonusSpins: 0,
    mode: 'base',
    special: null,
    bonusPlayed: 0,
    bonusTotal: 0,
    bonusWins: [],
    pendingBonusIntro: false,
    pendingBonusOutro: false,
    pendingDecision: null,
    awards: [],
    demoAwards: [],
    extraGranted: 0,
    bonusGranted: 0,
    conversions: 0,
    spinsPlayed: 0,
    lastGrid: null,
  };
}

// ---------- backup ----------
export function exportBackup() {
  return {
    app: 'grimorio-del-mixologist',
    exportedAt: new Date().toISOString(),
    config: loadConfig(),
    ledger: ledgerAll(),
    days: daysAll(),
  };
}

export function importBackup(data) {
  if (!data || data.app !== 'grimorio-del-mixologist' || !Array.isArray(data.ledger)) {
    throw new Error('File di backup non riconosciuto');
  }
  saveConfig(data.config || {});
  ledgerSave(data.ledger);
  storeWrite(STORE_KEYS.days, data.days || {});
  storeResetCache();
}

export function ledgerCsv(now, cfg) {
  const head = ['codice', 'premio', 'stato', 'giornata', 'creato', 'scadenza', 'usi_totali', 'usi_fatti', 'sessione'];
  const rows = ledgerAll().map((a0) => {
    const a = awardView(a0, now, cfg);
    return [formatCode(a.code), OUTCOMES[a.type].label, a.status, a.opDay, a.createdAt,
      a.expiresOpDay || '', a.uses, a.used, a.sessionId];
  });
  return [head, ...rows].map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(';')).join('\n');
}
