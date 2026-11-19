// Effetti sonori sintetizzati con Web Audio (nessun file audio esterno).

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.7;
    this.loop = null;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        this.applyVolume();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  }

  applyVolume() {
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.02);
  }

  setEnabled(on) { this.enabled = on; this.applyVolume(); }
  setVolume(v) { this.volume = v; this.applyVolume(); }

  get ok() { return !!(this.ctx && this.enabled); }
  get now() { return this.ctx.currentTime; }

  tone(freq, t0, dur, o = {}) {
    if (!this.ok) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const peak = o.gain == null ? 0.18 : o.gain;
    const a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + (o.release || 0.08));
    osc.connect(g);
    g.connect(o.dest || this.master);
    osc.start(t0);
    osc.stop(t0 + dur + (o.release || 0.08) + 0.02);
  }

  noise(t0, dur, o = {}) {
    if (!this.ok) return;
    const c = this.ctx;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.slideTo) f.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    const peak = o.gain == null ? 0.2 : o.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest || this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  chord(freqs, t0, dur, o = {}) { for (const f of freqs) this.tone(f, t0, dur, o); }

  click() {
    if (!this.ok) return;
    const t = this.now;
    this.tone(1800, t, 0.03, { type: 'triangle', gain: 0.08 });
  }

  spinStart(seconds) {
    if (!this.ok) return;
    const t = this.now;
    this.noise(t, 0.35, { freq: 400, slideTo: 2400, q: 0.8, gain: 0.12 });
    this.tone(220, t, 0.25, { type: 'triangle', slideTo: 440, gain: 0.06 });
    this.stopLoop();
    const g = this.ctx.createGain();
    g.gain.value = 1;
    g.connect(this.master);
    this.loop = g;
    const step = 0.075;
    for (let x = 0.12; x < seconds; x += step) {
      this.noise(t + x, 0.03, { freq: 2600, q: 3, gain: 0.05, dest: g });
    }
  }

  stopLoop() {
    if (this.loop && this.ctx) {
      try { this.loop.gain.setTargetAtTime(0, this.now, 0.01); } catch (e) { /* */ }
      const l = this.loop;
      setTimeout(() => { try { l.disconnect(); } catch (e) { /* */ } }, 400);
    }
    this.loop = null;
  }

  reelStop(i) {
    if (!this.ok) return;
    const t = this.now;
    this.tone(140 - i * 6, t, 0.09, { type: 'sine', gain: 0.32, slideTo: 70 });
    this.noise(t, 0.06, { freq: 900, q: 1.5, gain: 0.12 });
  }

  bookLand(n) {
    if (!this.ok) return;
    const t = this.now;
    const base = [659.25, 783.99, 987.77, 1174.66, 1318.5][Math.min(n, 4)];
    this.tone(base, t, 0.5, { type: 'triangle', gain: 0.14 });
    this.tone(base * 2, t + 0.02, 0.4, { type: 'sine', gain: 0.06 });
  }

  anticipation(seconds) {
    if (!this.ok) return;
    const t = this.now;
    this.tone(196, t, seconds, { type: 'sawtooth', slideTo: 587, gain: 0.035, attack: 0.2 });
    this.tone(294, t, seconds, { type: 'triangle', slideTo: 880, gain: 0.04, attack: 0.2 });
  }

  extraSpin() {
    if (!this.ok) return;
    const t = this.now;
    [784, 988, 1175].forEach((f, i) => this.tone(f, t + i * 0.07, 0.12, { type: 'square', gain: 0.05 }));
  }

  win(tier) {
    if (!this.ok) return;
    const t = this.now;
    const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093];
    const n = 3 + tier * 2;
    for (let i = 0; i < n; i++) {
      const f = scale[i % scale.length] * (i >= scale.length ? 2 : 1);
      this.tone(f, t + i * 0.08, 0.22, { type: 'triangle', gain: 0.12 });
      this.tone(f * 1.5, t + i * 0.08, 0.18, { type: 'sine', gain: 0.04 });
    }
    const end = t + n * 0.08;
    this.chord([523.25, 659.25, 783.99, 1046.5], end, 0.6 + tier * 0.25, { type: 'triangle', gain: 0.07 });
    if (tier >= 3) {
      this.chord([392, 493.88, 587.33, 783.99], end + 0.7, 1.2, { type: 'sawtooth', gain: 0.03, attack: 0.05 });
      this.chord([523.25, 659.25, 783.99, 1046.5, 1318.5], end + 1.5, 1.8, { type: 'triangle', gain: 0.08 });
      for (let i = 0; i < 24; i++) this.tone(2000 + Math.random() * 2500, end + Math.random() * 3, 0.08, { type: 'sine', gain: 0.035 });
    }
  }

  bonusFanfare() {
    if (!this.ok) return;
    const t = this.now;
    const seq = [392, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => this.tone(f, t + i * 0.12, 0.2, { type: 'sawtooth', gain: 0.05 }));
    seq.forEach((f, i) => this.tone(f, t + i * 0.12, 0.25, { type: 'triangle', gain: 0.1 }));
    this.chord([523.25, 659.25, 783.99, 1046.5], t + seq.length * 0.12, 1.4, { type: 'triangle', gain: 0.08 });
  }

  pageFlip() {
    if (!this.ok) return;
    this.noise(this.now, 0.16, { type: 'highpass', freq: 1800, gain: 0.12, attack: 0.02 });
  }

  reveal() {
    if (!this.ok) return;
    const t = this.now;
    this.noise(t, 0.8, { freq: 800, slideTo: 6000, q: 0.7, gain: 0.08 });
    this.chord([587.33, 739.99, 880, 1174.66], t + 0.1, 1.2, { type: 'triangle', gain: 0.08 });
    for (let i = 0; i < 10; i++) this.tone(1800 + i * 160, t + 0.05 * i, 0.12, { type: 'sine', gain: 0.04 });
  }

  expand() {
    if (!this.ok) return;
    const t = this.now;
    this.noise(t, 0.5, { freq: 300, slideTo: 3200, q: 1.2, gain: 0.12 });
    this.tone(330, t, 0.45, { type: 'triangle', slideTo: 990, gain: 0.08 });
  }

  lose() {
    if (!this.ok) return;
    const t = this.now;
    this.tone(330, t, 0.18, { type: 'triangle', gain: 0.05 });
    this.tone(262, t + 0.16, 0.3, { type: 'triangle', gain: 0.05 });
  }
}
