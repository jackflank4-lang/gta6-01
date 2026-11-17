// Seeded RNG for Solmar Bay — deterministic city, spawns and ?shot= scenes.
// Rebuild r2: mulberry32 core kept, plus shuffle / weighted pick / gaussian /
// string-hash helpers the rebuild's city and mission code uses.
(function () {
  'use strict';
  window.SB = window.SB || {};

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Stable 32-bit hash of a short string, for seeding sub-generators by name.
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  SB.RNG = {
    make: function (seed) {
      const next = mulberry32(seed >>> 0);
      const api = {
        next: next,
        range: function (a, b) { return a + next() * (b - a); },
        int: function (a, b) { return a + Math.floor(next() * (b - a + 1)); },
        pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
        chance: function (p) { return next() < p; },
        // in-place Fisher-Yates shuffle, returns the same array
        shuffle: function (arr) {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
          }
          return arr;
        },
        // pick from [[value, weight], ...] by weight
        pickWeighted: function (pairs) {
          let total = 0;
          for (const p of pairs) total += p[1];
          let r = next() * total;
          for (const p of pairs) {
            r -= p[1];
            if (r <= 0) return p[0];
          }
          return pairs[pairs.length - 1][0];
        },
        // approx. standard normal via the sum of three uniforms
        gaussian: function () { return (next() + next() + next() - 1.5) * 1.1547; },
        // a fresh generator seeded from this one plus a name
        fork: function (name) { return SB.RNG.make((hashStr(name) ^ Math.floor(next() * 1e9)) >>> 0); },
      };
      return api;
    },
    hashStr: hashStr,
  };
})();
