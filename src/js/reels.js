// Rulli: rendering DOM e animazione (accelerazione, corsa, frenata con rimbalzo, suspense).
// La griglia finale è già decisa dal motore: qui c'è solo la messa in scena.

import { REELS, ROWS, FILLER_WEIGHTS, LINES, LINE_COLORS, WILD } from './paytable.js';
import { symbolUrl } from './symbols.js';

function reelRandomSym(extraWeight) {
  const ws = FILLER_WEIGHTS.slice();
  if (extraWeight) for (const [s, w] of extraWeight) ws[s] += w;
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) { if (r < ws[i]) return i; r -= ws[i]; }
  return 0;
}

function easeOutBack(x, c1) {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export class Reels {
  constructor(root, linesSvg) {
    this.root = root;
    this.linesSvg = linesSvg;
    this.cell = 100;
    this.grid = null;
    this.reels = [];
    this.speed = 1;
    this.spinning = false;
    this.done = Promise.resolve();
    for (let r = 0; r < REELS; r++) {
      const reel = document.createElement('div');
      reel.className = 'reel';
      const strip = document.createElement('div');
      strip.className = 'strip';
      reel.appendChild(strip);
      root.appendChild(reel);
      this.reels.push({ el: reel, strip, cells: [] });
    }
  }

  setCellSize(px) {
    this.cell = px;
    if (!this.spinning) for (const r of this.reels) r.strip.style.transform = 'translate3d(0,' + -px + 'px,0)';
  }

  makeCell(sym) {
    const c = document.createElement('div');
    c.className = 'cell' + (sym === WILD ? ' is-book' : '');
    const s = document.createElement('div');
    s.className = 'sym';
    s.style.backgroundImage = 'url("' + symbolUrl(sym) + '")';
    c.appendChild(s);
    return c;
  }

  // Mostra una griglia ferma: [pre, riga0, riga1, riga2]
  setGrid(grid) {
    this.grid = grid.map((c) => c.slice());
    for (let r = 0; r < REELS; r++) {
      const R = this.reels[r];
      R.strip.textContent = '';
      R.strip.appendChild(this.makeCell(reelRandomSym()));
      R.cells = [];
      for (let row = 0; row < ROWS; row++) {
        const c = this.makeCell(grid[r][row]);
        R.cells.push(c);
        R.strip.appendChild(c);
      }
      R.strip.style.transform = 'translate3d(0,' + -this.cell + 'px,0)';
      R.strip.classList.remove('blur');
    }
  }

  cellEl(r, row) { return this.reels[r].cells[row]; }

  quickStop() { if (this.spinning) this.speed = 4; }

  // opts: { turbo, special, onReelStop(r), onAnticipate(r, seconds) }
  spin(finalGrid, opts = {}) {
    this.clearEffects();
    const h = this.cell;
    const turbo = !!opts.turbo;
    const v = (turbo ? 44 : 30) * h; // px/s
    const ta = turbo ? 0.12 : 0.18;
    const td = turbo ? 0.26 : 0.42;
    const c1 = 1.15;
    const ld = (v * td) / (c1 + 3);
    const la = 0.5 * v * ta;
    const first = turbo ? 0.42 : 0.85;
    const stagger = turbo ? 0.1 : 0.24;
    const anticip = turbo ? 0.7 : 1.5;
    const extra = opts.special != null ? [[opts.special, 10]] : null;

    // suspense: con 2 Grimori (o 2 rulli col Simbolo Speciale) i rulli successivi rallentano
    const antic = [];
    let books = 0, specials = 0, add = 0;
    const plan = [];
    for (let r = 0; r < REELS; r++) {
      const willAntic = books >= 2 || (opts.special != null && specials >= 2);
      if (willAntic) add += anticip;
      antic.push(willAntic);
      plan.push(first + r * stagger + add);
      if (finalGrid[r].includes(WILD)) books++;
      if (opts.special != null && finalGrid[r].includes(opts.special)) specials++;
    }

    const states = [];
    for (let r = 0; r < REELS; r++) {
      const R = this.reels[r];
      const T = plan[r];
      const tcWanted = Math.max(0.05, T - ta - td);
      let K = Math.round((la + v * tcWanted + ld) / h) - 3;
      K = Math.max(K, Math.ceil((la + ld) / h) - 2, 4);
      const D = (K + 3) * h;
      const lc = D - la - ld;
      const tc = lc / v;
      const current = this.grid ? this.grid[r] : [0, 1, 2];
      R.strip.textContent = '';
      R.strip.appendChild(this.makeCell(reelRandomSym(extra)));
      const finals = [];
      for (let row = 0; row < ROWS; row++) {
        const c = this.makeCell(finalGrid[r][row]);
        finals.push(c);
        R.strip.appendChild(c);
      }
      for (let i = 0; i < K; i++) R.strip.appendChild(this.makeCell(reelRandomSym(extra)));
      for (let row = 0; row < ROWS; row++) R.strip.appendChild(this.makeCell(current[row]));
      const y0 = -(4 + K) * h;
      R.strip.style.transform = 'translate3d(0,' + y0 + 'px,0)';
      states.push({ R, y0, D, la, lc, ld, ta, tc, td, done: false, blur: false, finals, antic: antic[r], anticShown: false });
    }

    this.spinning = true;
    this.speed = 1;
    let clock = 0;
    let last = performance.now();
    this.done = new Promise((resolve) => {
      const frame = (now) => {
        clock += Math.min(0.05, (now - last) / 1000) * this.speed;
        last = now;
        let allDone = true;
        for (let r = 0; r < REELS; r++) {
          const st = states[r];
          if (st.done) continue;
          allDone = false;
          const t = clock;
          let s;
          let blur = false;
          if (t < st.ta) { s = 0.5 * (v / st.ta) * t * t; blur = t > st.ta * 0.5; }
          else if (t < st.ta + st.tc) { s = st.la + v * (t - st.ta); blur = true; }
          else if (t < st.ta + st.tc + st.td) {
            const x = (t - st.ta - st.tc) / st.td;
            s = st.la + st.lc + st.ld * easeOutBack(x, c1);
            blur = x < 0.25;
          } else {
            s = st.D;
            st.done = true;
          }
          if (st.antic && !st.anticShown && r > 0 && states[r - 1].done) {
            st.anticShown = true;
            st.R.el.classList.add('anticipate');
            if (opts.onAnticipate) opts.onAnticipate(r, anticip);
          }
          if (blur !== st.blur) { st.blur = blur; st.R.strip.classList.toggle('blur', blur); }
          st.R.strip.style.transform = 'translate3d(0,' + (st.y0 + s) + 'px,0)';
          if (st.done) {
            st.R.el.classList.remove('anticipate');
            st.R.strip.classList.remove('blur');
            // compatta la striscia mantenendo la stessa posizione visiva
            const pre = st.R.strip.firstChild;
            st.R.strip.textContent = '';
            st.R.strip.appendChild(pre);
            for (const c of st.finals) st.R.strip.appendChild(c);
            st.R.strip.style.transform = 'translate3d(0,' + -h + 'px,0)';
            st.R.cells = st.finals;
            if (opts.onReelStop) opts.onReelStop(r, finalGrid[r]);
          }
        }
        if (!allDone) requestAnimationFrame(frame);
        else {
          this.spinning = false;
          this.speed = 1;
          this.grid = finalGrid.map((c) => c.slice());
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
    return this.done;
  }

  // ---------- presentazione vincite ----------
  clearEffects() {
    this.root.classList.remove('dim');
    for (const R of this.reels) {
      R.el.classList.remove('anticipate');
      for (const c of R.cells) c.classList.remove('win');
      R.el.querySelectorAll('.expand').forEach((e) => e.remove());
    }
    if (this.linesSvg) this.linesSvg.textContent = '';
    document.querySelectorAll('.line-marker.on').forEach((m) => m.classList.remove('on'));
  }

  highlight(cells) {
    this.root.classList.add('dim');
    for (const [r, row] of cells) {
      const c = this.cellEl(r, row);
      if (c) c.classList.add('win');
    }
  }

  drawLine(li) {
    if (!this.linesSvg) return;
    const line = LINES[li];
    const pts = [[0, line[0] + 0.5]];
    for (let r = 0; r < REELS; r++) pts.push([r + 0.5, line[r] + 0.5]);
    pts.push([REELS, line[REELS - 1] + 0.5]);
    const d = pts.map((p) => p[0] * 100 + ',' + p[1] * 100).join(' ');
    const color = LINE_COLORS[li];
    const ns = 'http://www.w3.org/2000/svg';
    for (const [w, op, cls] of [[16, 0.25, 'glow'], [6, 1, 'core']]) {
      const pl = document.createElementNS(ns, 'polyline');
      pl.setAttribute('points', d);
      pl.setAttribute('fill', 'none');
      pl.setAttribute('stroke', cls === 'core' ? color : '#fff3c4');
      pl.setAttribute('stroke-width', String(w));
      pl.setAttribute('stroke-opacity', String(op));
      pl.setAttribute('stroke-linecap', 'round');
      pl.setAttribute('stroke-linejoin', 'round');
      pl.setAttribute('class', 'win-line ' + cls);
      this.linesSvg.appendChild(pl);
    }
    document.querySelectorAll('.line-marker[data-line="' + li + '"]').forEach((m) => m.classList.add('on'));
  }

  // Espansione del Simbolo Speciale sull'intero rullo.
  expand(reels, special, grid) {
    const ps = [];
    for (const r of reels) {
      const R = this.reels[r];
      const row = grid[r].indexOf(special);
      const ov = document.createElement('div');
      ov.className = 'expand';
      for (let i = 0; i < ROWS; i++) {
        const s = document.createElement('div');
        s.className = 'sym';
        s.style.backgroundImage = 'url("' + symbolUrl(special) + '")';
        ov.appendChild(s);
      }
      const top = (row / ROWS) * 100;
      const bottom = ((ROWS - 1 - row) / ROWS) * 100;
      ov.style.clipPath = 'inset(' + top + '% 0 ' + bottom + '% 0)';
      R.el.appendChild(ov);
      ps.push(new Promise((res) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          ov.classList.add('open');
          ov.style.clipPath = 'inset(0% 0 0% 0)';
          setTimeout(res, 650);
        }));
      }));
    }
    return Promise.all(ps);
  }
}
