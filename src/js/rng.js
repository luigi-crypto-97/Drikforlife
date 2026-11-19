// Generatore casuale crittografico (Web Crypto). Usato per OGNI decisione di gioco.
// Nessun Math.random() nel motore: solo crypto.getRandomValues + rejection sampling,
// quindi distribuzione uniforme esatta (nessun bias da modulo).

const RNG_TWO32 = 4294967296;
const RNG_BUF_SIZE = 1024;
const rngBuf = new Uint32Array(RNG_BUF_SIZE);
let rngIdx = RNG_BUF_SIZE;

function rngRefill() {
  globalThis.crypto.getRandomValues(rngBuf);
  rngIdx = 0;
}

export function randU32() {
  if (rngIdx >= RNG_BUF_SIZE) rngRefill();
  return rngBuf[rngIdx++];
}

// Intero uniforme in [0, n)
export function randInt(n) {
  if (!Number.isInteger(n) || n < 1 || n > RNG_TWO32) {
    throw new RangeError('randInt: valore non valido ' + n);
  }
  if (n === 1) return 0;
  const limit = RNG_TWO32 - (RNG_TWO32 % n);
  let x;
  do { x = randU32(); } while (x >= limit);
  return x % n;
}

// Sceglie un indice in base a pesi interi non negativi.
export function pickWeightedIndex(weights) {
  let total = 0;
  for (const w of weights) {
    if (!Number.isInteger(w) || w < 0) throw new RangeError('peso non valido ' + w);
    total += w;
  }
  if (total <= 0) throw new RangeError('somma pesi nulla');
  let r = randInt(total);
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  throw new Error('pickWeightedIndex: stato impossibile');
}

// k elementi distinti da [0, n) in ordine casuale
export function randDistinct(n, k) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = randInt(i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr.slice(0, k);
}
