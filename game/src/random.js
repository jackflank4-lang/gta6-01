// Seeded RNG (mulberry32) — deterministic city + deterministic ?shot= scenes.
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
  SB.RNG = {
    make: function (seed) {
      const next = mulberry32(seed >>> 0);
      return {
        next: next,
        range: function (a, b) { return a + next() * (b - a); },
        int: function (a, b) { return a + Math.floor(next() * (b - a + 1)); },
        pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
        chance: function (p) { return next() < p; },
      };
    },
  };
})();
