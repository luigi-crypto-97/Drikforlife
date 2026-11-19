// Profili di generosità. Il profilo "bilanciato" è tarato a mano; gli altri due
// scalano solo i premi piccoli (sconti e drink omaggio): 10 e 100 cocktail
// restano rarissimi in ogni profilo.

import { analyze } from './math.js';

const PRESET_BALANCED = {
  base: { X1: 8000000, X2: 3000000, X3: 1000000, BONUS: 900000, P10: 1200000, P20: 400000, DRINK: 70000, C10: 1300, C100: 20 },
  bonus: { RETRIG: 400000, P10: 4500000, P20: 1600000, DRINK: 450000, C10: 6000, C100: 100 },
};

const PRESET_SMALL = ['P10', 'P20', 'DRINK'];
const PRESET_REF_CFG = { spinsPerDrink: 10, bonusSpins: 10, retriggerSpins: 10, conversionEta: 0.75 };

function presetScaleSmall(preset, k) {
  const scale = (w) => {
    const out = { ...w };
    for (const o of PRESET_SMALL) if (o in out) out[o] = Math.round(out[o] * k);
    return out;
  };
  return { base: scale(preset.base), bonus: scale(preset.bonus) };
}

function presetForTarget(targetPct) {
  const full = analyze(PRESET_BALANCED, PRESET_REF_CFG).costPct;
  const fixed = analyze(presetScaleSmall(PRESET_BALANCED, 0), PRESET_REF_CFG).costPct;
  const k = (targetPct - fixed) / (full - fixed);
  return presetScaleSmall(PRESET_BALANCED, k);
}

export const PRESETS = {
  prudente: { label: 'Prudente', target: 3, ...presetForTarget(3) },
  bilanciato: { label: 'Bilanciato', target: 5, ...PRESET_BALANCED },
  generoso: { label: 'Generoso', target: 8, ...presetForTarget(8) },
};
export const PRESET_KEYS = ['prudente', 'bilanciato', 'generoso'];
