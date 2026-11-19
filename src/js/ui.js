// Piccoli componenti di interfaccia: overlay, scelte, tastierino PIN, avvisi.

export function h(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let uiOverlayRoot = null;
export function uiInit(root) { uiOverlayRoot = root; }

export function openOverlay(content, opts = {}) {
  const ov = h('div', { class: 'overlay ' + (opts.cls || '') });
  const panel = h('div', { class: 'panel ' + (opts.panelCls || '') });
  if (content) panel.appendChild(content);
  ov.appendChild(panel);
  uiOverlayRoot.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    ov.classList.remove('show');
    ov.classList.add('hide');
    setTimeout(() => ov.remove(), 260);
  };
  if (opts.backdropClose) ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  return { ov, panel, close };
}

// Overlay con pulsanti: restituisce il valore del pulsante premuto.
export function choose(content, buttons, opts = {}) {
  return new Promise((resolve) => {
    const bar = h('div', { class: 'actions' });
    const o = openOverlay(h('div', null, content, bar), opts);
    let timer = null;
    const done = (v) => { if (timer) clearTimeout(timer); o.close(); resolve(v); };
    for (const b of buttons) {
      bar.appendChild(h('button', { class: 'btn ' + (b.cls || ''), type: 'button', onclick: () => done(b.value) }, b.label));
    }
    if (opts.autoMs) timer = setTimeout(() => done(opts.autoValue), opts.autoMs);
  });
}

export function toast(msg, ms = 2600) {
  const t = h('div', { class: 'toast' }, msg);
  uiOverlayRoot.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

// Tastierino numerico. Restituisce la stringa digitata o null se annullato.
export function askPin(title, opts = {}) {
  return new Promise((resolve) => {
    let val = '';
    const max = opts.max || 8;
    const dots = h('div', { class: 'pin-dots' });
    const msg = h('div', { class: 'pin-msg' }, opts.message || '');
    const render = () => {
      dots.textContent = '';
      for (let i = 0; i < Math.max(4, val.length); i++) dots.appendChild(h('span', { class: i < val.length ? 'on' : '' }));
    };
    const pad = h('div', { class: 'keypad' });
    const o = openOverlay(h('div', { class: 'pin-box' }, h('h2', null, title), dots, msg, pad), { panelCls: 'panel-pin' });
    const finish = (v) => { o.close(); resolve(v); };
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'esc', '0', 'ok'];
    for (const k of keys) {
      const label = k === 'esc' ? 'Annulla' : k === 'ok' ? 'OK' : k;
      pad.appendChild(h('button', {
        type: 'button', class: 'key key-' + k,
        onclick: () => {
          if (k === 'esc') return finish(null);
          if (k === 'ok') return val.length >= (opts.min || 4) ? finish(val) : (msg.textContent = 'Inserisci almeno ' + (opts.min || 4) + ' cifre');
          if (val.length < max) { val += k; render(); }
        },
      }, label));
    }
    render();
  });
}

export function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function euro(n) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export function oneIn(p) {
  if (!(p > 0)) return '—';
  const n = 1 / p;
  if (n < 10) return '1 ogni ' + n.toFixed(1).replace('.', ',');
  return '1 ogni ' + Math.round(n).toLocaleString('it-IT');
}
