// Solmar Bay itself: a procedural dusk city on a bay, built once at load from a
// fixed seed so every run lays out the same streets. The ground is a single
// painted canvas (roads, sidewalks, crosswalks, beach, water); buildings are
// boxes with a shared lit-window texture; landmarks are the Meridian Tower, the
// Luna Casino, the marina, Rosa's Garage, the Pelican Diner and the hideout.
// The city also hands the rest of the game its collision boxes, its road
// centrelines (traffic follows them) and the named places missions point at.

import { Rng } from './rng.js';

const CITY_SEED = 777;
const BLOCKS = 8;            // 8 x 8 blocks
const BLOCK = 30;            // block side in metres
const ROAD = 14;             // road width
const PITCH = BLOCK + ROAD;  // 44
const HALF = (BLOCKS * PITCH - ROAD) / 2; // 169: city edge
const WORLD = 520;           // ground plane covers -260..260 (city + water)

// Road centrelines, including the outer ring roads.
export const ROAD_LINES = [-169, -132, -88, -44, 0, 44, 88, 132, 169];

const PALETTE = [0xd9a066, 0xe8c39e, 0x7fb3a8, 0xd97b7b, 0x8fa3c7, 0xc7b299, 0xe0a458, 0x9fb8a0];

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(0, 0, 128, 256);
  const lit = ['#ffd98a', '#ffe9b0', '#9fd8ff', '#ffb08a'];
  const dark = '#20242e';
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const on = Math.random() < 0.55;
      ctx.fillStyle = on ? lit[(row + col) % lit.length] : dark;
      ctx.fillRect(8 + col * 20, 10 + row * 20, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function paintGround() {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const toPx = (v) => ((v + WORLD / 2) / WORLD) * size;
  const px = (v) => (v / WORLD) * size;

  // The bay, then the sand beach along the south shore.
  const sea = ctx.createLinearGradient(0, 0, 0, size);
  sea.addColorStop(0, '#1d4e6b');
  sea.addColorStop(1, '#2f7d9e');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#e8d5a3';
  ctx.fillRect(0, toPx(176), size, size - toPx(176));
  ctx.fillStyle = '#d9c48d';
  for (let i = 0; i < 40; i += 1) {
    ctx.fillRect(toPx(-250 + i * 13), toPx(176), px(6), px(3));
  }

  // City asphalt base.
  ctx.fillStyle = '#26262c';
  ctx.fillRect(toPx(-HALF - ROAD / 2), toPx(-HALF - ROAD / 2), px(HALF * 2 + ROAD), px(HALF * 2 + ROAD));

  // Sidewalk slabs: one per block, with a darker gutter edge.
  for (let bx = 0; bx < BLOCKS; bx += 1) {
    for (let bz = 0; bz < BLOCKS; bz += 1) {
      const x0 = -HALF + bx * PITCH;
      const z0 = -HALF + bz * PITCH;
      ctx.fillStyle = '#8d8d94';
      ctx.fillRect(toPx(x0), toPx(z0), px(BLOCK), px(BLOCK));
      ctx.fillStyle = '#7a7a82';
      ctx.fillRect(toPx(x0), toPx(z0), px(BLOCK), px(1.5));
      ctx.fillRect(toPx(x0), toPx(z0), px(1.5), px(BLOCK));
    }
  }

  // Lane dashes along every road centreline.
  ctx.fillStyle = '#e8d24a';
  for (const line of ROAD_LINES) {
    for (let t = -HALF; t < HALF; t += 12) {
      ctx.fillRect(toPx(line) - px(0.4), toPx(t), px(0.8), px(6));
      ctx.fillRect(toPx(t), toPx(line) - px(0.4), px(6), px(0.8));
    }
  }

  // Crosswalk stripes at the four inner intersections.
  ctx.fillStyle = '#e8e8e8';
  for (const ix of [-44, 44]) {
    for (const iz of [-44, 44]) {
      for (let s = -6; s <= 6; s += 3) {
        ctx.fillRect(toPx(ix + s) - px(1), toPx(iz - 9), px(2), px(4));
        ctx.fillRect(toPx(ix + s) - px(1), toPx(iz + 5), px(2), px(4));
        ctx.fillRect(toPx(ix - 9), toPx(iz + s) - px(1), px(4), px(2));
        ctx.fillRect(toPx(ix + 5), toPx(iz + s) - px(1), px(4), px(2));
      }
    }
  }

  // The park (block 2,5) and the plaza (block 4,3) get their own ground.
  ctx.fillStyle = '#4d8a4a';
  ctx.fillRect(toPx(-HALF + 2 * PITCH), toPx(-HALF + 5 * PITCH), px(BLOCK), px(BLOCK));
  ctx.fillStyle = '#6a9a5f';
  ctx.beginPath();
  ctx.arc(toPx(-HALF + 2 * PITCH + 15), toPx(-HALF + 5 * PITCH + 15), px(9), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8a888';
  ctx.fillRect(toPx(-HALF + 4 * PITCH), toPx(-HALF + 3 * PITCH), px(BLOCK), px(BLOCK));
  ctx.fillStyle = '#9a8a6a';
  ctx.beginPath();
  ctx.arc(toPx(-HALF + 4 * PITCH + 15), toPx(-HALF + 3 * PITCH + 15), px(6), 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return { texture: tex, canvas };
}

export function buildCity(scene) {
  const rng = new Rng(CITY_SEED);
  const windowTex = makeWindowTexture();
  const ground = paintGround();
  const colliders = [];
  const buildings = [];
  const lights = [];

  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: ground.texture }),
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // The sun disc, low in the west, and dusk fog to match.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  sun.position.set(-330, 42, -260);
  sun.lookAt(0, 30, 0);
  scene.add(sun);

  const blockOrigin = (index) => -HALF + index * PITCH;
  const isPark = (bx, bz) => (bx === 2 && bz === 5);
  const isPlaza = (bx, bz) => (bx === 4 && bz === 3);
  const isLandmark = (bx, bz) => (bx === 3 && bz === 0) || (bx === 7 && bz === 2) || (bx === 0 && bz === 7);

  const tower = { x: blockOrigin(3) + 15, z: blockOrigin(0) + 15 };
  const casino = { x: blockOrigin(7) + 15, z: blockOrigin(2) + 15 };
  const hideout = { x: blockOrigin(0) + 15, z: blockOrigin(7) + 15 };
  const garage = { x: blockOrigin(0) + 8, z: blockOrigin(3) + 15 };
  const diner = { x: blockOrigin(4) + 15, z: blockOrigin(4) + 15 };
  const plaza = { x: blockOrigin(4) + 15, z: blockOrigin(3) + 15 };
  const marina = { x: 60, z: 196 };
  const park = { x: blockOrigin(2) + 15, z: blockOrigin(5) + 15 };

  function addBuilding(x, z, w, d, h, color, landmark) {
    const tex = windowTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 9)));
    const mat = new THREE.MeshLambertMaterial({ color, map: tex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.92, 1.2, d * 0.92),
      new THREE.MeshLambertMaterial({ color: 0x3c3c44 }),
    );
    roof.position.set(x, h + 0.6, z);
    scene.add(roof);
    colliders.push({ x, z, hx: w / 2, hz: d / 2 });
    buildings.push({ x, z, w, d, h, landmark: !!landmark });
    return mesh;
  }

  // Ordinary blocks: one to four buildings each, heights stepping up toward
  // the north (downtown) end of the city.
  for (let bx = 0; bx < BLOCKS; bx += 1) {
    for (let bz = 0; bz < BLOCKS; bz += 1) {
      if (isPark(bx, bz) || isPlaza(bx, bz) || isLandmark(bx, bz)) continue;
      const ox = blockOrigin(bx);
      const oz = blockOrigin(bz);
      const downtown = 1 - bz / BLOCKS;
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(10, 15);
        const d = rng.range(10, 15);
        const x = ox + rng.range(6, BLOCK - 6 - w + 6) + w / 2 - 3;
        const z = oz + rng.range(6, BLOCK - 6 - d + 6) + d / 2 - 3;
        const h = Math.round(rng.range(10, 16) + downtown * rng.range(6, 34));
        addBuilding(x, z, w, d, h, rng.pick(PALETTE), false);
      }
    }
  }

  // The Meridian Tower: the tallest building in Solmar Bay, with a beacon.
  const towerMesh = addBuilding(tower.x, tower.z, 22, 22, 92, 0x8fa3c7, true);
  towerMesh.material.emissive = new THREE.Color(0x223344);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  );
  beacon.position.set(tower.x, 95, tower.z);
  scene.add(beacon);
  const beaconLight = new THREE.PointLight(0xff5555, 2, 120);
  beaconLight.position.set(tower.x, 96, tower.z);
  scene.add(beaconLight);

  // The Luna Casino: wide, low, magenta sign glowing over the east side.
  addBuilding(casino.x, casino.z, 26, 18, 20, 0x6b4a7a, true);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(20, 4, 1),
    new THREE.MeshBasicMaterial({ color: 0xff2fd6 }),
  );
  sign.position.set(casino.x, 22, casino.z - 9.5);
  scene.add(sign);
  const signLight = new THREE.PointLight(0xff2fd6, 1.6, 70);
  signLight.position.set(casino.x, 24, casino.z - 12);
  scene.add(signLight);

  // The hideout: a small two-storey house with a garage door, south-west.
  addBuilding(hideout.x, hideout.z, 12, 10, 9, 0xe8c39e, true);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(6, 4, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x5a4a3a }),
  );
  door.position.set(hideout.x, 2, hideout.z - 5.2);
  scene.add(door);

  // Rosa's Garage: a low workshop with a big roller door, west side.
  addBuilding(garage.x, garage.z, 16, 12, 8, 0x7fb3a8, true);
  const roller = new THREE.Mesh(
    new THREE.BoxGeometry(9, 5, 0.4),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  roller.position.set(garage.x, 2.5, garage.z - 6.2);
  scene.add(roller);

  // The Pelican Diner: a round-ish roadside diner with a neon pelican sign.
  addBuilding(diner.x, diner.z, 14, 12, 8, 0xe0a458, true);
  const neon = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x37e0c8 }),
  );
  neon.position.set(diner.x, 9.5, diner.z - 6.2);
  scene.add(neon);

  // Park trees and beach palms.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7d3a });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x4d8a4a });
  function addTree(x, z, scale, palm) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.4 * scale, 6), trunkMat);
    trunk.position.set(x, 1.7 * scale, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(2.2 * scale, 5 * scale, 7),
      palm ? palmMat : leafMat,
    );
    leaves.position.set(x, (3.4 + 2.2) * scale, z);
    leaves.castShadow = true;
    scene.add(leaves);
  }
  for (let i = 0; i < 16; i += 1) {
    addTree(park.x + rng.range(-12, 12), park.z + rng.range(-12, 12), rng.range(0.8, 1.4), false);
  }
  for (let i = 0; i < 12; i += 1) {
    addTree(-160 + i * 28 + rng.range(-4, 4), 182, rng.range(0.9, 1.3), true);
  }

  // Marina: wooden docks and five bobbing boats on the bay.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  for (let i = 0; i < 3; i += 1) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 26), dockMat);
    dock.position.set(30 + i * 30, 0.4, 186);
    scene.add(dock);
  }
  const boatColors = [0xe8e8e8, 0x4a90d9, 0xd94a4a, 0xe8c33a, 0x37b8a0];
  const boats = [];
  for (let i = 0; i < 5; i += 1) {
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.4, 8),
      new THREE.MeshLambertMaterial({ color: boatColors[i] }),
    );
    hull.position.set(26 + i * 30, 0.7, 196 + (i % 2) * 6);
    scene.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.2, 3),
      new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
    );
    cabin.position.set(26 + i * 30, 1.9, 196 + (i % 2) * 6);
    scene.add(cabin);
    boats.push({ hull, cabin, phase: i * 1.3, x: 26 + i * 30, z: 196 + (i % 2) * 6 });
  }

  // Streetlights along the main roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2c34 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const line of [-132, -44, 44, 132]) {
    for (let t = -150; t <= 150; t += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(line + 6.5, 3.5, t);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(line + 6.5, 7.2, t);
      scene.add(bulb);
    }
  }

  // Four traffic lights at the inner intersections, cycling green/yellow/red.
  const lightPositions = [
    { x: -44, z: -44, offset: 0 },
    { x: 44, z: -44, offset: 5 },
    { x: -44, z: 44, offset: 10 },
    { x: 44, z: 44, offset: 15 },
  ];
  for (const pos of lightPositions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 6.5, 6), poleMat);
    pole.position.set(pos.x + 7, 3.25, pos.z + 7);
    scene.add(pole);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 3.2, 1),
      new THREE.MeshLambertMaterial({ color: 0x1c1c22 }),
    );
    box.position.set(pos.x + 7, 7, pos.z + 7);
    scene.add(box);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
    lamp.position.set(pos.x + 7, 8, pos.z + 6.4);
    scene.add(lamp);
    lights.push({ ...pos, lamp, lampMat, cycle: 0 });
  }

  const city = {
    half: HALF,
    roads: ROAD_LINES,
    colliders,
    buildings,
    groundCanvas: ground.canvas,
    tower, casino, hideout, garage, diner, plaza, marina, park,
    boats,
    // 0 = green for north-south, 1 = yellow, 2 = green for east-west, 3 = yellow.
    lightPhaseAt(x, z, time) {
      let best = null;
      let bestDist = 1e9;
      for (const light of lights) {
        const d = Math.hypot(light.x - x, light.z - z);
        if (d < bestDist) { bestDist = d; best = light; }
      }
      if (!best || bestDist > 60) return 0;
      const t = (time + best.offset) % 20;
      if (t < 8) return 0;
      if (t < 10) return 1;
      if (t < 18) return 2;
      return 3;
    },
    update(dt, time) {
      for (const light of lights) {
        const t = (time + light.offset) % 20;
        const color = t < 8 ? 0x33ff66 : t < 10 ? 0xffcc00 : t < 18 ? 0xff4444 : 0xffcc00;
        light.lampMat.color.setHex(color);
      }
      const pulse = 0.6 + 0.4 * Math.sin(time * 3);
      sign.material.color.setHex(pulse > 0.8 ? 0xff2fd6 : 0xc41e9e);
      beaconLight.intensity = 1.5 + Math.sin(time * 4) * 1.2;
      for (const boat of boats) {
        boat.hull.position.y = 0.7 + Math.sin(time * 0.9 + boat.phase) * 0.25;
        boat.cabin.position.y = 1.9 + Math.sin(time * 0.9 + boat.phase) * 0.25;
        boat.hull.rotation.z = Math.sin(time * 0.7 + boat.phase) * 0.03;
      }
    },
  };
  return city;
}
