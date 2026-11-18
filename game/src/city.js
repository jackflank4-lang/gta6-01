// Procedural Solmar Bay for Solmar Bay — Neon Heat.
// An 8x8 grid of 30 m blocks separated by 14 m roads (44 m pitch), a bay
// and beach on the east edge, and five named landmarks. Layout is fully
// deterministic from seed 777, so every build produces the same city.
const THREE = window.THREE;
import { Rng } from './rng.js';

export const PITCH = 44;
export const BLOCK = 30;
export const ROAD = 14;
export const HALF = 176; // city edge (8 * 44 / 2)

function blockCenter(i) {
  return -154 + i * PITCH;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Lit-window facade texture, drawn once and shared by all buildings.
function facadeTexture(base, lit) {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const rng = new Rng(99);
  for (let y = 8; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      g.fillStyle = rng.chance(0.55) ? lit : '#1a2030';
      g.fillRect(x, y, 10, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, fg, bg) {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fg;
  g.shadowBlur = 24;
  g.fillStyle = fg;
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture() {
  const c = makeCanvas(16, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#12082e');
  grad.addColorStop(0.45, '#3a1c5e');
  grad.addColorStop(0.72, '#c94b6d');
  grad.addColorStop(0.86, '#ff8a5c');
  grad.addColorStop(1, '#2c1a3a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = new Rng(seed);
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];

  // --- sky dome -------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 16, 12),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
  );
  sky.position.y = -40;
  group.add(sky);

  // --- ground ---------------------------------------------------------
  // Ground plane spans x -210..310, z -210..210 so the bay fits east.
  const groundCanvas = makeCanvas(1024, 1024);
  const gg = groundCanvas.getContext('2d');
  const toPx = (v) => (v + 210) * (1024 / 520);
  const toPz = (v) => (v + 210) * (1024 / 420);
  // Base: dark asphalt for the whole city, sand + water drawn over it.
  gg.fillStyle = '#23232e';
  gg.fillRect(0, 0, 1024, 1024);
  // Water (east of x=176) and beach strip.
  gg.fillStyle = '#0b3d66';
  gg.fillRect(toPx(176), 0, 1024 - toPx(176), 1024);
  gg.fillStyle = '#0d4a7d';
  for (let i = 0; i < 40; i++) {
    gg.fillRect(toPx(180 + rng.range(0, 120)), rng.range(0, 1024), 60, 3);
  }
  gg.fillStyle = '#c9a86a';
  gg.fillRect(toPx(168), 0, toPx(176) - toPx(168), 1024);
  // Sidewalks: light border around every block.
  gg.fillStyle = '#3d3d4a';
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      gg.fillRect(toPx(cx - 17), toPz(cz - 17), (34 / 520) * 1024, (34 / 420) * 1024);
    }
  }
  // Road centre lines (dashed yellow on main axes, white elsewhere).
  gg.strokeStyle = '#d8b13a';
  gg.lineWidth = 2;
  gg.setLineDash([18, 14]);
  for (let i = 0; i < 9; i++) {
    const v = -176 + i * PITCH;
    gg.beginPath(); gg.moveTo(toPx(v), 0); gg.lineTo(toPx(v), 1024); gg.stroke();
    gg.beginPath(); gg.moveTo(0, toPz(v)); gg.lineTo(1024, toPz(v)); gg.stroke();
  }
  gg.setLineDash([]);
  // Park block (2,5) and plaza block (4,4) ground colours.
  gg.fillStyle = '#2d5a2e';
  gg.fillRect(toPx(-66 - 15), toPz(66 - 15), (30 / 520) * 1024, (30 / 420) * 1024);
  gg.fillStyle = '#565664';
  gg.fillRect(toPx(22 - 15), toPz(22 - 15), (30 / 520) * 1024, (30 / 420) * 1024);
  gg.strokeStyle = '#6a6a7a';
  gg.lineWidth = 1;
  for (let i = -15; i <= 15; i += 5) {
    gg.beginPath(); gg.moveTo(toPx(22 + i), toPz(7)); gg.lineTo(toPx(22 + i), toPz(37)); gg.stroke();
    gg.beginPath(); gg.moveTo(toPx(7), toPz(22 + i)); gg.lineTo(toPx(37), toPz(22 + i)); gg.stroke();
  }
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = 4;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 420),
    new THREE.MeshLambertMaterial({ map: groundTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(50, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);
  // Shimmering water sheet over the bay.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(124, 420),
    new THREE.MeshLambertMaterial({ color: 0x0e5a8a, transparent: true, opacity: 0.55 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(238, 0.15, 0);
  group.add(water);

  // --- buildings ------------------------------------------------------
  const facadeA = facadeTexture('#3a3f5c', '#ffd28a');
  const facadeB = facadeTexture('#4a3550', '#9ae6ff');
  const facadeC = facadeTexture('#2e4a4a', '#ffb3c8');
  const facades = [facadeA, facadeB, facadeC];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0); // origin at the base
  const placements = [];
  const landmarkBlocks = new Set(['4,3', '6,2', '1,1', '3,6', '1,6', '4,4', '2,5']);
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      if (landmarkBlocks.has(bx + ',' + bz)) continue;
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const count = rng.int(2, 4);
      for (let k = 0; k < count; k++) {
        const w = rng.range(8, 16);
        const d = rng.range(8, 16);
        const h = rng.range(8, 38) * (rng.chance(0.12) ? 1.6 : 1);
        const ox = rng.range(-8, 8);
        const oz = rng.range(-8, 8);
        const x = cx + ox;
        const z = cz + oz;
        if (Math.abs(x) > 168 || Math.abs(z) > 168) continue;
        placements.push({ x, z, w, d, h, f: rng.int(0, 2) });
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }
  // One InstancedMesh per facade variant.
  const byFacade = [[], [], []];
  placements.forEach((p) => byFacade[p.f].push(p));
  const dummy = new THREE.Object3D();
  byFacade.forEach((list, fi) => {
    if (!list.length) return;
    const mat = new THREE.MeshLambertMaterial({ map: facades[fi] });
    const mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  // --- landmarks ------------------------------------------------------
  function landmarkBox(x, z, w, h, d, color, emissive) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, emissive: emissive || 0x000000, roughness: 0.7, metalness: 0.2 })
    );
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    group.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }
  function neonSign(x, y, z, rotY, text, fg, bg, w) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: signTexture(text, fg, bg) })
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
    return m;
  }

  // Meridian Tower — 92 m, the boss arena (block 4,3).
  const tower = landmarkBox(22, -22, 24, 92, 24, 0x2c2f55, 0x0a0a22);
  neonSign(22, 84, -9.4, 0, 'MERIDIAN', '#ff5ce1', '#1a0b2e', 26);
  neonSign(22, 84, -34.6, Math.PI, 'MERIDIAN', '#ff5ce1', '#1a0b2e', 26);
  // Rooftop beacon ring.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 6, 12),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 })
  );
  beacon.position.set(22, 95, -22);
  group.add(beacon);

  // Luna Casino (block 6,2).
  landmarkBox(110, -66, 26, 16, 20, 0x4a2a5a, 0x1a0a2e);
  neonSign(110, 15, -55.4, 0, 'LUNA CASINO', '#ffd23a', '#2a0a3a', 28);
  // Rosa's Garage (block 1,1).
  landmarkBox(-110, -110, 22, 9, 18, 0x5a3a2a, 0x000000);
  neonSign(-110, 8.5, -100.4, 0, "ROSA'S GARAGE", '#4dff88', '#12261a', 24);
  // Pelican Diner (block 3,6).
  landmarkBox(-22, 110, 20, 8, 16, 0x6a4a3a, 0x000000);
  neonSign(-22, 7.5, 101.4, 0, 'PELICAN DINER', '#4dd8ff', '#0a1e2e', 22);
  // Hideout (block 1,6) — a low safehouse with a pink awning.
  landmarkBox(-110, 110, 16, 7, 14, 0x3a3a4a, 0x000000);
  neonSign(-110, 6.5, 102.4, 0, 'HIDEOUT', '#ff5ce1', '#1a0b2e', 16);
  // Welcome arch over the bay road.
  neonSign(150, 12, 0, -Math.PI / 2, 'SOLMAR BAY', '#ffd23a', '#1a0b2e', 30);

  // Plaza fountain (block 4,4).
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.5, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a8aa0, roughness: 0.4 })
  );
  fountain.position.set(22, 0.6, 22);
  group.add(fountain);
  colliders.push({ minX: 16.5, maxX: 27.5, minZ: 16.5, maxZ: 27.5 });
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.3, 20),
    new THREE.MeshLambertMaterial({ color: 0x2aa8dd, transparent: true, opacity: 0.8 })
  );
  fountainWater.position.set(22, 1.25, 22);
  group.add(fountainWater);

  // Park trees (block 2,5) + a few palms along the beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a34 });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x2a9a4a });
  function tree(x, z, palm) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 6), trunkMat);
    trunk.position.y = 2;
    t.add(trunk);
    const top = new THREE.Mesh(
      palm ? new THREE.ConeGeometry(2.6, 4.5, 7) : new THREE.SphereGeometry(2.4, 8, 6),
      palm ? palmMat : leafMat
    );
    top.position.y = 5.4;
    t.add(top);
    t.position.set(x, 0, z);
    group.add(t);
  }
  for (let i = 0; i < 9; i++) tree(-66 + rng.range(-12, 12), 66 + rng.range(-12, 12), false);
  for (let i = 0; i < 8; i++) tree(164, -150 + i * 44 + rng.range(-8, 8), true);

  // Marina boats in the bay.
  const boatMat = new THREE.MeshLambertMaterial({ color: 0xd8d8e0 });
  const boatMat2 = new THREE.MeshLambertMaterial({ color: 0xff5c5c });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 8), i % 2 ? boatMat2 : boatMat);
    hull.position.y = 0.6;
    b.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), trunkMat);
    mast.position.y = 4;
    b.add(mast);
    b.position.set(196 + rng.range(0, 40), 0, -140 + i * 70 + rng.range(-10, 10));
    b.rotation.y = rng.range(-0.3, 0.3);
    group.add(b);
  }

  // Streetlights along the main roads (emissive lamps, no real lights).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30303a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd28a });
  for (let i = -3; i <= 3; i++) {
    for (const [x, z] of [[i * PITCH, -154], [i * PITCH, 154], [-154, i * PITCH], [154, i * PITCH]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
      pole.position.set(x + 8, 3.5, z + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(x + 8, 7.2, z + 8);
      group.add(lamp);
    }
  }
  // A few real point lights at the landmarks for the night glow.
  const lightSpots = [[22, 20, -22, 0xff5ce1], [110, 12, -66, 0xffd23a], [-110, 8, -110, 0x4dff88], [22, 8, 22, 0x4dd8ff]];
  lightSpots.forEach(([x, y, z, color]) => {
    const pl = new THREE.PointLight(color, 120, 60, 1.8);
    pl.position.set(x, y, z);
    group.add(pl);
  });

  // --- neon coins -----------------------------------------------------
  const coinSpots = [
    [22, 8], [8, 22], [36, 22], [22, 36], // plaza
    [-66, 54], [-78, 78], [-54, 78], // park
    [164, -44], [164, 66], // beach
    [-110, -88], // garage forecourt
    [-22, 96], // diner forecourt
    [110, -44], // casino forecourt
  ];
  const coins = coinSpots.map(([x, z]) => ({ x, z, taken: false, mesh: null }));

  // --- helpers --------------------------------------------------------
  function randomRoadPoint(r) {
    // Pick a random road line, a random lane offset and a random spot.
    if (r.chance(0.5)) {
      const x = -176 + r.int(0, 8) * PITCH;
      const z = r.range(-170, 170);
      return { x: x + (r.chance(0.5) ? 3.5 : -3.5), z, heading: z > 0 ? Math.PI : 0 };
    }
    const z = -176 + r.int(0, 8) * PITCH;
    const x = r.range(-170, 170);
    return { x, z: z + (r.chance(0.5) ? 3.5 : -3.5), heading: x > 0 ? -Math.PI / 2 : Math.PI / 2 };
  }

  function collideCircle(x, z, radius) {
    // Circle vs AABB resolution, run a couple of passes for corners.
    for (let pass = 0; pass < 2; pass++) {
      for (const c of colliders) {
        const cx = Math.max(c.minX, Math.min(x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
        const dx = x - cx;
        const dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            x = cx + (dx / d) * radius;
            z = cz + (dz / d) * radius;
          } else {
            // Centre inside the box: push out along the smallest axis.
            const pushL = x - c.minX + radius;
            const pushR = c.maxX - x + radius;
            const pushT = z - c.minZ + radius;
            const pushB = c.maxZ - z + radius;
            const m = Math.min(pushL, pushR, pushT, pushB);
            if (m === pushL) x = c.minX - radius;
            else if (m === pushR) x = c.maxX + radius;
            else if (m === pushT) z = c.minZ - radius;
            else z = c.maxZ + radius;
          }
        }
      }
    }
    // Keep everything out of the water and inside the map.
    if (x > 168) x = 168;
    if (x < -182) x = -182;
    if (z > 182) z = 182;
    if (z < -182) z = -182;
    return { x, z };
  }

  return {
    group,
    colliders,
    coins,
    garage: { x: -110, z: -92 },
    plaza: { x: 22, z: 22 },
    tower: { x: 22, z: -22 },
    casino: { x: 110, z: -66 },
    casinoFront: { x: 110, z: -44 }, // forecourt south of the casino doors
    diner: { x: -22, z: 110 },
    hideout: { x: -110, z: 110 },
    park: { x: -66, z: 66 },
    beach: { x: 164, z: 0 },
    randomRoadPoint,
    collideCircle,
  };
}
