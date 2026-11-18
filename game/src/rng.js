// rng.js — deterministic SplitMix32 random source for Solmar Bay.
// Every random choice in the game flows from one seeded generator, so a
// fixed seed replays the same city, traffic and pedestrians every time.
export function makeRng(seed) {
  let s = seed >>> 0;
  function next() {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(a, b) { return a + (b - a) * next(); },
    int(a, b) { return Math.floor(a + (b - a + 1) * next()); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    },
  };
}
