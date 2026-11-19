// Seeded random numbers (mulberry32) — one deterministic stream drives the
// city layout, traffic colours, pedestrians and coin placement, so the same
// seed always builds the same Solmar Bay.

export class Rng {
  constructor(seed = 777) {
    // Force the seed into an unsigned 32-bit integer.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  // Next float in [0, 1).
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max] (inclusive).
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // One element of an array, uniformly.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  // True with probability p (0..1).
  chance(p) {
    return this.next() < p;
  }

  // Approximately normal value in [-1, 1] (sum of three uniforms).
  gaussian() {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }

  // Fisher-Yates shuffle, in place, returning the same array.
  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }
}

// Small string hash (FNV-1a) — turns a name like "meridian" into a seed.
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
