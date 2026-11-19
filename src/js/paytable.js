// Tabella simboli, linee e vincite. Unica fonte di verità per motore, grafica e regolamento.

export const SYM = Object.freeze({
  LIME: 0, ARANCIA: 1, CILIEGIA: 2, GHIACCIO: 3,
  SHAKER: 4, COPPA: 5, ELISIR: 6, MAESTRO: 7, GRIMORIO: 8,
});
export const WILD = SYM.GRIMORIO;
export const NUM_SYMBOLS = 9;
export const REELS = 5;
export const ROWS = 3;

export const SYMBOLS = [
  { id: 0, key: 'lime', name: 'Lime', tier: 'low' },
  { id: 1, key: 'arancia', name: 'Arancia', tier: 'low' },
  { id: 2, key: 'ciliegia', name: 'Ciliegia', tier: 'low' },
  { id: 3, key: 'ghiaccio', name: 'Ghiaccio', tier: 'low' },
  { id: 4, key: 'shaker', name: 'Shaker', tier: 'mid' },
  { id: 5, key: 'coppa', name: 'Coppa Martini', tier: 'mid' },
  { id: 6, key: 'elisir', name: "Elisir d'Oro", tier: 'high' },
  { id: 7, key: 'maestro', name: 'Il Maestro', tier: 'top' },
  { id: 8, key: 'grimorio', name: 'Il Grimorio', tier: 'special' },
];

// 10 linee (riga 0 = alto, 1 = centro, 2 = basso), una riga per rullo.
export const LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 2, 1, 0, 1],
];
export const LINE_COLORS = [
  '#ffd54a', '#ff5d73', '#4fc3f7', '#9ccc65', '#ce93d8',
  '#ffab40', '#80deea', '#f48fb1', '#b39ddb', '#fff176',
];

// Esiti possibili di un singolo giro.
// value = valore del premio espresso in "drink medi" (D) al prezzo di listino.
export const OUTCOMES = {
  NONE: { id: 'NONE', kind: 'none', label: 'Nessuna vincita', value: 0 },
  X1: { id: 'X1', kind: 'spins', spins: 1, label: '+1 Giro', value: 0 },
  X2: { id: 'X2', kind: 'spins', spins: 2, label: '+2 Giri', value: 0 },
  X3: { id: 'X3', kind: 'spins', spins: 3, label: '+3 Giri', value: 0 },
  BONUS: { id: 'BONUS', kind: 'bonus', label: 'Giri Bonus', value: 0 },
  RETRIG: { id: 'RETRIG', kind: 'retrigger', label: 'Giri Bonus extra', value: 0 },
  P10: { id: 'P10', kind: 'prize', label: 'Sconto 10%', desc: 'sulla prossima consumazione (1 drink)', value: 0.1, tier: 1, convertible: true },
  P20: { id: 'P20', kind: 'prize', label: 'Sconto 20%', desc: 'sulla prossima consumazione (1 drink)', value: 0.2, tier: 2, convertible: true },
  DRINK: { id: 'DRINK', kind: 'prize', label: 'Drink Omaggio', desc: '1 drink a scelta dal menu', value: 1, tier: 3, convertible: true },
  C10: { id: 'C10', kind: 'prize', label: '10 Cocktail', desc: 'tessera da 10 cocktail', value: 10, tier: 4, card: true, uses: 10 },
  C100: { id: 'C100', kind: 'prize', label: '100 Cocktail', desc: 'tessera da 100 cocktail', value: 100, tier: 5, card: true, uses: 100 },
};
export const PRIZES = ['P10', 'P20', 'DRINK', 'C10', 'C100'];
export const SPIN_OUTCOMES = ['X1', 'X2', 'X3'];
export const BASE_OUTCOMES = ['X1', 'X2', 'X3', 'BONUS', 'P10', 'P20', 'DRINK', 'C10', 'C100'];
export const BONUS_MODE_OUTCOMES = ['RETRIG', 'P10', 'P20', 'DRINK', 'C10', 'C100'];

export function isPrize(o) { return PRIZES.includes(o); }

// Se un premio non è disponibile (tetto raggiunto) scende al premio inferiore.
export function downgrade(o) {
  const i = PRIZES.indexOf(o);
  if (i <= 0) return 'NONE';
  return PRIZES[i - 1];
}

// Vincite su linea (da sinistra, rulli adiacenti, il Grimorio sostituisce tutti i simboli).
const LOW = { 3: 'X1', 4: 'X2', 5: 'X3' };
const MID = { 3: 'P10', 4: 'P20', 5: 'DRINK' };
export const PAY = {
  [SYM.LIME]: LOW,
  [SYM.ARANCIA]: LOW,
  [SYM.CILIEGIA]: LOW,
  [SYM.GHIACCIO]: LOW,
  [SYM.SHAKER]: MID,
  [SYM.COPPA]: MID,
  [SYM.ELISIR]: { 3: 'P20', 4: 'DRINK', 5: 'C10' },
  [SYM.MAESTRO]: { 3: 'DRINK', 4: 'C10', 5: 'C100' },
};

// Nei Giri Bonus il Simbolo Speciale si espande e paga su rulli anche non adiacenti.
export const EXPAND_PAY = { 3: 'P10', 4: 'P20', 5: 'DRINK' };
export const SPECIAL_CANDIDATES = [SYM.LIME, SYM.ARANCIA, SYM.CILIEGIA, SYM.GHIACCIO, SYM.SHAKER, SYM.COPPA];

// Combinazioni su linea che rappresentano ciascun esito: { outcome: [[simbolo, quantità], ...] }
export const LINE_REPS = (() => {
  const reps = {};
  for (const s of Object.keys(PAY)) {
    for (const n of [3, 4, 5]) {
      const o = PAY[s][n];
      (reps[o] = reps[o] || []).push([Number(s), n]);
    }
  }
  return reps;
})();

// Frequenza grafica dei simboli di riempimento (solo estetica: l'esito è già deciso).
export const FILLER_WEIGHTS = [15, 15, 15, 15, 9, 9, 7, 5, 3];
