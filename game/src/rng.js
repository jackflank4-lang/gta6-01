// Seeded random numbers for Solmar Bay — Neon Heat.
// SplitMix32 core plus the helpers the city, traffic and missions use.
// The world seed is 777: the same seed always builds the same city, so
// screenshots and play-tests are reproducible run after run.
export function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  function next() {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  }
  let spare = null;
  return {
    next,
    // Uniform float in [a, b).
    range(a, b) {
      return a + (b - a) * next();
    },
    // Uniform integer in [a, b] inclusive.
    int(a, b) {
      return Math.floor(a + (b - a + 1) * next());
    },
    // A random element of a non-empty array.
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // True with probability p (0..1).
    chance(p) {
      return next() < p;
    },
    // Standard-normal sample (Box-Muller, cached spare).
    gaussian() {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      const t = 2 * Math.PI * v;
      spare = r * Math.sin(t);
      return r * Math.cos(t);
    },
    // In-place Fisher-Yates shuffle; returns the same array.
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },
  };
}

// The world generator: one rng for the whole city, seeded 777.
export function makeWorldRng() {
  return makeRng(777);
}
