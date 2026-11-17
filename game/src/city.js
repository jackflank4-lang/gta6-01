// Solmar Bay itself: an 8x8 block grid (30 m blocks, 14 m roads) on a
// dusk coast, with a beach and marina to the south, a park, a plaza and
// five landmarks. One seeded RNG lays the whole city out, so every run
// builds the same streets. Buildings are boxes with a shared lit-window
// texture; every building also registers an AABB collider so the hero,
// cars and pedestrians cannot walk through walls.
import { Rng } from './rng.js';

const THREE = window.THREE;
const PITCH = 44;
const BLOCK = 30;
const ROAD = 14;
const HALF = 176; // city edge: roads run at -176..176
const SEED = 777;

// Block (i, j) centre in world metres.
function blockCenter(i, j) {
  return { x: -154 + PITCH * i, z: -154 + PITCH * j };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function groundTexture() {
  const c = makeCanvas(1024, 1024);
  const g = c.getContext('2d');
  const S = 1024 / 520; // px per metre, world [-260, 260]
  const X = (wx) => (wx + 260) * S;
  const Z = (wz) => (wz + 260) * S;
  const W = (m) => m * S;
  g.fillStyle = '#2e3d33';
  g.fillRect(0, 0, 1024, 1024);
  // Beach band and sea to the south (positive z).
  g.fillStyle = '#c2a878';
  g.fillRect(0, Z(176), 1024, W(34));
  g.fillStyle = '#14486b';
  g.fillRect(0, Z(210), 1024, 1024 - Z(210));
  g.fillStyle = '#1a5a82';
  for (let i = 0; i < 40; i += 1) {
    g.fillRect(X(-250 + i * 13), Z(214 + (i % 5) * 8), W(9), 2);
  }
  // Blocks: sidewalks, then asphalt roads between them.
  g.fillStyle = '#3a3f46';
  for (let k = 0; k <= 8; k += 1) {
    const line = -176 + PITCH * k;
    g.fillRect(X(line - ROAD / 2), Z(-HALF), W(ROAD), W(2 * HALF));
    g.fillRect(X(-HALF), Z(line - ROAD / 2), W(2 * HALF), W(ROAD));
  }
  g.fillStyle = '#565b63';
  for (let k = 0; k <= 8; k += 1) {
    const line = -176 + PITCH * k;
    g.fillRect(X(line - ROAD / 2 + 2), Z(-HALF), W(ROAD - 4), W(2 * HALF));
    g.fillRect(X(-HALF), Z(line - ROAD / 2 + 2), W(2 * HALF), W(ROAD - 4));
  }
  // Lane dashes down every road.
  g.fillStyle = '#d8c25a';
  for (let k = 0; k <= 8; k += 1) {
    const line = -176 + PITCH * k;
    for (let d = -170; d < 170; d += 16) {
      g.fillRect(X(line - 0.4), Z(d), W(0.8), W(7));
      g.fillRect(X(d), Z(line - 0.4), W(7), W(0.8));
    }
  }
  // Plaza paving and park grass.
  const plaza = blockCenter(4, 4);
  g.fillStyle = '#8a7f6a';
  g.fillRect(X(plaza.x - 15), Z(plaza.z - 15), W(30), W(30));
  const park = blockCenter(1, 5);
  g.fillStyle = '#3f6b35';
  g.fillRect(X(park.x - 15), Z(park.z - 15), W(30), W(30));
  g.fillStyle = '#c2a878';
  g.fillRect(X(park.x - 15), Z(park.z - 1), W(30), W(2));
  g.fillRect(X(park.x - 1), Z(park.z - 15), W(2), W(30));
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function windowTexture() {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#20242c';
  g.fillRect(0, 0, 128, 256);
  const rng = new Rng(99);
  for (let y = 8; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rng.chance(0.55);
      g.fillStyle = lit ? (rng.chance(0.7) ? '#ffd27a' : '#9fd8ff') : '#10131a';
      g.fillRect(x, y, 10, 12);
    }
  }
  return new THREE.CanvasTexture(c);
}

function signTexture(text, color) {
  const c = makeCanvas(512, 96);
  const g = c.getContext('2d');
  g.fillStyle = '#0c0c14';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.strokeRect(4, 4, 504, 88);
  g.fillStyle = color;
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  return new THREE.CanvasTexture(c);
}

export function pushOutOfColliders(pos, radius, colliders) {
  let hit = false;
  for (const b of colliders) {
    const cx = Math.max(b.x0, Math.min(pos.x, b.x1));
    const cz = Math.max(b.z0, Math.min(pos.z, b.z1));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      // Centre is inside the box: push out along the smallest overlap.
      const left = pos.x - b.x0;
      const right = b.x1 - pos.x;
      const top = pos.z - b.z0;
      const bottom = b.z1 - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x0 - radius;
      else if (m === right) pos.x = b.x1 + radius;
      else if (m === top) pos.z = b.z0 - radius;
      else pos.z = b.z1 + radius;
    }
  }
  return hit;
}

export function buildCity(scene, lowFx) {
  const rng = new Rng(SEED);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Sea shimmer plane.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 50),
    new THREE.MeshLambertMaterial({ color: 0x1a5a82, transparent: true, opacity: 0.55 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.15, 235);
  group.add(sea);

  const winTex = windowTexture();
  const facadeColors = [0x8a7f8d, 0x7d8a99, 0x9a8a7d, 0x6e7d6a, 0x99806e, 0x7a6a8a];
  const addBuilding = (x, z, w, d, h, color) => {
    const mat = new THREE.MeshLambertMaterial({ map: winTex, color });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    group.add(m);
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    // Rooftop rim.
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
    );
    rim.position.set(x, h + 0.25, z);
    group.add(rim);
    return m;
  };
  const addSign = (text, color, x, y, z, ry, w = 26, h = 5) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: signTexture(text, color) }),
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
    return m;
  };

  // Special blocks: plaza (4,4), park (1,5), tower (4,3), casino (6,2),
  // garage (2,6), diner (6,6), hideout (1,1).
  const special = {
    '4,4': 'plaza', '1,5': 'park', '4,3': 'tower', '6,2': 'casino',
    '2,6': 'garage', '6,6': 'diner', '1,1': 'hideout',
  };
  const positions = {};
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      const c = blockCenter(i, j);
      const key = `${i},${j}`;
      if (special[key]) continue;
      const n = rng.chance(0.6) ? 2 : 1;
      for (let b = 0; b < n; b += 1) {
        const w = rng.range(13, 22);
        const d = rng.range(13, 22);
        const h = rng.range(9, 38);
        const ox = n === 1 ? 0 : (b === 0 ? -8 : 8);
        const oz = n === 1 ? 0 : (b === 0 ? -7 : 7);
        addBuilding(c.x + ox, c.z + oz, w, d, h, rng.pick(facadeColors));
      }
    }
  }

  // Plaza: paving, fountain, benches.
  const plaza = blockCenter(4, 4);
  positions.plaza = { x: plaza.x, z: plaza.z };
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 6, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x9aa5ad }),
  );
  fountain.position.set(plaza.x, 0.6, plaza.z);
  group.add(fountain);
  colliders.push({ x0: plaza.x - 6, z0: plaza.z - 6, x1: plaza.x + 6, z1: plaza.z + 6 });
  const waterTop = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.4, 20),
    new THREE.MeshLambertMaterial({ color: 0x3f9fd8 }),
  );
  waterTop.position.set(plaza.x, 1.3, plaza.z);
  group.add(waterTop);

  // Park: trees.
  const park = blockCenter(1, 5);
  positions.park = { x: park.x, z: park.z };
  for (let t = 0; t < 10; t += 1) {
    const tx = park.x + rng.range(-13, 13);
    const tz = park.z + rng.range(-13, 13);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    );
    trunk.position.set(tx, 1.2, tz);
    group.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(rng.range(1.8, 2.8), 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x2f6b2f }),
    );
    crown.position.set(tx, 3.6, tz);
    group.add(crown);
    colliders.push({ x0: tx - 0.5, z0: tz - 0.5, x1: tx + 0.5, z1: tz + 0.5 });
  }

  // Meridian Tower: 92 m with a beacon.
  const tower = blockCenter(4, 3);
  positions.tower = { x: tower.x, z: tower.z };
  addBuilding(tower.x, tower.z, 24, 24, 92, 0x5a6a7d);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  beacon.position.set(tower.x, 94, tower.z);
  beacon.name = 'beacon';
  group.add(beacon);
  if (!lowFx) {
    const beaconLight = new THREE.PointLight(0xff4444, 1.2, 120);
    beaconLight.position.set(tower.x, 94, tower.z);
    group.add(beaconLight);
  }
  addSign('MERIDIAN', '#ff5a5a', tower.x, 80, tower.z - 12.4, 0, 22, 4);

  // Luna Casino.
  const casino = blockCenter(6, 2);
  positions.casino = { x: casino.x, z: casino.z };
  addBuilding(casino.x, casino.z, 28, 20, 16, 0x7d5a8a);
  addSign('LUNA CASINO', '#ff9df5', casino.x, 12, casino.z - 10.4, 0, 26, 5);

  // Rosa's Garage.
  const garage = blockCenter(2, 6);
  positions.garage = { x: garage.x, z: garage.z + 16 };
  addBuilding(garage.x, garage.z, 26, 18, 9, 0x8a7a5a);
  addSign("ROSA'S GARAGE", '#ffd27a', garage.x, 8, garage.z - 9.4, 0, 26, 4);
  // Repair beacon pad in front of the garage.
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 0.25, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.3 }),
  );
  pad.position.set(positions.garage.x, 0.15, positions.garage.z);
  pad.name = 'garagePad';
  group.add(pad);

  // Pelican Diner.
  const diner = blockCenter(6, 6);
  positions.diner = { x: diner.x, z: diner.z };
  addBuilding(diner.x, diner.z, 20, 16, 8, 0x9a6a5a);
  addSign('PELICAN DINER', '#7ae0ff', diner.x, 7, diner.z - 8.4, 0, 24, 4);

  // Crew hideout.
  const hideout = blockCenter(1, 1);
  positions.hideout = { x: hideout.x, z: hideout.z };
  addBuilding(hideout.x, hideout.z, 16, 14, 7, 0x6a7d5a);
  addSign('HIDEOUT', '#8aff9d', hideout.x, 6, hideout.z - 7.4, 0, 18, 3.5);

  // Marina: docks and boats south of the beach.
  positions.marina = { x: 0, z: 196 };
  for (let d = -2; d <= 2; d += 1) {
    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.5, 22),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    );
    dock.position.set(d * 26, 0.3, 200);
    group.add(dock);
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.6, 12),
      new THREE.MeshLambertMaterial({ color: rng.pick([0xffffff, 0xd86a5a, 0x5a8ad8]) }),
    );
    hull.position.set(d * 26 + 5, 0.8, 198 + (d % 2) * 6);
    group.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    mast.position.set(d * 26 + 5, 5, 198 + (d % 2) * 6);
    group.add(mast);
  }

  // Street lights along the main roads.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let k = 0; k <= 8; k += 2) {
    const line = -176 + PITCH * k;
    for (const z of [-132, -44, 44, 132]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), lampMat);
      pole.position.set(line + 7.5, 3.5, z);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampGlow);
      bulb.position.set(line + 7.5, 7.1, z);
      group.add(bulb);
    }
  }

  scene.add(group);
  const roadLines = [];
  for (let k = 0; k <= 8; k += 1) roadLines.push(-176 + PITCH * k);
  return {
    colliders,
    roadLines,
    ...positions,
    beach: { x: 0, z: 190 },
    bounds: HALF,
  };
}
