// Procedural city of Solmar Bay: grid roads, building blocks, parks, plazas,
// beach, boardwalk, pier, marina, and the named landmarks the missions use.
// Rebuild r3: a new seed lays the blocks out differently; a Casino Royale
// landmark joins the skyline, boats bob in the marina south of the beach,
// plazas get benches, lamps line both sides of the roads, and the ground
// texture is redrawn with wider crosswalks and a pinker dusk tint.
(function () {
  'use strict';
  window.SB = window.SB || {};
  const CFG = SB.CFG;

  function roadCoord(i) { return i * CFG.pitch; } // centre line of road i

  // Landmark plots, by block index (bx,bz in -4..3).
  const LANDMARKS = [
    { plot: '0,0', name: 'KINGFISH TOWER', w: 30, d: 30, h: 72, color: 0x2a2f45, heli: true },
    { plot: '-4,3', name: 'MAMA LOU’S DINER', w: 22, d: 18, h: 12, color: 0xb08a6a },
    { plot: '3,-4', name: 'SOLMAR DOCKS', w: 26, d: 20, h: 10, color: 0x6f7f8a },
    { plot: '-3,-4', name: 'CHOP SHOP', w: 24, d: 18, h: 9, color: 0x8a6f8a },
    { plot: '3,3', name: 'ST. MARIA HOSPITAL', w: 24, d: 20, h: 16, color: 0xe8e8e8 },
    { plot: '-4,-4', name: 'HIDEOUT', w: 18, d: 16, h: 9, color: 0x5f7f6f },
    { plot: '0,-4', name: 'CASINO ROYALE', w: 26, d: 20, h: 20, color: 0x7a2a5a },
  ];
  const LANDMARK_PLOTS = {};
  for (const lm of LANDMARKS) LANDMARK_PLOTS[lm.plot] = lm;

  SB.City = {
    build: function (seed) {
      const rng = SB.RNG.make(seed);
      const city = {
        buildings: [],   // {x, z, w, d, h, color, roof, name?, heli?}
        trees: [],       // {x, z, s}
        lamps: [],       // {x, z}
        parks: [],       // {x, z, w, d}
        plazas: [],      // {x, z, w, d} — paved squares with benches
        lights: [],      // {x, z} traffic-light intersections
        billboards: [],  // {x, z, angle, hue}
        boats: [],       // {x, z, angle, len} — marina boats in the water
        colliders: [],   // AABBs {minX, maxX, minZ, maxZ} — buildings + props
        parkedSpots: [], // {x, z, angle}
        roadLines: [],   // road centre lines, for minimap + traffic
        coins: [],       // {x, z} neon coin pickups
      };
      const P = CFG.pitch, B = CFG.block, R = CFG.road, HB = CFG.halfBlocks;

      // Road centre lines: -4..+4 in both axes.
      for (let i = -HB; i <= HB; i++) {
        city.roadLines.push({ x1: roadCoord(-HB) - R / 2 - B, z1: roadCoord(i), x2: roadCoord(HB) + R / 2 + B, z2: roadCoord(i), horiz: true });
        city.roadLines.push({ x1: roadCoord(i), z1: roadCoord(-HB) - R / 2 - B, x2: roadCoord(i), z2: roadCoord(HB) + R / 2 + B, horiz: false });
        // traffic lights at the four inner intersections of each ring road
        if (i !== 0 && Math.abs(i) < HB) {
          city.lights.push({ x: roadCoord(i), z: roadCoord(0) });
          city.lights.push({ x: roadCoord(0), z: roadCoord(i) });
        }
      }

      // Blocks: each grid cell between roads gets buildings, a park, a plaza, or stays empty.
      for (let bx = -HB; bx < HB; bx++) {
        for (let bz = -HB; bz < HB; bz++) {
          const cx = (bx + 0.5) * P, cz = (bz + 0.5) * P;
          const lm = LANDMARK_PLOTS[bx + ',' + bz];
          if (lm) { // landmark plot
            const b = { x: cx, z: cz, w: lm.w, d: lm.d, h: lm.h, color: lm.color, roof: 0x333333, name: lm.name, heli: !!lm.heli };
            city.buildings.push(b);
            city.colliders.push({ minX: cx - lm.w / 2, maxX: cx + lm.w / 2, minZ: cz - lm.d / 2, maxZ: cz + lm.d / 2 });
            continue;
          }
          const roll = rng.next();
          if (roll < 0.10) {
            // Park block.
            city.parks.push({ x: cx, z: cz, w: B, d: B });
            for (let t = 0; t < 8; t++) {
              city.trees.push({ x: cx + rng.range(-B / 2 + 6, B / 2 - 6), z: cz + rng.range(-B / 2 + 6, B / 2 - 6), s: rng.range(0.8, 1.5) });
            }
            continue;
          }
          if (roll < 0.18) {
            // Plaza block: paved square, benches, three trees.
            city.plazas.push({ x: cx, z: cz, w: B, d: B });
            for (let t = 0; t < 3; t++) {
              city.trees.push({ x: cx + rng.range(-B / 2 + 8, B / 2 - 8), z: cz + rng.range(-B / 2 + 8, B / 2 - 8), s: rng.range(0.9, 1.3) });
            }
            continue;
          }
          // 1–4 buildings per block.
          const n = rng.int(1, 4);
          for (let k = 0; k < n; k++) {
            const w = rng.range(13, 25), d = rng.range(13, 25);
            const ox = (k % 2 === 0 ? -1 : 1) * rng.range(5, B / 2 - w / 2 - 2);
            const oz = (k < 2 ? -1 : 1) * rng.range(5, B / 2 - d / 2 - 2);
            const h = rng.chance(0.22) ? rng.range(36, 62) : rng.range(8, 28);
            const b = { x: cx + ox, z: cz + oz, w: w, d: d, h: h, color: rng.pick(SB.PALETTE.building), roof: rng.pick(SB.PALETTE.roof) };
            city.buildings.push(b);
            city.colliders.push({ minX: b.x - w / 2, maxX: b.x + w / 2, minZ: b.z - d / 2, maxZ: b.z + d / 2 });
          }
          if (rng.chance(0.55)) city.trees.push({ x: cx + rng.range(-20, 20), z: cz + rng.range(-20, 20), s: rng.range(0.8, 1.3) });
        }
      }

      // Neon Row: billboards along the central north-south road.
      for (let i = 0; i < 10; i++) {
        const z = roadCoord(rng.int(-3, 3)) + rng.range(-20, 20);
        city.billboards.push({ x: rng.chance(0.5) ? 10 : -10, z: z, angle: rng.chance(0.5) ? 0 : Math.PI, hue: rng.pick([0xff2d78, 0x2dd4ff, 0xffe14d, 0x7dff5e, 0xff5e8a]) });
      }

      // Street lamps along both sides of each road.
      for (let i = -HB; i <= HB; i++) {
        for (let j = -HB; j < HB; j++) {
          if (rng.chance(0.55)) city.lamps.push({ x: roadCoord(i) + R / 2 + 1.5, z: roadCoord(j) + rng.range(-30, 30) });
          if (rng.chance(0.4)) city.lamps.push({ x: roadCoord(i) - R / 2 - 1.5, z: roadCoord(j) + rng.range(-30, 30) });
        }
      }
      // Parked cars along road edges.
      for (let i = 0; i < 28; i++) {
        const horiz = rng.chance(0.5);
        const road = roadCoord(rng.int(-HB, HB));
        const along = rng.range(-HB * P, HB * P);
        if (horiz) city.parkedSpots.push({ x: along, z: road + (rng.chance(0.5) ? 5.5 : -5.5), angle: rng.chance(0.5) ? 0 : Math.PI });
        else city.parkedSpots.push({ x: road + (rng.chance(0.5) ? 5.5 : -5.5), z: along, angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 });
      }
      // Marina: five boats moored in the water south of the beach.
      for (let i = 0; i < 5; i++) {
        city.boats.push({ x: -160 + i * 80 + rng.range(-12, 12), z: 400 + rng.range(0, 26), angle: rng.range(-0.3, 0.3), len: rng.range(10, 16) });
      }
      // Neon coins: hidden around the city (rooftop-adjacent streets, parks, pier).
      const coinSpots = [];
      for (let i = 0; i < CFG.coinsTotal; i++) {
        const node = { x: rng.int(-HB, HB) * P, z: rng.int(-HB, HB) * P };
        coinSpots.push({ x: node.x + rng.range(-24, 24), z: node.z + rng.range(-24, 24) });
      }
      for (const c of coinSpots) {
        const fixed = H2.collideCircle(city, c.x, c.z, 1);
        city.coins.push({ x: fixed.x, z: fixed.z });
      }

      // Named places (world coordinates, used by missions + HUD).
      city.places = {
        tower: { x: 40, z: 40, label: 'Kingfish Tower' },
        diner: { x: -280, z: 280, label: 'Mama Lou’s Diner' },
        docks: { x: 280, z: -280, label: 'Solmar Docks' },
        chopshop: { x: -200, z: -280, label: 'Chop Shop' },
        hospital: { x: 280, z: 280, label: 'St. Maria Hospital' },
        hideout: { x: -280, z: -280, label: 'Hideout' },
        casino: { x: 40, z: -280, label: 'Casino Royale' },
        pier: { x: 0, z: 392, label: 'Solmar Pier' },
        spawn: { x: -280, z: 232, label: 'Spawn' },
      };
      city.beachZ = 352; // south of this: sand, then water
      city.rng = rng;
      return city;
    },
  };

  // Local alias so the coin placement above can use the helpers defined below.
  const H2 = {
    collideCircle: function (city, x, z, r) {
      for (const c of city.colliders) {
        const nx = Math.max(c.minX, Math.min(x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
        const dx = x - nx, dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            x = nx + (dx / d) * r; z = nz + (dz / d) * r;
          } else {
            const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
            else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
          }
        }
      }
      return { x: x, z: z };
    },
  };

  // ---- collision + road helpers (shared by world + traffic AI) ----
  SB.CityHelpers = {
    // Push a circle out of building AABBs; returns corrected {x, z}.
    collideCircle: function (city, x, z, r) { return H2.collideCircle(city, x, z, r); },
    clampCity: function (x, z, margin) {
      const m = CFG.cityHalf + (margin || 0);
      return { x: Math.max(-m, Math.min(m, x)), z: Math.max(-m, Math.min(m + 60, z)) };
    },
    // Is the point on a road (within road width of a road centre line)?
    onRoad: function (x, z) {
      const P = CFG.pitch, R = CFG.road, HB = CFG.halfBlocks;
      const near = (v) => {
        for (let i = -HB; i <= HB; i++) if (Math.abs(v - i * P) <= R / 2 + 1) return true;
        return false;
      };
      return near(x) || near(z);
    },
    // Nearest point on the road network (snaps to nearest road centre line).
    snapToRoad: function (x, z) {
      const P = CFG.pitch;
      let best = null, bd = Infinity;
      for (let i = -CFG.halfBlocks; i <= CFG.halfBlocks; i++) {
        const c = i * P;
        const d1 = Math.abs(z - c), d2 = Math.abs(x - c);
        if (d1 < bd) { bd = d1; best = { x: x, z: c, horiz: true }; }
        if (d2 < bd) { bd = d2; best = { x: c, z: z, horiz: false }; }
      }
      return best;
    },
    dist: function (ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); },
    angleTo: function (ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); },
    // shortest signed angle difference, wrapped to [-PI, PI]
    angleDiff: function (a, b) {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
  };

  // ---- ground texture: roads, sidewalks, lane dashes, beach, water edge ----
  SB.makeGroundTexture = function (city) {
    const S = 1024; // texture px; world spans -400..400
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const W2S = (v) => (v + 400) / 800 * S;
    const P = CFG.pitch, R = CFG.road, HB = CFG.halfBlocks;
    // base: sidewalks grey
    g.fillStyle = '#93989f'; g.fillRect(0, 0, S, S);
    // parks green, plazas paved light
    g.fillStyle = '#558f3e';
    for (const p of city.parks) g.fillRect(W2S(p.x - p.w / 2), W2S(p.z - p.d / 2), p.w / 800 * S, p.d / 800 * S);
    g.fillStyle = '#c2b8a8';
    for (const p of city.plazas) g.fillRect(W2S(p.x - p.w / 2), W2S(p.z - p.d / 2), p.w / 800 * S, p.d / 800 * S);
    // beach + water (south edge, z > beachZ)
    g.fillStyle = '#e6cf95'; g.fillRect(0, W2S(city.beachZ), S, S - W2S(city.beachZ));
    g.fillStyle = '#1a6f8e'; g.fillRect(0, W2S(city.beachZ + 34), S, S - W2S(city.beachZ + 34));
    // boardwalk strip along the beach
    g.fillStyle = '#6a4a28'; g.fillRect(0, W2S(city.beachZ - 6), S, 8 / 800 * S);
    // roads
    g.fillStyle = '#2e323a';
    for (let i = -HB; i <= HB; i++) {
      const c = i * P;
      g.fillRect(0, W2S(c - R / 2), S, R / 800 * S);
      g.fillRect(W2S(c - R / 2), 0, R / 800 * S, S);
    }
    // centre dashes
    g.fillStyle = '#ffd76e';
    for (let i = -HB; i <= HB; i++) {
      const c = i * P;
      for (let d = -380; d < 380; d += 24) {
        g.fillRect(W2S(d), W2S(c) - 1.5, 12 / 800 * S, 3);
        g.fillRect(W2S(c) - 1.5, W2S(d), 3, 12 / 800 * S);
      }
    }
    // wider crosswalks at intersections
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = -HB; i <= HB; i++) for (let j = -HB; j <= HB; j++) {
      const x = i * P, z = j * P;
      for (let k = -4; k <= 4; k++) {
        g.fillRect(W2S(x + k * 2 - 0.8), W2S(z - R / 2), 1.6 / 800 * S, 4 / 800 * S);
        g.fillRect(W2S(x + k * 2 - 0.8), W2S(z + R / 2 - 4), 1.6 / 800 * S, 4 / 800 * S);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  };

  // Building facade texture (windows), generated per colour bucket.
  SB.makeFacadeTexture = function (baseColor, litRatio) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#' + baseColor.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 128, 256);
    const rng = SB.RNG.make(baseColor * 104729 + 7);
    for (let y = 10; y < 246; y += 20) {
      for (let x = 8; x < 120; x += 18) {
        const lit = rng.next() < (litRatio || 0.4);
        g.fillStyle = lit ? '#ffd76a' : '#1c2733';
        g.fillRect(x, y, 11, 13);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  };
})();
