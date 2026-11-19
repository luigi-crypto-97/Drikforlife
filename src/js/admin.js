// Area barista (PIN) e area gestore (PIN gestore): attivazione giri, riscatto buoni,
// statistiche, registro, impostazioni, probabilità, backup.

import { OUTCOMES, PRIZES } from './paytable.js';
import { maxPrizeValueFromCaps, analyze } from './math.js';
import { PRESETS, PRESET_KEYS } from './presets.js';
import { h, openOverlay, askPin, toast, downloadText, euro, oneIn, choose } from './ui.js';
import {
  checkPin, pinLockRemaining, pinHash, setPins, saveConfig, loadConfig, sessionNew, sessionSave, sessionClear,
  dayAdd, redeemCheck, redeem, formatCode, formatDay, opDay, statsSummary, ledgerAll, awardView, awardVoid,
  exportBackup, importBackup, ledgerCsv, storeIsPersistent, normalizeCode,
} from './store.js';
import { gameFinish, gameAwards, gameSpinsLeft } from './game.js';

const STATUS_IT = { pending: 'in gioco', issued: 'valido', redeemed: 'usato', converted: 'rigiocato', void: 'annullato', expired: 'scaduto' };

// ---------------------------------------------------------------- setup iniziale
export function runSetup(api) {
  return new Promise((resolve) => {
    const cfg = api.cfg;
    const f = {
      bar: h('input', { type: 'text', value: cfg.barName, maxlength: '40' }),
      price: h('input', { type: 'number', value: String(cfg.avgDrinkPrice), min: '1', step: '0.5', inputmode: 'decimal' }),
      staff: h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: '4-6 cifre' }),
      staff2: h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'ripeti' }),
      man: h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: '6-8 cifre' }),
      man2: h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'ripeti' }),
      adult: h('input', { type: 'checkbox' }),
    };
    const err = h('p', { class: 'form-err' });
    const content = h('div', { class: 'admin setup' },
      h('h2', null, 'Configurazione iniziale'),
      h('p', null, 'Imposta il nome del locale e i due PIN. Il PIN barista attiva i giri e riscatta i buoni; il PIN gestore accede anche a statistiche, impostazioni e backup.'),
      h('div', { class: 'form-grid' },
        h('label', null, 'Nome del locale', f.bar),
        h('label', null, 'Prezzo medio di un drink (€)', f.price),
        h('label', null, 'PIN barista', f.staff), h('label', null, 'Conferma PIN barista', f.staff2),
        h('label', null, 'PIN gestore', f.man), h('label', null, 'Conferma PIN gestore', f.man2),
      ),
      h('label', { class: 'check' }, f.adult, ' Attiverò i giri solo a clienti maggiorenni (il gioco è collegato all\'acquisto di bevande).'),
      err,
    );
    const save = h('button', { class: 'btn gold', type: 'button' }, 'SALVA E INIZIA');
    content.appendChild(h('div', { class: 'actions' }, save));
    const o = openOverlay(content, { panelCls: 'panel-admin' });
    save.addEventListener('click', () => {
      const name = f.bar.value.trim();
      const price = Number(f.price.value);
      const sp = f.staff.value, mp = f.man.value;
      if (!name) return (err.textContent = 'Inserisci il nome del locale.');
      if (!(price > 0)) return (err.textContent = 'Prezzo medio non valido.');
      if (!/^\d{4,6}$/.test(sp)) return (err.textContent = 'Il PIN barista deve avere da 4 a 6 cifre.');
      if (sp !== f.staff2.value) return (err.textContent = 'I due PIN barista non coincidono.');
      if (!/^\d{6,8}$/.test(mp)) return (err.textContent = 'Il PIN gestore deve avere da 6 a 8 cifre.');
      if (mp !== f.man2.value) return (err.textContent = 'I due PIN gestore non coincidono.');
      if (sp === mp) return (err.textContent = 'I due PIN devono essere diversi.');
      if (!f.adult.checked) return (err.textContent = 'Conferma l\'impegno sui clienti maggiorenni.');
      let c = { ...api.cfg, barName: name, avgDrinkPrice: price };
      c = setPins(c, sp, mp);
      if (!saveConfig(c)) return (err.textContent = 'Impossibile salvare: memoria del browser non disponibile.');
      api.setCfg(loadConfig());
      o.close();
      toast('Configurazione salvata');
      resolve();
    });
  });
}

// ---------------------------------------------------------------- accesso
export async function openStaff(api) {
  const now = new Date();
  const lock = pinLockRemaining(now);
  if (lock > 0) { toast('Troppi tentativi errati: riprova tra ' + Math.ceil(lock / 1000) + ' secondi.'); return; }
  const pin = await askPin('Area barista', { min: 4, max: 8 });
  if (pin == null) { api.advance(); return; }
  const res = checkPin(api.cfg, pin, new Date());
  if (!res.role) {
    toast(res.locked ? 'PIN errato. Accesso bloccato per 60 secondi.' : 'PIN errato.');
    api.advance();
    return;
  }
  staffPanel(api, res.role);
}

function staffPanel(api, role) {
  const body = h('div', { class: 'admin' });
  const o = openOverlay(body, { panelCls: 'panel-admin' });
  const close = () => { o.close(); api.advance(); };
  const render = () => {
    body.textContent = '';
    const cfg = api.cfg;
    const s = api.session;
    const today = statsSummary(opDay(new Date(), cfg.opDayStartHour));
    body.appendChild(h('div', { class: 'admin-head' },
      h('h2', null, role === 'manager' ? 'Area Gestore' : 'Area Barista'),
      h('div', { class: 'admin-kpi' }, 'Oggi: ' + today.drinks + ' drink · ' + Object.values(today.prizes).reduce((a, p) => a + p.won, 0) + ' premi'),
    ));

    // --- attiva giri
    let drinks = 1;
    const qty = h('span', { class: 'qty' }, '1');
    const eq = h('span', { class: 'eq' });
    const upd = () => { qty.textContent = String(drinks); eq.textContent = '= ' + drinks * cfg.spinsPerDrink + ' giri'; };
    upd();
    const activate = h('button', { class: 'btn gold', type: 'button' }, 'ATTIVA GIRI');
    body.appendChild(h('section', { class: 'card' },
      h('h3', null, 'Attiva giri per un cliente'),
      h('div', { class: 'stepper' },
        h('button', { class: 'btn round', type: 'button', onclick: () => { drinks = Math.max(1, drinks - 1); upd(); } }, '−'),
        h('div', { class: 'stepper-val' }, qty, h('small', null, ' drink'), eq),
        h('button', { class: 'btn round', type: 'button', onclick: () => { drinks = Math.min(cfg.maxDrinksPerLoad, drinks + 1); upd(); } }, '+'),
      ),
      activate,
    ));
    activate.addEventListener('click', async () => {
      const cur = api.session;
      if (cur && cur.demo) {
        toast('È in corso una DEMO: terminala prima di attivare giri reali.');
        return;
      }
      if (cur) {
        const v = await choose(h('div', null, h('h2', null, 'Sessione già in corso'),
          h('p', null, 'Il cliente precedente ha ancora ' + gameSpinsLeft(cur) + ' giri e ' + gameAwards(cur).filter((a) => a.status === 'pending').length + ' premi in sospeso.')), [
          { label: 'AGGIUNGI A QUESTA SESSIONE', value: 'add', cls: 'gold' },
          { label: 'CHIUDI E NUOVA SESSIONE', value: 'new', cls: 'ruby' },
          { label: 'ANNULLA', value: null },
        ]);
        if (!v) return;
        if (v === 'add') {
          const s2 = { ...cur, drinks: cur.drinks + drinks, baseSpins: cur.baseSpins + drinks * cfg.spinsPerDrink };
          sessionSave(s2);
          dayAdd(new Date(), cfg, { drinks });
          api.setSession(s2);
          o.close(); api.welcome(drinks); api.advance();
          return;
        }
        await closeSessionAndShow(api);
      }
      const ns = sessionNew(drinks, cfg, false);
      sessionSave(ns);
      dayAdd(new Date(), cfg, { drinks, sessions: 1 });
      api.setSession(ns);
      o.close();
      api.welcome(drinks);
      api.advance();
    });

    // --- riscatta buono
    const code = h('input', { type: 'text', placeholder: 'ABCD-EFGH', maxlength: '12', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
    const out = h('div', { class: 'redeem-out' });
    const check = h('button', { class: 'btn', type: 'button' }, 'VERIFICA');
    body.appendChild(h('section', { class: 'card' }, h('h3', null, 'Riscatta un buono'), h('div', { class: 'row' }, code, check), out));
    const doCheck = () => {
      out.textContent = '';
      const c = redeemCheck(code.value, new Date(), cfg);
      if (!c.ok) {
        out.appendChild(h('p', { class: 'form-err' }, c.reason));
        if (c.award) out.appendChild(awardLine(c.award));
        return;
      }
      const a = c.award;
      const meta = OUTCOMES[a.type];
      out.appendChild(awardLine(a));
      let q = 1;
      const qv = h('span', { class: 'qty' }, '1');
      const btn = h('button', { class: 'btn gold', type: 'button' }, meta.card ? 'SCALA CONSUMAZIONI' : 'SEGNA COME USATO');
      if (meta.card) {
        out.appendChild(h('p', null, 'Residuo tessera: ' + (a.uses - a.used) + ' · utilizzabili oggi: ' + c.maxQty));
        out.appendChild(h('div', { class: 'stepper small' },
          h('button', { class: 'btn round', type: 'button', onclick: () => { q = Math.max(1, q - 1); qv.textContent = String(q); } }, '−'),
          h('div', { class: 'stepper-val' }, qv),
          h('button', { class: 'btn round', type: 'button', onclick: () => { q = Math.min(c.maxQty, q + 1); qv.textContent = String(q); } }, '+')));
      }
      out.appendChild(btn);
      btn.addEventListener('click', () => {
        const r = redeem(code.value, q, new Date(), cfg);
        out.textContent = '';
        if (!r.ok) { out.appendChild(h('p', { class: 'form-err' }, r.reason)); return; }
        out.appendChild(h('p', { class: 'ok' }, '✔ ' + meta.label + (meta.card ? ': scalate ' + r.qty + ' consumazioni, residuo ' + (r.award.uses - r.award.used) : ' — buono utilizzato')));
        code.value = '';
      });
    };
    check.addEventListener('click', doCheck);
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCheck(); });

    // --- sessione
    if (s) {
      const pend = gameAwards(s).filter((a) => a.status === 'pending');
      const endBtn = h('button', { class: 'btn ruby', type: 'button' }, s.demo ? 'TERMINA DEMO' : 'CHIUDI SESSIONE ED EMETTI BUONI');
      body.appendChild(h('section', { class: 'card' },
        h('h3', null, 'Sessione in corso' + (s.demo ? ' (DEMO)' : '')),
        h('p', null, 'Giri rimasti: ' + s.baseSpins + (s.bonusSpins ? ' + ' + s.bonusSpins + ' bonus' : '') + ' · premi in sospeso: ' + pend.length),
        endBtn));
      endBtn.addEventListener('click', async () => {
        o.close();
        await closeSessionAndShow(api);
        api.advance();
      });
    }

    const actions = h('div', { class: 'actions' });
    if (role === 'manager') actions.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => { o.close(); managerPanel(api); } }, 'GESTIONE'));
    actions.appendChild(h('button', { class: 'btn gold', type: 'button', onclick: close }, 'TORNA AL GIOCO'));
    body.appendChild(actions);
  };
  render();
}

function awardLine(a) {
  const meta = OUTCOMES[a.type];
  return h('div', { class: 'award-line st-' + a.status },
    h('b', null, formatCode(a.code)), ' · ', meta.label, ' · ', STATUS_IT[a.status] || a.status,
    a.expiresOpDay ? ' · scade ' + formatDay(a.expiresOpDay) : '',
    meta.card ? ' · usati ' + a.used + '/' + a.uses : '');
}

async function closeSessionAndShow(api) {
  const s = api.session;
  if (!s) return;
  const issued = gameFinish(s, api.cfg, new Date());
  sessionClear();
  api.setSession(null);
  if (issued.length) await api.showVouchers(issued, s.demo);
}

// ---------------------------------------------------------------- gestore
function managerPanel(api) {
  const body = h('div', { class: 'admin manager' });
  const o = openOverlay(body, { panelCls: 'panel-admin wide' });
  const tabs = [['stats', 'Statistiche'], ['ledger', 'Buoni'], ['odds', 'Probabilità'], ['settings', 'Impostazioni'], ['backup', 'Backup'], ['security', 'PIN e Demo']];
  let current = 'stats';
  const render = () => {
    body.textContent = '';
    const nav = h('div', { class: 'tabs' });
    for (const [k, label] of tabs) nav.appendChild(h('button', { class: 'tab' + (k === current ? ' on' : ''), type: 'button', onclick: () => { current = k; render(); } }, label));
    body.appendChild(h('div', { class: 'admin-head' }, h('h2', null, 'Gestione · ' + api.cfg.barName)));
    body.appendChild(nav);
    const pane = h('div', { class: 'pane' });
    body.appendChild(pane);
    ({ stats: paneStats, ledger: paneLedger, odds: paneOdds, settings: paneSettings, backup: paneBackup, security: paneSecurity })[current](pane, api, render);
    body.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn gold', type: 'button', onclick: () => { o.close(); api.advance(); } }, 'TORNA AL GIOCO')));
  };
  render();
}

function paneStats(pane, api) {
  const cfg = api.cfg;
  const now = new Date();
  const d = opDay(now, cfg.opDayStartHour);
  const periods = [['Oggi', d], ['Mese', d.slice(0, 7)], ['Anno', d.slice(0, 4)], ['Totale', '']];
  const data = periods.map(([, p]) => statsSummary(p));
  const tr = (label, f) => h('tr', null, h('th', null, label), ...data.map((x) => h('td', null, f(x))));
  pane.appendChild(h('table', { class: 'data' },
    h('tr', null, h('th', null, ''), ...periods.map(([l]) => h('th', null, l))),
    tr('Drink con giri', (x) => x.drinks),
    tr('Giri giocati', (x) => x.spinsBase + x.spinsBonus),
    ...PRIZES.map((p) => tr(OUTCOMES[p].label, (x) => x.prizes[p].won)),
    tr('Premi rigiocati', (x) => x.conversions),
    tr('Valore premi (listino)', (x) => euro(x.valueD * cfg.avgDrinkPrice)),
    tr('% su incasso drink', (x) => x.pct.toFixed(2).replace('.', ',') + '%'),
    tr('Valore già riscattato', (x) => euro(x.redeemedD * cfg.avgDrinkPrice)),
    tr('Costo merce stimato', (x) => euro(x.redeemedD * cfg.avgDrinkPrice * cfg.foodCostPct / 100)),
  ));
  pane.appendChild(h('p', { class: 'note' }, 'Valori calcolati con prezzo medio drink ' + euro(cfg.avgDrinkPrice) + ' e food cost ' + cfg.foodCostPct + '%. La percentuale attesa nel lungo periodo con il profilo attuale è ' +
    analyze(PRESETS[cfg.preset], cfg).costPct.toFixed(2).replace('.', ',') + '%: su pochi giorni oscilla molto.'));
}

function paneLedger(pane, api, rerender) {
  const cfg = api.cfg;
  const now = new Date();
  const q = h('input', { type: 'text', placeholder: 'Cerca codice…' });
  const list = h('div', { class: 'ledger' });
  const draw = () => {
    list.textContent = '';
    const key = normalizeCode(q.value);
    const items = ledgerAll().map((a) => awardView(a, now, cfg))
      .filter((a) => !key || a.code.includes(key))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 300);
    if (!items.length) list.appendChild(h('p', null, 'Nessun buono.'));
    for (const a of items) {
      const line = awardLine(a);
      if (a.status === 'issued') {
        line.appendChild(h('button', {
          class: 'btn tiny', type: 'button',
          onclick: async () => {
            const v = await choose(h('p', null, 'Annullare il buono ' + formatCode(a.code) + '?'), [{ label: 'ANNULLA BUONO', value: true, cls: 'ruby' }, { label: 'NO', value: false }]);
            if (v) { awardVoid(a.id, new Date(), 'annullato dal gestore'); draw(); }
          },
        }, 'annulla'));
      }
      list.appendChild(line);
    }
  };
  q.addEventListener('input', draw);
  pane.appendChild(q);
  pane.appendChild(list);
  pane.appendChild(h('p', { class: 'note' }, 'Il registro conserva i buoni validi e quelli chiusi negli ultimi 60 giorni; i totali restano nelle statistiche. Esporta un backup ogni mese.'));
  draw();
}

function paneOdds(pane, api) {
  const cfg = api.cfg;
  const a = analyze(PRESETS[cfg.preset], cfg);
  const P = cfg.avgDrinkPrice;
  pane.appendChild(h('p', null, 'Profilo «' + PRESETS[cfg.preset].label + '»: per ogni drink venduto (' + cfg.spinsPerDrink + ' giri) il valore medio dei premi è ',
    h('b', null, a.costPct.toFixed(2).replace('.', ',') + '%'), ' del prezzo, cioè ', h('b', null, euro(a.sessionValue * P)), ' a listino (circa ',
    euro(a.sessionValue * P * cfg.foodCostPct / 100), ' di costo merce).'));
  pane.appendChild(h('table', { class: 'data' },
    h('tr', null, h('th', null, 'Premio'), h('th', null, 'Frequenza'), h('th', null, 'Ogni 1.000 drink'), h('th', null, 'Quota del costo')),
    ...PRIZES.map((p) => h('tr', null,
      h('td', null, OUTCOMES[p].label),
      h('td', null, oneIn(a.perDrink[p]) + ' drink'),
      h('td', null, (a.perDrink[p] * 1000).toFixed(a.perDrink[p] * 1000 < 1 ? 3 : 1).replace('.', ',')),
      h('td', null, (a.perDrink[p] * OUTCOMES[p].value * 100).toFixed(3).replace('.', ',') + '%'))),
    h('tr', null, h('td', null, 'Giri Bonus'), h('td', null, oneIn(a.bonusPerDrink) + ' drink'), h('td', null, (a.bonusPerDrink * 1000).toFixed(1).replace('.', ',')), h('td', null, '—')),
  ));
  const m = maxPrizeValueFromCaps(cfg.caps);
  pane.appendChild(h('h3', null, 'Limiti di sicurezza (tetti)'));
  pane.appendChild(h('table', { class: 'data' },
    h('tr', null, h('th', null, 'Premio'), h('th', null, 'Max giorno'), h('th', null, 'Max mese'), h('th', null, 'Max anno'), h('th', null, 'Max teorico annuo')),
    ...PRIZES.map((p) => {
      const c = cfg.caps[p];
      const f = (x) => (x > 0 ? String(x) : '—');
      return h('tr', null, h('td', null, OUTCOMES[p].label), h('td', null, f(c.day)), h('td', null, f(c.month)), h('td', null, f(c.year)),
        h('td', null, Number.isFinite(m.perYear[p]) ? m.perYear[p].toLocaleString('it-IT') : 'illimitato'));
    }),
  ));
  pane.appendChild(h('p', { class: 'note' }, Number.isFinite(m.totalD)
    ? 'Montepremi massimo teorico annuo con questi tetti: ' + euro(m.totalD * P) + ' a listino. Serve come base per l\'eventuale cauzione del concorso a premi (da verificare con il consulente).'
    : 'Almeno un premio non ha tetti: il montepremi massimo non è limitato. Imposta un limite giornaliero, mensile o annuo per ogni premio.'));
  pane.appendChild(h('p', { class: 'note' }, 'Rigioca: ' + PRIZES.filter((p) => a.conversion[p]).map((p) => OUTCOMES[p].label + ' → ' + a.conversion[p].spins + ' giri bonus (restituisce in media il ' + Math.round(a.conversion[p].evRatio * 100) + '% del valore)').join('; ') + '.'));
}

function paneSettings(pane, api, rerender) {
  const cfg = JSON.parse(JSON.stringify(api.cfg));
  const num = (v, attrs) => h('input', { type: 'number', value: String(v), ...attrs });
  const f = {
    bar: h('input', { type: 'text', value: cfg.barName, maxlength: '40' }),
    price: num(cfg.avgDrinkPrice, { min: '1', step: '0.5' }),
    food: num(cfg.foodCostPct, { min: '1', max: '100', step: '1' }),
    preset: h('select', null, ...PRESET_KEYS.map((k) => h('option', { value: k, selected: k === cfg.preset }, PRESETS[k].label + ' (~' + PRESETS[k].target + '%)'))),
    spins: num(cfg.spinsPerDrink, { min: '1', max: '20', step: '1' }),
    start: num(cfg.opDayStartHour, { min: '0', max: '12', step: '1' }),
    maxLoad: num(cfg.maxDrinksPerLoad, { min: '1', max: '20', step: '1' }),
    conv: h('input', { type: 'checkbox', checked: cfg.conversionEnabled }),
    eta: num(cfg.conversionEta, { min: '0.3', max: '0.9', step: '0.05' }),
    maxConv: num(cfg.maxConversionsPerDrink, { min: '1', max: '10', step: '1' }),
  };
  const capInputs = {};
  const valInputs = {};
  const capRows = PRIZES.map((p) => {
    capInputs[p] = { day: num(cfg.caps[p].day, { min: '0', step: '1' }), month: num(cfg.caps[p].month, { min: '0', step: '1' }), year: num(cfg.caps[p].year, { min: '0', step: '1' }) };
    valInputs[p] = num(cfg.validityDays[p], { min: '1', max: '1095', step: '1' });
    return h('tr', null, h('td', null, OUTCOMES[p].label), h('td', null, capInputs[p].day), h('td', null, capInputs[p].month), h('td', null, capInputs[p].year), h('td', null, valInputs[p]));
  });
  const cardC10 = num(cfg.cardMaxPerDay.C10, { min: '1', max: '10', step: '1' });
  const cardC100 = num(cfg.cardMaxPerDay.C100, { min: '1', max: '10', step: '1' });
  const err = h('p', { class: 'form-err' });
  const preview = h('p', { class: 'note' });
  const readCfg = () => {
    const c = JSON.parse(JSON.stringify(cfg));
    c.barName = f.bar.value.trim();
    c.avgDrinkPrice = Number(f.price.value);
    c.foodCostPct = Number(f.food.value);
    c.preset = f.preset.value;
    c.spinsPerDrink = Number(f.spins.value);
    c.opDayStartHour = Number(f.start.value);
    c.maxDrinksPerLoad = Number(f.maxLoad.value);
    c.conversionEnabled = f.conv.checked;
    c.conversionEta = Number(f.eta.value);
    c.maxConversionsPerDrink = Number(f.maxConv.value);
    for (const p of PRIZES) {
      c.caps[p] = { day: Number(capInputs[p].day.value), month: Number(capInputs[p].month.value), year: Number(capInputs[p].year.value) };
      c.validityDays[p] = Number(valInputs[p].value);
    }
    c.cardMaxPerDay = { C10: Number(cardC10.value), C100: Number(cardC100.value) };
    return c;
  };
  const validate = (c) => {
    const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
    if (!c.barName) return 'Nome del locale obbligatorio.';
    if (!(c.avgDrinkPrice > 0)) return 'Prezzo medio non valido.';
    if (!(c.foodCostPct > 0 && c.foodCostPct <= 100)) return 'Food cost non valido.';
    if (!isInt(c.spinsPerDrink, 1, 20)) return 'Giri per drink: da 1 a 20.';
    if (!isInt(c.opDayStartHour, 0, 12)) return 'Inizio giornata: ora da 0 a 12.';
    if (!isInt(c.maxDrinksPerLoad, 1, 20)) return 'Drink per attivazione: da 1 a 20.';
    if (!(c.conversionEta >= 0.3 && c.conversionEta <= 0.9)) return 'Quota rigioca: tra 0,3 e 0,9.';
    if (!isInt(c.maxConversionsPerDrink, 1, 10)) return 'Rigiocate per drink: da 1 a 10.';
    for (const p of PRIZES) {
      for (const k of ['day', 'month', 'year']) if (!isInt(c.caps[p][k], 0, 100000)) return 'Limiti: numeri interi ≥ 0 (' + OUTCOMES[p].label + ').';
      if (!isInt(c.validityDays[p], 1, 1095)) return 'Validità ' + OUTCOMES[p].label + ': da 1 a 1095 giorni.';
    }
    if (!(c.caps.C100.day || c.caps.C100.month || c.caps.C100.year)) return 'Per i 100 Cocktail è obbligatorio almeno un limite.';
    if (!(c.caps.C10.day || c.caps.C10.month || c.caps.C10.year)) return 'Per i 10 Cocktail è obbligatorio almeno un limite.';
    if (!isInt(c.cardMaxPerDay.C10, 1, 10) || !isInt(c.cardMaxPerDay.C100, 1, 10)) return 'Uso tessere al giorno: da 1 a 10.';
    return null;
  };
  const refreshPreview = () => {
    const c = readCfg();
    if (validate(c)) { preview.textContent = ''; return; }
    const a = analyze(PRESETS[c.preset], c);
    preview.textContent = 'Con queste impostazioni: premi pari in media al ' + a.costPct.toFixed(2).replace('.', ',') + '% del prezzo di ogni drink (' + euro(a.sessionValue * c.avgDrinkPrice) + ').';
    preview.className = 'note' + (a.costPct > 8 ? ' warn' : '');
  };
  pane.addEventListener('input', refreshPreview);
  pane.appendChild(h('div', { class: 'form-grid' },
    h('label', null, 'Nome del locale', f.bar),
    h('label', null, 'Prezzo medio drink (€)', f.price),
    h('label', null, 'Food cost medio (%)', f.food),
    h('label', null, 'Profilo di generosità', f.preset),
    h('label', null, 'Giri per drink', f.spins),
    h('label', null, 'Inizio giornata operativa (ora)', f.start),
    h('label', null, 'Max drink per attivazione', f.maxLoad),
    h('label', null, 'Quota restituita col Rigioca (0,3–0,9)', f.eta),
    h('label', null, 'Max rigiocate per drink', f.maxConv),
  ));
  pane.appendChild(h('label', { class: 'check' }, f.conv, ' Consenti di rigiocare sconti e drink omaggio come Giri Bonus'));
  pane.appendChild(h('h3', null, 'Limiti di disponibilità (0 = nessun limite) e validità buoni'));
  pane.appendChild(h('table', { class: 'data form' },
    h('tr', null, h('th', null, 'Premio'), h('th', null, 'Giorno'), h('th', null, 'Mese'), h('th', null, 'Anno'), h('th', null, 'Validità (gg)')), ...capRows));
  pane.appendChild(h('div', { class: 'form-grid' },
    h('label', null, 'Tessera 10 Cocktail: max consumazioni al giorno', cardC10),
    h('label', null, 'Tessera 100 Cocktail: max consumazioni al giorno', cardC100)));
  pane.appendChild(preview);
  pane.appendChild(err);
  pane.appendChild(h('div', { class: 'actions' }, h('button', {
    class: 'btn gold', type: 'button',
    onclick: () => {
      const c = readCfg();
      const e = validate(c);
      if (e) { err.textContent = e; return; }
      if (!saveConfig(c)) { err.textContent = 'Impossibile salvare.'; return; }
      api.setCfg(loadConfig());
      document.getElementById('bar-name').textContent = c.barName;
      toast('Impostazioni salvate');
      rerender();
    },
  }, 'SALVA IMPOSTAZIONI')));
  refreshPreview();
}

function paneBackup(pane, api) {
  const cfg = api.cfg;
  if (!storeIsPersistent()) pane.appendChild(h('p', { class: 'form-err' }, 'ATTENZIONE: la memoria del browser non è disponibile (navigazione privata?). I dati andranno persi alla chiusura.'));
  const file = h('input', { type: 'file', accept: 'application/json,.json' });
  pane.appendChild(h('section', { class: 'card' },
    h('h3', null, 'Esporta'),
    h('p', null, 'Il registro dei buoni vive solo in questo tablet: esporta un backup almeno una volta al mese e conservalo.'),
    h('div', { class: 'actions left' },
      h('button', { class: 'btn gold', type: 'button', onclick: () => downloadText('grimorio-backup-' + opDay(new Date(), cfg.opDayStartHour) + '.json', JSON.stringify(exportBackup(), null, 1), 'application/json') }, 'BACKUP COMPLETO (JSON)'),
      h('button', { class: 'btn', type: 'button', onclick: () => downloadText('grimorio-buoni-' + opDay(new Date(), cfg.opDayStartHour) + '.csv', '﻿' + ledgerCsv(new Date(), cfg), 'text/csv') }, 'REGISTRO BUONI (CSV)')),
  ));
  pane.appendChild(h('section', { class: 'card' },
    h('h3', null, 'Ripristina'),
    h('p', null, 'Sostituisce registro, statistiche e impostazioni con quelli del file (PIN compresi).'),
    file,
  ));
  file.addEventListener('change', async () => {
    const fl = file.files && file.files[0];
    if (!fl) return;
    const ok = await choose(h('p', null, 'Ripristinare il backup «' + fl.name + '»? I dati attuali verranno sostituiti.'), [{ label: 'RIPRISTINA', value: true, cls: 'ruby' }, { label: 'ANNULLA', value: false }]);
    if (!ok) return;
    try {
      importBackup(JSON.parse(await fl.text()));
      api.setCfg(loadConfig());
      toast('Backup ripristinato');
    } catch (e) {
      toast('Errore: ' + e.message, 4000);
    }
  });
}

function paneSecurity(pane, api) {
  const change = async (kind) => {
    const a = await askPin(kind === 'staff' ? 'Nuovo PIN barista' : 'Nuovo PIN gestore', { min: kind === 'staff' ? 4 : 6, max: kind === 'staff' ? 6 : 8 });
    if (a == null) return;
    const b = await askPin('Conferma il nuovo PIN', { min: kind === 'staff' ? 4 : 6, max: kind === 'staff' ? 6 : 8 });
    if (b == null) return;
    if (a !== b) { toast('I PIN non coincidono'); return; }
    const otherHash = kind === 'staff' ? api.cfg.managerPinHash : api.cfg.staffPinHash;
    if (pinHash(api.cfg.pinSalt, a) === otherHash) { toast('Il PIN deve essere diverso dall\'altro'); return; }
    const c = setPins(api.cfg, kind === 'staff' ? a : null, kind === 'manager' ? a : null);
    saveConfig(c);
    api.setCfg(loadConfig());
    toast('PIN aggiornato');
  };
  pane.appendChild(h('section', { class: 'card' },
    h('h3', null, 'PIN'),
    h('div', { class: 'actions left' },
      h('button', { class: 'btn', type: 'button', onclick: () => change('staff') }, 'CAMBIA PIN BARISTA'),
      h('button', { class: 'btn', type: 'button', onclick: () => change('manager') }, 'CAMBIA PIN GESTORE'))));
  pane.appendChild(h('section', { class: 'card' },
    h('h3', null, 'Modalità demo'),
    h('p', null, 'Una sessione di prova da 10 giri: premi segnati come DEMO, non registrati, non conteggiati nei limiti né nelle statistiche.'),
    h('button', {
      class: 'btn gold', type: 'button',
      onclick: () => {
        if (api.session) { toast('Chiudi prima la sessione in corso.'); return; }
        const s = sessionNew(1, api.cfg, true);
        sessionSave(s);
        api.setSession(s);
        document.querySelectorAll('.overlay').forEach((x) => x.remove());
        api.welcome(1);
        api.advance();
      },
    }, 'AVVIA DEMO')));
}
