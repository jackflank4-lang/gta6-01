// Deterministic random numbers for Solmar Bay: one small seeded generator the
// whole game shares, so the city, traffic and missions lay out the same way
// every run from the same seed. Nothing here is cryptography; it only has to
// feel random and be repeatable for screenshots and tests.

// SplitMix32: a tiny state mixer with good low-bit behaviour for a 32-bit seed.
export class Rng {
  constructor(seed) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }
  next() {
    this.state = (this.state + 0x9e3779b9) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    z = (z ^ (z >>> 15)) >>> 0;
    return z / 4294967296;
  }
  // Uniform float in [a, b).
  range(a, b) {
    return a + this.next() * (b - a);
  }
  // Uniform integer in [a, b] inclusive.
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  // One element of an array, uniformly.
  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }
  // True with probability p (0..1).
  chance(p) {
    return this.next() < p;
  }
  // Approximately normal value, mean 0, spread ~1 (Box-Muller).
  gauss() {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // Fisher-Yates shuffle, in place, returning the array.
  shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }
}

// A stable 32-bit hash of a short string, for turning names into seeds.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
