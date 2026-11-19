import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, WEIGHT_TOTAL, maxPrizeValueFromCaps } from '../src/js/math.js';
import { PRESETS, PRESET_KEYS } from '../src/js/presets.js';
import { DEFAULT_CONFIG } from '../src/js/store.js';

const cfg = DEFAULT_CONFIG;

test('profili: costo atteso per drink nel target', () => {
  const a = analyze(PRESETS.bilanciato, cfg);
  assert.ok(a.costPct > 4.5 && a.costPct <= 5.0, 'bilanciato ' + a.costPct);
  assert.ok(Math.abs(analyze(PRESETS.prudente, cfg).costPct - 3) < 0.05);
  assert.ok(Math.abs(analyze(PRESETS.generoso, cfg).costPct - 8) < 0.05);
});

test('profili: premi alti rarissimi, sconti frequenti', () => {
  for (const k of PRESET_KEYS) {
    const a = analyze(PRESETS[k], cfg);
    assert.ok(a.perDrink.C100 < 1 / 150000, k + ' C100 1 su ' + 1 / a.perDrink.C100);
    assert.ok(a.perDrink.C10 < 1 / 3000, k + ' C10 1 su ' + 1 / a.perDrink.C10);
    assert.ok(a.perDrink.P10 > a.perDrink.P20 && a.perDrink.P20 > a.perDrink.DRINK && a.perDrink.DRINK > a.perDrink.C10);
  }
});

test('profili: pesi interi e somma entro il 100%', () => {
  for (const k of PRESET_KEYS) {
    for (const mode of ['base', 'bonus']) {
      const w = PRESETS[k][mode];
      let s = 0;
      for (const v of Object.values(w)) { assert.ok(Number.isInteger(v) && v >= 0); s += v; }
      assert.ok(s < WEIGHT_TOTAL);
    }
  }
});

test('conversione premio -> Giri Bonus: sempre svantaggiosa per il cliente in valore atteso', () => {
  for (const k of PRESET_KEYS) {
    for (const eta of [0.5, 0.75, 0.9]) {
      const a = analyze(PRESETS[k], { ...cfg, conversionEta: eta });
      for (const [p, c] of Object.entries(a.conversion)) {
        assert.ok(c.spins >= 1, k + ' ' + p);
        assert.ok(c.evRatio <= eta + 1e-9, k + ' ' + p + ' ' + c.evRatio);
      }
    }
  }
});

test('tetti: montepremi massimo annuo calcolabile', () => {
  const m = maxPrizeValueFromCaps(cfg.caps);
  assert.equal(m.perYear.C100, 1);
  assert.equal(m.perYear.C10, 12);
  assert.ok(Number.isFinite(m.totalD));
});
