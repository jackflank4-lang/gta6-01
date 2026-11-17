// Procedural city of Solmar Bay: grid roads, building blocks, park, beach,
// pier, and the named landmarks the missions use. Deterministic from the seed.
(function () {
  'use strict';
  window.SB = window.SB || {};
  const CFG = SB.CFG;

  function roadCoord(i) { return i * CFG.pitch; } // centre line of road i

  SB.City = {
    build: function (seed) {
      const rng = SB.RNG.make(seed);
      const city = {
        buildings: [],   // {x, z, w, d, h, color, roof, name?}
        trees: [],       // {x, z, s}
        lamps: [],       // {x, z}
        parks: [],       // {x, z, w, d}
        colliders: [],   // AABBs {minX, maxX, minZ, maxZ} — buildings + props
        parkedSpots: [], // {x, z, angle}
        roadLines: [],   // road centre lines, for minimap + traffic
      };
      const P = CFG.pitch, B = CFG.block, R = CFG.road, HB = CFG.halfBlocks;
      // Road centre lines: -4..+4 in both axes.
      for (let i = -HB; i <= HB; i++) {
        city.roadLines.push({ x1: roadCoord(-HB) - R / 2 - B, z1: roadCoord(i), x2: roadCoord(HB) + R / 2 + B, z2: roadCoord(i), horiz: true });
        city.roadLines.push({ x1: roadCoord(i), z1: roadCoord(-HB) - R / 2 - B, x2: roadCoord(i), z2: roadCoord(HB) + R / 2 + B, horiz: false });
      }
      // Blocks: each grid cell between roads gets buildings, a park, or stays empty.
      for (let bx = -HB; bx < HB; bx++) {
        for (let bz = -HB; bz < HB; bz++) {
          const cx = (bx + 0.5) * P, cz = (bz + 0.5) * P;
          // Reserve landmark plots (see below); skip them here.
          if (isLandmarkPlot(bx, bz)) continue;
          const roll = rng.next();
          if (roll < 0.14) {
            // Park block.
            city.parks.push({ x: cx, z: cz, w: B, d: B });
            for (let t = 0; t < 7; t++) {
              city.trees.push({ x: cx + rng.range(-B / 2 + 6, B / 2 - 6), z: cz + rng.range(-B / 2 + 6, B / 2 - 6), s: rng.range(0.8, 1.4) });
            }
            continue;
          }
          // 1–3 buildings per block.
          const n = rng.int(1, 3);
          for (let k = 0; k < n; k++) {
            const w = rng.range(14, 26), d = rng.range(14, 26);
            const ox = (k % 2 === 0 ? -1 : 1) * rng.range(6, B / 2 - w / 2 - 2);
            const oz = (k < 2 ? -1 : 1) * rng.range(6, B / 2 - d / 2 - 2);
            const h = rng.chance(0.18) ? rng.range(34, 58) : rng.range(8, 26);
            const b = { x: cx + ox, z: cz + oz, w: w, d: d, h: h, color: rng.pick(SB.PALETTE.building), roof: rng.pick(SB.PALETTE.roof) };
            city.buildings.push(b);
            city.colliders.push({ minX: b.x - w / 2, maxX: b.x + w / 2, minZ: b.z - d / 2, maxZ: b.z + d / 2 });
          }
          if (rng.chance(0.5)) city.trees.push({ x: cx + rng.range(-20, 20), z: cz + rng.range(-20, 20), s: rng.range(0.8, 1.3) });
        }
      }
      // Landmarks (fixed plots, original names).
      addLandmark(city, 0, 0, 'KINGFISH TOWER', 30, 30, 72, 0x2a2f45);   // centre block
      addLandmark(city, -4, 3, 'MAMA LOU’S DINER', 22, 18, 12, 0xb08a6a); // west edge
      addLandmark(city, 3, -4, 'SOLMAR DOCKS', 26, 20, 10, 0x6f7f8a);    // north-east
      addLandmark(city, -3, -4, 'CHOP SHOP', 24, 18, 9, 0x8a6f8a);       // north-west
      addLandmark(city, 3, 3, 'ST. MARIA HOSPITAL', 24, 20, 16, 0xe8e8e8); // south-east
      addLandmark(city, -4, -4, 'HIDEOUT', 18, 16, 9, 0x5f7f6f);         // north-west corner
      // Street lamps along roads.
      for (let i = -HB; i <= HB; i++) {
        for (let j = -HB; j < HB; j++) {
          if (rng.chance(0.6)) city.lamps.push({ x: roadCoord(i) + R / 2 + 1.5, z: roadCoord(j) + rng.range(-30, 30) });
        }
      }
      // Parked cars along road edges.
      for (let i = 0; i < 26; i++) {
        const horiz = rng.chance(0.5);
        const road = roadCoord(rng.int(-HB, HB));
        const along = rng.range(-HB * P, HB * P);
        if (horiz) city.parkedSpots.push({ x: along, z: road + (rng.chance(0.5) ? 5.5 : -5.5), angle: rng.chance(0.5) ? 0 : Math.PI });
        else city.parkedSpots.push({ x: road + (rng.chance(0.5) ? 5.5 : -5.5), z: along, angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 });
      }
      // Named places (world coordinates, used by missions + HUD).
      city.places = {
        tower: { x: 40, z: 40, label: 'Kingfish Tower' },
        diner: { x: -280, z: 280, label: 'Mama Lou’s Diner' },
        docks: { x: 280, z: -280, label: 'Solmar Docks' },
        chopshop: { x: -200, z: -280, label: 'Chop Shop' },
        hospital: { x: 280, z: 280, label: 'St. Maria Hospital' },
        hideout: { x: -280, z: -280, label: 'Hideout' },
        pier: { x: 0, z: 392, label: 'Solmar Pier' },
        spawn: { x: -280, z: 232, label: 'Spawn' },
      };
      city.beachZ = 352; // south of this: sand, then water
      city.rng = rng;
      return city;
    },
  };

  function isLandmarkPlot(bx, bz) {
    // (bx,bz) are block indices -4..3; landmark plots by their block.
    const key = bx + ',' + bz;
    return ['0,0', '-4,3', '3,-4', '-3,-4', '3,3', '-4,-4'].includes(key);
  }
  function addLandmark(city, bx, bz, name, w, d, h, color) {
    const P = CFG.pitch;
    const x = (bx + 0.5) * P, z = (bz + 0.5) * P;
    const b = { x: x, z: z, w: w, d: d, h: h, color: color, roof: 0x333333, name: name };
    city.buildings.push(b);
    city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  // ---- collision + road helpers (shared by world + traffic AI) ----
  SB.CityHelpers = {
    // Push a circle out of building AABBs; returns corrected {x, z}.
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
            // centre inside the box: push out along the smallest penetration axis
            const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
            else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
          }
        }
      }
      return { x: x, z: z };
    },
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
      const P = CFG.pitch, HB = CFG.halfBlocks;
      let best = null, bd = Infinity;
      for (let i = -HB; i <= HB; i++) {
        const c = i * P;
        const d1 = Math.abs(z - c), d2 = Math.abs(x - c);
        if (d1 < bd) { bd = d1; best = { x: x, z: c, horiz: true }; }
        if (d2 < bd) { bd = d2; best = { x: c, z: z, horiz: false }; }
      }
      return best;
    },
    dist: function (ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); },
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
    g.fillStyle = '#8d9299'; g.fillRect(0, 0, S, S);
    // parks green
    g.fillStyle = '#4f8f3a';
    for (const p of city.parks) g.fillRect(W2S(p.x - p.w / 2), W2S(p.z - p.d / 2), p.w / 800 * S, p.d / 800 * S);
    // beach + water (south edge, z > beachZ)
    g.fillStyle = '#e0c98f'; g.fillRect(0, W2S(city.beachZ), S, S - W2S(city.beachZ));
    g.fillStyle = '#1e6f9e'; g.fillRect(0, W2S(city.beachZ + 34), S, S - W2S(city.beachZ + 34));
    // roads
    g.fillStyle = '#33373e';
    for (let i = -HB; i <= HB; i++) {
      const c = i * P;
      g.fillRect(0, W2S(c - R / 2), S, R / 800 * S);
      g.fillRect(W2S(c - R / 2), 0, R / 800 * S, S);
    }
    // centre dashes
    g.fillStyle = '#f5d76e';
    for (let i = -HB; i <= HB; i++) {
      const c = i * P;
      for (let d = -380; d < 380; d += 24) {
        g.fillRect(W2S(d), W2S(c) - 1.5, 12 / 800 * S, 3);
        g.fillRect(W2S(c) - 1.5, W2S(d), 3, 12 / 800 * S);
      }
    }
    // crosswalks at intersections
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = -HB; i <= HB; i++) for (let j = -HB; j <= HB; j++) {
      const x = i * P, z = j * P;
      for (let k = -3; k <= 3; k++) {
        g.fillRect(W2S(x + k * 2 - 0.7), W2S(z - R / 2), 1.4 / 800 * S, 3 / 800 * S);
        g.fillRect(W2S(x + k * 2 - 0.7), W2S(z + R / 2 - 3), 1.4 / 800 * S, 3 / 800 * S);
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
    const rng = SB.RNG.make(baseColor * 7919 + 13);
    for (let y = 12; y < 244; y += 22) {
      for (let x = 10; x < 118; x += 20) {
        const lit = rng.next() < (litRatio || 0.35);
        g.fillStyle = lit ? '#ffd76a' : '#1c2733';
        g.fillRect(x, y, 12, 14);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  };
})();
