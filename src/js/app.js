// Controller principale: collega motore, rulli, effetti, suoni e pannelli.

import { REELS, ROWS, LINES, LINE_COLORS, OUTCOMES, SYMBOLS, PAY, EXPAND_PAY, WILD } from './paytable.js';
import { buildGrid } from './engine.js';
import { symbolUrl, DECO_PATTERN_URL } from './symbols.js';
import { Reels } from './reels.js';
import { Fx } from './fx.js';
import { Sound } from './audio.js';
import { h, esc, uiInit, openOverlay, choose, toast, sleep, oneIn } from './ui.js';
import {
  loadConfig, prefsLoad, prefsSave, sessionLoad, sessionClear, isConfigured, ledgerPrune, formatCode, formatDay,
} from './store.js';
import {
  gameSpin, gameKeep, gameConvert, gameStartBonus, gameEndBonus, gameFinish, gameNextStep, gameAward, gameAwards, gameAnalysis,
  gameCanConvert,
} from './game.js';
import { openStaff, runSetup } from './admin.js';

const app = {
  cfg: loadConfig(),
  prefs: prefsLoad(),
  session: sessionLoad(),
  busy: false,
  flowing: false,
  auto: false,
  idleTimer: null,
  timers: new Set(),
};
const sound = new Sound();
sound.enabled = app.prefs.sound;
sound.volume = app.prefs.volume;

let reels, fx;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- layout
function appLayout() {
  const stage = $('stage');
  const r = stage.getBoundingClientRect();
  const markers = 0.34; // larghezza colonna indicatori linea, in celle
  const framePad = 0.42; // spessore cornice + lampadine, in celle (per lato)
  const cw = r.width / (REELS + 2 * markers + 2 * framePad);
  const ch = r.height / (ROWS + 2 * framePad);
  const cell = Math.max(40, Math.floor(Math.min(cw, ch)));
  document.documentElement.style.setProperty('--cell', cell + 'px');
  reels.setCellSize(cell);
  fx.resize();
  appPlaceBulbs(cell);
}

function appPlaceBulbs(cell) {
  const holder = $('bulbs');
  const frame = $('frame');
  holder.textContent = '';
  const w = frame.offsetWidth, hgt = frame.offsetHeight;
  const gap = Math.max(22, cell * 0.36);
  const inset = cell * 0.1;
  const pts = [];
  const nx = Math.max(2, Math.round((w - 2 * inset) / gap));
  const ny = Math.max(2, Math.round((hgt - 2 * inset) / gap));
  for (let i = 0; i <= nx; i++) { const x = inset + (i * (w - 2 * inset)) / nx; pts.push([x, inset]); }
  for (let i = 1; i <= ny; i++) { const y = inset + (i * (hgt - 2 * inset)) / ny; pts.push([w - inset, y]); }
  for (let i = nx - 1; i >= 0; i--) { const x = inset + (i * (w - 2 * inset)) / nx; pts.push([x, hgt - inset]); }
  for (let i = ny - 1; i >= 1; i--) { const y = inset + (i * (hgt - 2 * inset)) / ny; pts.push([inset, y]); }
  pts.forEach(([x, y], i) => {
    holder.appendChild(h('span', { class: 'bulb', style: { left: x + 'px', top: y + 'px', animationDelay: (-(i % 6) * 0.18) + 's' } }));
  });
}

function appBuildMarkers() {
  for (const side of ['left', 'right']) {
    const col = $('markers-' + side);
    col.textContent = '';
    // indicatori posizionati all'altezza della riga di partenza/arrivo della linea
    const slots = [[], [], []];
    LINES.forEach((ln, i) => slots[side === 'left' ? ln[0] : ln[REELS - 1]].push(i));
    slots.forEach((list, row) => {
      list.forEach((li, k) => {
        const top = ((row + (k + 1) / (list.length + 1)) / ROWS) * 100;
        col.appendChild(h('span', {
          class: 'line-marker', 'data-line': String(li),
          style: { top: top + '%', '--lc': LINE_COLORS[li] },
        }, String(li + 1)));
      });
    });
  }
}

// ---------------------------------------------------------------- HUD
function appMessage(text, cls) {
  const m = $('msg');
  m.className = 'msg ' + (cls || '');
  m.innerHTML = text;
}

function appHud(override) {
  const s = app.session;
  const base = override ? override.base : s ? s.baseSpins : 0;
  $('spins-left').textContent = String(base);
  const pending = s ? gameAwards(s).filter((a) => a.status === 'pending' && !(override && a.id === override.hideAward)).length : 0;
  $('prizes-count').textContent = String(pending);
  const bonus = s && (s.mode === 'bonus' || s.pendingBonusIntro);
  document.body.classList.toggle('mode-bonus', !!(s && s.mode === 'bonus'));
  const hud = $('bonus-hud');
  if (s && s.mode === 'bonus') {
    const played = override ? override.bonusPlayed : s.bonusPlayed;
    const total = override ? override.bonusTotal : s.bonusTotal;
    hud.hidden = false;
    $('bonus-count').textContent = Math.min(played + (app.busy ? 0 : 0), total) + ' / ' + total;
    $('bonus-special').style.backgroundImage = 'url("' + symbolUrl(s.special) + '")';
  } else {
    hud.hidden = true;
  }
  const step = gameNextStep(s);
  const canSpin = step === 'baseSpin' && !app.busy;
  const btn = $('spin-btn');
  btn.classList.toggle('ready', canSpin);
  btn.classList.toggle('stop', app.busy);
  btn.disabled = !(canSpin || app.busy);
  $('spin-label').textContent = app.busy ? 'STOP' : 'GIRA';
  $('auto-btn').classList.toggle('on', app.auto);
  $('turbo-btn').classList.toggle('on', !!app.prefs.turbo);
  $('sound-btn').classList.toggle('off', !app.prefs.sound);
  $('attract').hidden = !!s;
  $('attract-big').textContent = 'ricevi ' + app.cfg.spinsPerDrink + ' giri gratis';
  document.body.classList.toggle('demo', !!(s && s.demo));
  $('demo-badge').hidden = !(s && s.demo);
  if (!bonus) $('stage').classList.remove('bonus-glow');
}

// ---------------------------------------------------------------- flusso
function appLater(fn, ms) {
  const t = setTimeout(() => { app.timers.delete(t); fn(); }, ms);
  app.timers.add(t);
}

async function appAdvance() {
  if (app.flowing || app.busy) return;
  app.flowing = true;
  try {
    for (;;) {
      const step = gameNextStep(app.session);
      if (step === 'decision') { await appDecision(); continue; }
      if (step === 'bonusIntro') { await appBonusIntro(); continue; }
      if (step === 'bonusOutro') { await appBonusOutro(); continue; }
      if (step === 'end') { await appSessionEnd(); continue; }
      if (step === 'bonusSpin') {
        appHud();
        appMessage('Giri Bonus in corso…', 'gold');
        appLater(() => appSpin(false), app.prefs.turbo ? 350 : 700);
      } else if (step === 'baseSpin') {
        appHud();
        if (app.auto) appLater(() => appSpin(false), app.prefs.turbo ? 250 : 550);
        else appMessage('Hai <b>' + app.session.baseSpins + '</b> giri: premi <b>GIRA</b>!');
      } else {
        appHud();
        appMessage('Ordina un drink: ricevi <b>' + app.cfg.spinsPerDrink + ' giri gratis</b>');
      }
      break;
    }
  } finally {
    app.flowing = false;
  }
}

async function appSpin(manual) {
  if (app.busy) { if (manual) reels.quickStop(); return; }
  if (app.flowing) return;
  if (!manual && document.querySelector('.overlay')) { appLater(() => appSpin(false), 800); return; }
  const step = gameNextStep(app.session);
  if (step !== 'baseSpin' && step !== 'bonusSpin') return;
  sound.unlock();
  app.busy = true;
  if (reels.spinning) await reels.done; // animazione decorativa di attesa ancora in corso
  let res;
  try {
    res = gameSpin(app.session, app.cfg, new Date());
  } catch (e) {
    app.busy = false;
    toast('Errore tecnico, giro non consumato: ' + e.message, 5000);
    appHud();
    return;
  }
  app.session = res.session;
  const r = res.result;
  // durante l'animazione i giri extra non sono ancora "visibili"
  appHud({ base: app.session.baseSpins - r.extra, bonusPlayed: app.session.bonusPlayed, bonusTotal: app.session.bonusTotal - r.retrigger, hideAward: r.award && r.award.id });
  appMessage(r.mode === 'bonus' ? 'Giro bonus ' + app.session.bonusPlayed + '…' : 'Buona fortuna!');
  const turbo = !!app.prefs.turbo;
  sound.spinStart(turbo ? 1.0 : 2.0);
  let booksSoFar = 0;
  try {
    await reels.spin(r.grid, {
      turbo,
      special: r.mode === 'bonus' ? r.special : null,
      onReelStop: (i, col) => {
        sound.reelStop(i);
        const nb = col.filter((s) => s === WILD).length;
        if (nb) {
          booksSoFar += nb;
          sound.bookLand(booksSoFar);
          col.forEach((s, row) => { if (s === WILD) reels.cellEl(i, row).classList.add('book-flash'); });
        }
        if (i === REELS - 1) sound.stopLoop();
      },
      onAnticipate: (i, sec) => { sound.anticipation(sec); },
    });
    await appPresent(r);
  } finally {
    sound.stopLoop();
    app.busy = false;
  }
  appHud();
  appAdvance();
}

function appCellCenter(r, row) {
  const c = reels.cellEl(r, row);
  if (!c) return [innerWidth / 2, innerHeight / 2];
  const b = c.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
}

async function appPresent(r) {
  const turbo = !!app.prefs.turbo;
  if (!r.wins.length) {
    appMessage(r.mode === 'bonus' ? 'Nessuna vincita in questo giro' : 'Ritenta, il Grimorio ti osserva…', 'dim');
    return;
  }
  const w = r.wins[0];
  if (w.kind === 'line') {
    reels.highlight(w.cells);
    reels.drawLine(w.line);
  } else if (w.kind === 'scatter') {
    reels.highlight(w.cells);
  }
  const meta = OUTCOMES[r.outcome];
  if (meta.kind === 'spins') {
    sound.extraSpin();
    const mid = w.cells[Math.floor(w.cells.length / 2)];
    const [x, y] = appCellCenter(mid[0], mid[1]);
    fx.burst(x, y, { count: 26, max: 320 });
    appMessage('<b>+' + meta.spins + (meta.spins === 1 ? ' GIRO' : ' GIRI') + '</b> gratis!', 'win');
    appFloat('+' + meta.spins + (meta.spins === 1 ? ' GIRO' : ' GIRI'), x, y);
    await sleep(turbo ? 650 : 1200);
    return;
  }
  if (r.outcome === 'BONUS' || r.outcome === 'RETRIG') {
    sound.bonusFanfare();
    for (const [cr, crow] of w.cells) { const [x, y] = appCellCenter(cr, crow); fx.burst(x, y, { count: 40, colors: ['#fff3c4', '#ffd76a', '#b388ff'] }); }
    appMessage(r.outcome === 'BONUS' ? '<b>IL GRIMORIO SI APRE!</b>' : '<b>+' + r.retrigger + ' GIRI BONUS!</b>', 'win');
    if (r.outcome === 'RETRIG') appFloat('+' + r.retrigger + ' GIRI BONUS', innerWidth / 2, innerHeight / 2);
    await sleep(turbo ? 1100 : 1900);
    return;
  }
  // premio
  if (w.kind === 'expand') {
    reels.highlight(w.cells);
    await sleep(300);
    sound.expand();
    await reels.expand(w.reels, w.symbol, r.grid);
  }
  appCelebrate(meta.tier);
  appHud();
  appMessage('Hai vinto: <b>' + esc(meta.label) + '</b>', 'win');
  await sleep(meta.tier >= 4 ? 1600 : turbo ? 700 : 1300);
  if (app.session.pendingDecision !== (r.award && r.award.id)) await appBigPrize(r.award);
}

function appFloat(text, x, y) {
  const f = h('div', { class: 'float-text', style: { left: x + 'px', top: y + 'px' } }, text);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1600);
}

function appCelebrate(tier) {
  sound.win(tier);
  const W = innerWidth, H = innerHeight;
  if (tier <= 2) {
    fx.burst(W / 2, H * 0.45, { count: 60 + tier * 30 });
  } else if (tier === 3) {
    fx.burst(W / 2, H * 0.45, { count: 140, max: 700 });
    fx.emit('confetti', 2.5);
    fx.emit('bubbles', 3);
  } else {
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 900);
    fx.emit('fireworks', tier === 5 ? 9 : 5);
    fx.emit('gold', tier === 5 ? 9 : 5);
    fx.emit('confetti', tier === 5 ? 7 : 4);
  }
}

function appPrizeCard(award, extraCls) {
  const meta = OUTCOMES[award.type];
  return h('div', { class: 'ticket tier-' + meta.tier + ' ' + (extraCls || '') },
    h('div', { class: 'ticket-label' }, meta.label),
    h('div', { class: 'ticket-desc' }, meta.desc),
  );
}

async function appBigPrize(award) {
  const meta = OUTCOMES[award.type];
  const big = meta.tier >= 4;
  const title = meta.tier === 5 ? 'LEGGENDARIO!' : big ? 'MEGA VINCITA!' : 'HAI VINTO!';
  const content = h('div', { class: 'prize-pop' + (big ? ' big' : '') },
    h('div', { class: 'rays' }),
    h('h2', { class: 'prize-title' }, title),
    appPrizeCard(award),
    big ? h('p', { class: 'note' }, 'Chiama il barista per la convalida del premio.') : null,
    app.session && app.session.demo ? h('p', { class: 'note warn' }, 'MODALITÀ DEMO — premio non valido') : null,
  );
  await choose(content, [{ label: 'CONTINUA', value: true, cls: 'gold' }], { cls: 'celebrate', panelCls: 'panel-prize' });
}

async function appDecision() {
  const s = app.session;
  const award = gameAward(s, s.pendingDecision);
  if (!award || award.status !== 'pending') { app.session = gameKeep(s); return; }
  const meta = OUTCOMES[award.type];
  const spins = gameAnalysis(app.cfg).conversion[award.type].spins;
  const content = h('div', { class: 'prize-pop' },
    h('div', { class: 'rays' }),
    h('h2', { class: 'prize-title' }, 'HAI VINTO!'),
    appPrizeCard(award),
    h('p', { class: 'gamble' }, 'Oppure ', h('b', null, 'RIGIOCA'), ': rinunci a «' + meta.label + '» e lo trasformi in ',
      h('b', null, spins + ' Giri Bonus'), ' con Simbolo Speciale che si espande. Puoi vincere di più… o niente.'),
    s.demo ? h('p', { class: 'note warn' }, 'MODALITÀ DEMO — premio non valido') : null,
  );
  const v = await choose(content, [
    { label: 'TIENI IL PREMIO', value: 'keep', cls: 'gold' },
    { label: 'RIGIOCA · ' + spins + ' GIRI BONUS', value: 'convert', cls: 'ruby' },
  ], { cls: 'celebrate', panelCls: 'panel-prize' });
  sound.click();
  if (v === 'convert') {
    try {
      app.session = gameConvert(s, award.id, app.cfg, new Date()).session;
      appMessage('Premio trasformato in <b>' + spins + ' Giri Bonus</b>!', 'win');
    } catch (e) {
      toast(e.message);
      app.session = gameKeep(s);
    }
  } else {
    app.session = gameKeep(s);
    appMessage('Premio aggiunto allo <b>Scrigno</b>', 'win');
  }
  appHud();
}

async function appBonusIntro() {
  const s = app.session;
  const pages = h('div', { class: 'book-pages' });
  const reveal = h('div', { class: 'book-reveal', style: { backgroundImage: 'url("' + symbolUrl(s.special) + '")' } });
  const book = h('div', { class: 'big-book' },
    h('div', { class: 'book-back' }), pages, reveal,
    h('div', { class: 'book-cover', style: { backgroundImage: 'url("' + symbolUrl(WILD) + '")' } }),
  );
  const title = h('h2', { class: 'bonus-title' }, s.bonusSpins + ' GIRI BONUS');
  const sub = h('p', { class: 'bonus-sub' }, 'Il Grimorio sceglie il Simbolo Speciale…');
  const go = h('button', { class: 'btn gold', type: 'button', hidden: true }, 'INIZIA');
  const o = openOverlay(h('div', { class: 'bonus-intro' }, h('div', { class: 'rays' }), title, book, sub, go), { cls: 'celebrate', panelCls: 'panel-bonus' });
  sound.bonusFanfare();
  fx.emit('magic', 4);
  await sleep(700);
  book.classList.add('open');
  const flips = 7;
  for (let i = 0; i < flips; i++) {
    const p = h('div', { class: 'page', style: { backgroundImage: 'url("' + symbolUrl(Math.floor(Math.random() * 8)) + '")' } });
    pages.appendChild(p);
    requestAnimationFrame(() => p.classList.add('flip'));
    sound.pageFlip();
    await sleep(170 + i * 25);
  }
  reveal.classList.add('show');
  sound.reveal();
  const rb = reveal.getBoundingClientRect();
  fx.burst(rb.left + rb.width / 2, rb.top + rb.height / 2, { count: 120, max: 600, colors: ['#fff3c4', '#ffd76a', '#b388ff', '#80deea'] });
  const sym = SYMBOLS[s.special];
  sub.innerHTML = 'Simbolo Speciale: <b>' + esc(sym.name) + '</b><br>si espande su tutto il rullo e paga anche su rulli non adiacenti';
  go.hidden = false;
  await new Promise((res) => {
    const t = setTimeout(res, 4500);
    go.addEventListener('click', () => { clearTimeout(t); res(); }, { once: true });
  });
  o.close();
  app.session = gameStartBonus(app.session);
  $('stage').classList.add('bonus-glow');
  appHud();
}

async function appBonusOutro() {
  const s = app.session;
  const won = (s.bonusWins || []).map((id) => gameAward(s, id)).filter(Boolean);
  const list = h('div', { class: 'mini-prizes' });
  for (const a of won) list.appendChild(appPrizeCard(a, a.status === 'converted' ? 'converted' : 'mini'));
  const content = h('div', { class: 'bonus-outro' },
    h('h2', { class: 'prize-title' }, 'GIRI BONUS TERMINATI'),
    won.length ? h('p', null, 'Premi vinti nei Giri Bonus:') : h('p', null, 'Il Grimorio si richiude… nessun premio questa volta.'),
    list,
  );
  await choose(content, [{ label: 'CONTINUA', value: true, cls: 'gold' }], { cls: 'celebrate', panelCls: 'panel-prize', autoMs: 6000, autoValue: true });
  app.session = gameEndBonus(app.session);
  appHud();
}

async function appSessionEnd() {
  const s = app.session;
  app.auto = false;
  const pending = gameAwards(s).filter((a) => a.status === 'pending');
  if (!pending.length) {
    const content = h('div', { class: 'scrigno empty' },
      h('h2', { class: 'prize-title' }, 'GIRI TERMINATI'),
      h('p', null, 'Nessun premio stavolta: il Grimorio ti aspetta al prossimo drink!'),
    );
    await choose(content, [{ label: 'OK', value: true, cls: 'gold' }], { autoMs: 7000, autoValue: true, panelCls: 'panel-prize' });
    gameFinish(s, app.cfg, new Date());
    sessionClear();
    app.session = null;
    appHud();
    return;
  }
  const an = gameAnalysis(app.cfg);
  const list = h('div', { class: 'scrigno-list' });
  const content = h('div', { class: 'scrigno' },
    h('h2', { class: 'prize-title' }, 'IL TUO SCRIGNO'),
    h('p', null, 'Ritira i premi oppure rigiocane uno trasformandolo in Giri Bonus.'),
    list,
  );
  const result = await new Promise((resolve) => {
    let o;
    for (const a of pending) {
      const meta = OUTCOMES[a.type];
      const row = h('div', { class: 'scrigno-item' }, appPrizeCard(a, 'mini'));
      if (meta.convertible && gameCanConvert(s, app.cfg)) {
        const n = an.conversion[a.type].spins;
        row.appendChild(h('button', { class: 'btn ruby small', type: 'button', onclick: () => { o.close(); resolve({ convert: a.id }); } }, 'RIGIOCA · ' + n + ' GIRI'));
      }
      list.appendChild(row);
    }
    const bar = h('div', { class: 'actions' },
      h('button', { class: 'btn gold', type: 'button', onclick: () => { o.close(); resolve({ collect: true }); } }, 'RITIRA I PREMI'));
    content.appendChild(bar);
    o = openOverlay(content, { cls: 'celebrate', panelCls: 'panel-prize' });
  });
  sound.click();
  if (result.convert) {
    try {
      app.session = gameConvert(app.session, result.convert, app.cfg, new Date()).session;
    } catch (e) { toast(e.message); }
    appHud();
    return;
  }
  const issued = gameFinish(app.session, app.cfg, new Date());
  const demo = app.session.demo;
  sessionClear();
  app.session = null;
  appHud();
  await appShowVouchers(issued, demo);
}

export async function appShowVouchers(issued, demo) {
  const list = h('div', { class: 'voucher-list' });
  for (const a of issued) {
    const meta = OUTCOMES[a.type];
    list.appendChild(h('div', { class: 'voucher tier-' + meta.tier },
      h('div', { class: 'voucher-prize' }, meta.label),
      h('div', { class: 'voucher-code' }, demo ? 'DEMO-NONVALIDO' : formatCode(a.code)),
      h('div', { class: 'voucher-meta' }, demo ? 'Buono dimostrativo' : 'Valido fino al ' + formatDay(a.expiresOpDay) +
        (meta.card ? ' · max ' + app.cfg.cardMaxPerDay[a.type] + ' al giorno' : '')),
    ));
  }
  const content = h('div', { class: 'vouchers' },
    h('h2', { class: 'prize-title' }, 'I TUOI BUONI'),
    h('p', null, 'Fotografa questa schermata e mostra il codice al barista quando vuoi usare il premio.'),
    list,
    h('p', { class: 'note' }, 'Premi non convertibili in denaro. Un buono per consumazione.'),
  );
  await choose(content, [{ label: 'FATTO', value: true, cls: 'gold' }], { autoMs: 180000, autoValue: true, panelCls: 'panel-prize' });
}

// ---------------------------------------------------------------- regole
function appPaytable() {
  const an = gameAnalysis(app.cfg);
  const row = (sym) => {
    const p = PAY[sym];
    return h('tr', null,
      h('td', null, h('span', { class: 'pt-sym', style: { backgroundImage: 'url("' + symbolUrl(sym) + '")' } })),
      h('td', null, SYMBOLS[sym].name),
      ...[3, 4, 5].map((n) => h('td', { class: 'pt-' + OUTCOMES[p[n]].kind }, OUTCOMES[p[n]].label)),
    );
  };
  const lines = h('div', { class: 'pt-lines' });
  LINES.forEach((ln, i) => {
    let cells = '';
    for (let row = 0; row < ROWS; row++) for (let r = 0; r < REELS; r++) {
      cells += '<rect x="' + (r * 10 + 1) + '" y="' + (row * 10 + 1) + '" width="8" height="8" rx="1.5" fill="' + (ln[r] === row ? LINE_COLORS[i] : 'rgba(255,255,255,.12)') + '"/>';
    }
    lines.appendChild(h('div', { class: 'pt-line' }, h('span', null, String(i + 1)), h('span', { html: '<svg viewBox="0 0 50 30">' + cells + '</svg>' })));
  });
  const odds = h('table', { class: 'pt-odds' },
    h('tr', null, h('th', null, 'Premio'), h('th', null, 'Frequenza media')),
    ...['P10', 'P20', 'DRINK', 'C10', 'C100'].map((p) => h('tr', null, h('td', null, OUTCOMES[p].label), h('td', null, oneIn(an.perDrink[p]) + ' drink'))),
    h('tr', null, h('td', null, 'Giri Bonus'), h('td', null, oneIn(an.bonusPerDrink) + ' drink')),
  );
  const content = h('div', { class: 'paytable' },
    h('h2', { class: 'prize-title' }, 'REGOLE DEL GRIMORIO'),
    h('p', null, 'Ogni drink acquistato dà ' + app.cfg.spinsPerDrink + ' giri gratis. Nessuna puntata, nessun denaro: solo premi in consumazioni. ' +
      'Si vince allineando simboli uguali su una delle 10 linee, da sinistra a destra, su rulli adiacenti. Per ogni giro si assegna una sola vincita.'),
    h('table', { class: 'pt-table' },
      h('tr', null, h('th', null, ''), h('th', null, 'Simbolo'), h('th', null, '×3'), h('th', null, '×4'), h('th', null, '×5')),
      ...[7, 6, 5, 4, 3, 2, 1, 0].map(row),
    ),
    h('div', { class: 'pt-book' },
      h('span', { class: 'pt-sym big', style: { backgroundImage: 'url("' + symbolUrl(WILD) + '")' } }),
      h('div', null,
        h('h3', null, 'Il Grimorio — jolly e scatter'),
        h('p', null, 'Sostituisce qualsiasi simbolo sulle linee. 3 o più Grimori in qualsiasi posizione aprono ' + app.cfg.bonusSpins + ' Giri Bonus (durante i Giri Bonus: +' + app.cfg.retriggerSpins + ' giri).'),
        h('h3', null, 'Giri Bonus e Simbolo Speciale'),
        h('p', null, 'All\'inizio il Grimorio sceglie un Simbolo Speciale: se compare su 3, 4 o 5 rulli (anche non adiacenti) si espande e vale: 3 rulli = ' +
          OUTCOMES[EXPAND_PAY[3]].label + ', 4 rulli = ' + OUTCOMES[EXPAND_PAY[4]].label + ', 5 rulli = ' + OUTCOMES[EXPAND_PAY[5]].label + '.'),
        app.cfg.conversionEnabled ? h('h3', null, 'Rigioca') : null,
        app.cfg.conversionEnabled ? h('p', null, 'Sconti e drink omaggio possono essere trasformati in Giri Bonus: ' +
          ['P10', 'P20', 'DRINK'].map((p) => OUTCOMES[p].label + ' = ' + an.conversion[p].spins + ' giri').join(' · ') + '.') : null,
      ),
    ),
    h('h3', null, 'Le 10 linee'),
    lines,
    h('h3', null, 'Probabilità (media per drink acquistato)'),
    odds,
    h('p', { class: 'note' }, 'I premi sono soggetti ai limiti di disponibilità giornalieri, mensili e annuali indicati nel regolamento: ' +
      'se un premio non è disponibile viene assegnato il premio di valore immediatamente inferiore. Premi non convertibili in denaro. ' +
      'Gioco riservato ai maggiorenni. Regolamento completo disponibile presso il bar. Bevi responsabilmente.'),
  );
  choose(content, [{ label: 'CHIUDI', value: true, cls: 'gold' }], { panelCls: 'panel-wide', backdropClose: true });
}

// ---------------------------------------------------------------- attract
function appAttractTick() {
  if (app.session || app.busy || document.querySelector('.overlay')) return;
  try {
    const { grid } = buildGrid('NONE', 'base', null);
    reels.spin(grid, { turbo: false });
  } catch (e) { /* solo estetica */ }
}

// ---------------------------------------------------------------- API per i pannelli
export const appApi = {
  get cfg() { return app.cfg; },
  setCfg(c) { app.cfg = c; appHud(); },
  get session() { return app.session; },
  setSession(s) { app.session = s; appHud(); },
  advance() { appAdvance(); },
  showVouchers: appShowVouchers,
  reels: () => reels,
  welcome(drinks) {
    sound.unlock();
    sound.win(1);
    fx.burst(innerWidth / 2, innerHeight * 0.4, { count: 90 });
    appMessage('Benvenuto! Hai <b>' + app.session.baseSpins + '</b> giri gratis', 'win');
  },
};

// ---------------------------------------------------------------- avvio
function appBind() {
  $('spin-btn').addEventListener('click', () => { sound.unlock(); appSpin(true); });
  $('auto-btn').addEventListener('click', () => {
    sound.unlock(); sound.click();
    app.auto = !app.auto;
    appHud();
    if (app.auto && !app.busy) appAdvance();
  });
  $('turbo-btn').addEventListener('click', () => {
    sound.unlock(); sound.click();
    app.prefs.turbo = !app.prefs.turbo;
    prefsSave(app.prefs);
    appHud();
  });
  $('sound-btn').addEventListener('click', () => {
    sound.unlock();
    app.prefs.sound = !app.prefs.sound;
    sound.setEnabled(app.prefs.sound);
    prefsSave(app.prefs);
    sound.click();
    appHud();
  });
  $('info-btn').addEventListener('click', () => { sound.unlock(); sound.click(); appPaytable(); });
  $('attract-info').addEventListener('click', () => { sound.unlock(); appPaytable(); });
  $('staff-btn').addEventListener('click', () => {
    sound.unlock();
    if (app.busy) return;
    app.auto = false;
    openStaff(appApi);
  });
  document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !document.querySelector('.overlay')) { e.preventDefault(); appSpin(true); }
  });
  addEventListener('resize', () => appLayout());
  if (globalThis.ResizeObserver) new ResizeObserver(() => appLayout()).observe($('stage'));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => appLayout());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function appStart() {
  document.documentElement.style.setProperty('--deco', 'url("' + DECO_PATTERN_URL + '")');
  document.documentElement.style.setProperty('--crest', 'url("' + symbolUrl(WILD) + '")');
  uiInit($('overlays'));
  reels = new Reels($('reels'), $('lines'));
  fx = new Fx($('fx'));
  appBuildMarkers();
  appBind();
  appLayout();
  const s = app.session;
  let grid = s && s.lastGrid;
  if (!grid) grid = buildGrid('NONE', 'base', null).grid;
  reels.setGrid(grid);
  try { ledgerPrune(new Date(), app.cfg); } catch (e) { /* */ }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  $('bar-name').textContent = app.cfg.barName;
  appHud();
  setInterval(appAttractTick, 9000);
  if (!isConfigured(app.cfg)) {
    runSetup(appApi).then(() => { $('bar-name').textContent = app.cfg.barName; appAdvance(); });
  } else {
    appAdvance();
  }
}

export function appSetBarName(n) { $('bar-name').textContent = n; }
