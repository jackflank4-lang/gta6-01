// Seeded RNG for Solmar Bay — deterministic city, spawns and ?shot= scenes.
// Rebuild r3: the core is now xorshift32 (v2 used mulberry32), the string
// hash is djb2, and the gaussian is Box-Muller with a cached spare value.
(function () {
  'use strict';
  window.SB = window.SB || {};

  // xorshift32: fast, small, and good enough for procedural layout.
  function xorshift32(seed) {
    let a = seed >>> 0;
    if (a === 0) a = 0x9e3779b9;
    return function () {
      a ^= a << 13; a >>>= 0;
      a ^= a >>> 17;
      a ^= a << 5; a >>>= 0;
      return (a >>> 0) / 4294967296;
    };
  }

  // djb2 string hash — seeds a sub-generator from a name.
  function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
    return h >>> 0;
  }

  SB.RNG = {
    make: function (seed) {
      const next = xorshift32(seed >>> 0);
      let spare = null; // cached second normal for Box-Muller
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
            const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
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
        // standard normal via Box-Muller (caches the second draw)
        gaussian: function () {
          if (spare !== null) { const v = spare; spare = null; return v; }
          let u = 0, v = 0;
          while (u === 0) u = next();
          v = next();
          const m = Math.sqrt(-2 * Math.log(u));
          spare = m * Math.sin(2 * Math.PI * v);
          return m * Math.cos(2 * Math.PI * v);
        },
        // a fresh generator seeded from this one plus a name
        fork: function (name) { return SB.RNG.make((hashStr(name) ^ Math.floor(next() * 1e9)) >>> 0); },
      };
      return api;
    },
    hashStr: hashStr,
  };
})();
