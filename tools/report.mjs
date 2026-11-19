// Tabelle matematiche dei profili, in Markdown. Uso: node tools/report.mjs
import { analyze, maxPrizeValueFromCaps } from '../src/js/math.js';
import { PRESETS, PRESET_KEYS } from '../src/js/presets.js';
import { DEFAULT_CONFIG } from '../src/js/store.js';
import { OUTCOMES, PRIZES } from '../src/js/paytable.js';

const cfg = DEFAULT_CONFIG;
const oneIn = (p) => '1 ogni ' + (1 / p >= 100 ? Math.round(1 / p).toLocaleString('it-IT') : (1 / p).toFixed(1).replace('.', ','));
console.log('| Premio | ' + PRESET_KEYS.map((k) => PRESETS[k].label).join(' | ') + ' |');
console.log('|---|' + PRESET_KEYS.map(() => '---').join('|') + '|');
const an = Object.fromEntries(PRESET_KEYS.map((k) => [k, analyze(PRESETS[k], cfg)]));
for (const p of PRIZES) console.log('| ' + OUTCOMES[p].label + ' | ' + PRESET_KEYS.map((k) => oneIn(an[k].perDrink[p]) + ' drink').join(' | ') + ' |');
console.log('| Giri Bonus | ' + PRESET_KEYS.map((k) => oneIn(an[k].bonusPerDrink) + ' drink').join(' | ') + ' |');
console.log('| **Valore medio premi / prezzo drink** | ' + PRESET_KEYS.map((k) => '**' + an[k].costPct.toFixed(2).replace('.', ',') + '%**').join(' | ') + ' |');
console.log('| Rigioca (Sconto 10% / 20% / Drink) | ' + PRESET_KEYS.map((k) => ['P10', 'P20', 'DRINK'].map((p) => an[k].conversion[p].spins).join(' / ') + ' giri').join(' | ') + ' |');
const m = maxPrizeValueFromCaps(cfg.caps);
console.log('\nTetti predefiniti: ' + PRIZES.map((p) => OUTCOMES[p].label + ' max ' + m.perYear[p] + '/anno').join(' · ') + ' · montepremi massimo teorico ' + m.totalD.toLocaleString('it-IT') + ' drink.');
