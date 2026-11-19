// Particelle a schermo intero (scintille, coriandoli, bollicine, fuochi d'artificio).
// Solo estetica: usa Math.random, non influisce sui risultati.

const FX_GOLD = ['#fff3c4', '#ffd76a', '#e2b13c', '#ffe9a3', '#ffffff'];
const FX_PARTY = ['#ffd54a', '#ff5d73', '#4fc3f7', '#9ccc65', '#ce93d8', '#ffab40', '#ffffff'];

export class Fx {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.p = [];
    this.running = false;
    this.emitters = [];
    this.dpr = 1;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.w = this.c.clientWidth || globalThis.innerWidth;
    this.h = this.c.clientHeight || globalThis.innerHeight;
    this.c.width = Math.round(this.w * this.dpr);
    this.c.height = Math.round(this.h * this.dpr);
  }

  add(p) {
    if (this.p.length > 900) return;
    this.p.push(p);
    this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  rnd(a, b) { return a + Math.random() * (b - a); }
  pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  burst(x, y, o = {}) {
    const n = o.count || 40;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = this.rnd(o.min || 120, o.max || 520);
      this.add({
        type: o.type || 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
        g: o.gravity == null ? 380 : o.gravity, life: 0, max: this.rnd(0.6, o.life || 1.4),
        size: this.rnd(o.sizeMin || 2, o.sizeMax || 5), color: this.pick(o.colors || FX_GOLD),
        rot: Math.random() * 6, vr: this.rnd(-8, 8), drag: o.drag || 0.985,
      });
    }
  }

  // Emettitore continuo per una durata (secondi).
  emit(kind, seconds) {
    this.emitters.push({ kind, until: performance.now() + seconds * 1000, acc: 0 });
    this.start();
  }

  spawn(kind, dt) {
    const W = this.w, H = this.h;
    if (kind === 'confetti') {
      for (let i = 0; i < Math.ceil(dt * 120); i++) {
        this.add({ type: 'confetti', x: this.rnd(0, W), y: -20, vx: this.rnd(-60, 60), vy: this.rnd(120, 260), g: 60,
          life: 0, max: this.rnd(3, 5), size: this.rnd(6, 12), color: this.pick(FX_PARTY), rot: Math.random() * 6, vr: this.rnd(-6, 6), drag: 0.995 });
      }
    } else if (kind === 'gold') {
      for (let i = 0; i < Math.ceil(dt * 90); i++) {
        this.add({ type: 'star', x: this.rnd(0, W), y: -20, vx: this.rnd(-30, 30), vy: this.rnd(160, 340), g: 120,
          life: 0, max: this.rnd(2.5, 4), size: this.rnd(5, 11), color: this.pick(FX_GOLD), rot: Math.random() * 6, vr: this.rnd(-4, 4), drag: 0.995 });
      }
    } else if (kind === 'bubbles') {
      for (let i = 0; i < Math.ceil(dt * 50); i++) {
        this.add({ type: 'bubble', x: this.rnd(0, W), y: H + 20, vx: this.rnd(-15, 15), vy: this.rnd(-260, -120), g: -20,
          life: 0, max: this.rnd(3, 6), size: this.rnd(4, 14), color: '#fff3c4', rot: 0, vr: 0, drag: 0.998, wob: Math.random() * 6 });
      }
    } else if (kind === 'fireworks') {
      if (Math.random() < dt * 2.4) {
        this.burst(this.rnd(W * 0.15, W * 0.85), this.rnd(H * 0.12, H * 0.5),
          { count: 70, colors: [this.pick(FX_PARTY), '#fff3c4'], min: 80, max: 360, gravity: 160, life: 1.8, sizeMin: 2, sizeMax: 4 });
      }
    } else if (kind === 'magic') {
      for (let i = 0; i < Math.ceil(dt * 25); i++) {
        this.add({ type: 'spark', x: this.rnd(0, W), y: this.rnd(H * 0.2, H), vx: this.rnd(-20, 20), vy: this.rnd(-60, -20), g: 0,
          life: 0, max: this.rnd(1.5, 3), size: this.rnd(1.5, 3.5), color: this.pick(['#b388ff', '#80deea', '#fff3c4']), rot: 0, vr: 0, drag: 1 });
      }
    }
  }

  clear() { this.p = []; this.emitters = []; }

  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const now = performance.now();
    this.emitters = this.emitters.filter((e) => e.until > now);
    for (const e of this.emitters) this.spawn(e.kind, dt);

    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    const alive = [];
    for (const p of this.p) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > this.h + 40 || p.y < -60) { if (p.type !== 'confetti' && p.type !== 'star') continue; }
      alive.push(p);
      const k = 1 - p.life / p.max;
      g.globalAlpha = Math.min(1, k * 1.6);
      if (p.type === 'spark') {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = p.color;
        g.beginPath(); g.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2); g.fill();
        g.globalAlpha *= 0.35;
        g.beginPath(); g.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
      } else if (p.type === 'confetti') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.rot * 1.7));
        g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore();
      } else if (p.type === 'star') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color;
        g.shadowColor = '#ffd76a'; g.shadowBlur = 10;
        const s = p.size;
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? s : s * 0.38;
          const a = (i * Math.PI) / 4;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath(); g.fill(); g.restore();
      } else if (p.type === 'bubble') {
        p.x += Math.sin(p.life * 3 + p.wob) * 0.6;
        g.strokeStyle = 'rgba(255,243,196,.75)'; g.lineWidth = 1.2;
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)';
        g.beginPath(); g.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.25, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
    this.p = alive;
    if (this.p.length || this.emitters.length) requestAnimationFrame((tt) => this.frame(tt));
    else { this.running = false; g.clearRect(0, 0, this.w, this.h); }
  }
}
