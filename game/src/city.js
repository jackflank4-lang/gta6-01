// Solmar Bay itself: an 8x8-block dusk coastal city on a seeded layout.
// Blocks are 30 m, roads 14 m (pitch 44 m). The bay lies to the west, with a
// beach and a marina full of boats. Landmarks: the 92 m Meridian Tower with
// its beacon, the Luna Casino, Rosa's Garage, the Pelican Diner, the crew
// hideout, a park and a plaza. Every building is also a collision box.

import { Rng } from './rng.js';

export const BLOCK = 30;
export const ROAD = 14;
export const PITCH = BLOCK + ROAD; // 44
export const CITY_HALF = 183; // outer road edge

// Block centres: (i - 3.5) * 44 for i in 0..7.
export function blockCenter(bx, bz) {
  return { x: (bx - 3.5) * PITCH, z: (bz - 3.5) * PITCH };
}

// Road centre lines: -176, -132, ..., 176 (9 lines each way).
export function roadLines() {
  const lines = [];
  for (let k = 0; k <= 8; k++) lines.push(-176 + k * PITCH);
  return lines;
}

const LANDMARKS = {
  tower: { bx: 4, bz: 3, name: 'Meridian Tower' },
  casino: { bx: 2, bz: 2, name: 'Luna Casino' },
  garage: { bx: 5, bz: 5, name: "Rosa's Garage" },
  diner: { bx: 1, bz: 6, name: 'Pelican Diner' },
  hideout: { bx: 6, bz: 1, name: 'Barracuda Hideout' },
  park: { bx: 3, bz: 6, name: 'Neon Park' },
  plaza: { bx: 4, bz: 4, name: 'Solmar Plaza' },
};

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function neonSignTexture(text, color) {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, s, s);
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    ctx.fillStyle = color;
    ctx.fillText(text, s / 2, s / 2 - 6);
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, s / 2, s / 2 - 6);
  });
}

function windowTexture(rng) {
  // One shared facade texture: dark glass with a random scatter of lit
  // windows. Buildings tint it with their own material colour.
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#232838';
    ctx.fillRect(0, 0, s, s);
    for (let y = 8; y < s - 8; y += 16) {
      for (let x = 8; x < s - 8; x += 14) {
        const lit = rng.chance(0.55);
        ctx.fillStyle = lit ? rng.pick(['#ffd76a', '#9fe8ff', '#ff9de2', '#fff2b0']) : '#141824';
        ctx.fillRect(x, y, 8, 10);
      }
    }
  });
}

export function buildCity(scene, fxLow) {
  const rng = new Rng(777);
  const colliders = [];
  const animated = { boats: [], beacon: null, beaconLight: null, neonMats: [], trafficLights: [] };
  const spots = {};
  for (const [key, lm] of Object.entries(LANDMARKS)) spots[key] = blockCenter(lm.bx, lm.bz);

  // --- sky, fog, lights --------------------------------------------------
  scene.background = new THREE.Color(0x1b1440);
  scene.fog = new THREE.Fog(0x2a1a4d, 120, 620);
  const hemi = new THREE.HemisphereLight(0x8a7bff, 0x1c1420, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a4d, 1.7);
  sun.position.set(-140, 90, -60);
  sun.castShadow = !fxLow;
  if (!fxLow) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -220;
    sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220;
    sun.shadow.camera.bottom = -220;
  }
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0x7d8cff, 0.35);
  moon.position.set(120, 160, 140);
  scene.add(moon);

  // --- ground: roads, sidewalks, park, plaza, beach ----------------------
  const groundTex = canvasTexture(1024, (ctx, s) => {
    const toPx = (v) => ((v + CITY_HALF + 14) / (2 * (CITY_HALF + 14))) * s;
    ctx.fillStyle = '#262b38';
    ctx.fillRect(0, 0, s, s);
    // Block interiors.
    for (let bx = 0; bx < 8; bx++) {
      for (let bz = 0; bz < 8; bz++) {
        const c = blockCenter(bx, bz);
        const x = toPx(c.x - BLOCK / 2);
        const z = toPx(c.z - BLOCK / 2);
        const w = toPx(c.x + BLOCK / 2) - x;
        ctx.fillStyle = '#363b4e';
        ctx.fillRect(x, z, w, w);
        ctx.strokeStyle = '#3d4258';
        ctx.strokeRect(x + 1, z + 1, w - 2, w - 2);
      }
    }
    // Park: green. Plaza: pale paving.
    const park = blockCenter(3, 6);
    ctx.fillStyle = '#1d4d2a';
    ctx.fillRect(toPx(park.x - 15), toPx(park.z - 15), toPx(park.x + 15) - toPx(park.x - 15), toPx(park.z + 15) - toPx(park.z - 15));
    const plaza = blockCenter(4, 4);
    ctx.fillStyle = '#565b70';
    ctx.fillRect(toPx(plaza.x - 15), toPx(plaza.z - 15), toPx(plaza.x + 15) - toPx(plaza.x - 15), toPx(plaza.z + 15) - toPx(plaza.z - 15));
    // Road centre dashes.
    ctx.strokeStyle = '#c9a13b';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    for (const line of roadLines()) {
      ctx.beginPath();
      ctx.moveTo(toPx(line), 0);
      ctx.lineTo(toPx(line), s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toPx(line));
      ctx.lineTo(s, toPx(line));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Beach strip on the west edge.
    ctx.fillStyle = '#c2a878';
    ctx.fillRect(0, 0, toPx(-CITY_HALF) - toPx(-CITY_HALF - 18), s);
  });
  const groundSize = 2 * (CITY_HALF + 14);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- the bay (west of the city) -----------------------------------------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(180, groundSize),
    new THREE.MeshLambertMaterial({ color: 0x14406e, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-CITY_HALF - 9 - 90, 0.05, 0);
  scene.add(water);

  // Marina piers + boats.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const boatColors = [0xe8e8f0, 0xff6b9d, 0x37e0ff, 0xffd23e, 0x7dff9e, 0xc9a0ff];
  for (let p = 0; p < 2; p++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 60), pierMat);
    pier.position.set(-CITY_HALF - 26 - p * 26, 0.5, -60 + p * 130);
    scene.add(pier);
  }
  for (let b = 0; b < 6; b++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.2, 8),
      new THREE.MeshLambertMaterial({ color: boatColors[b % boatColors.length] }),
    );
    hull.position.y = 0.6;
    boat.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    mast.position.y = 4;
    boat.add(mast);
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 4.4),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    sail.position.set(0, 4, 1.4);
    boat.add(sail);
    boat.position.set(-CITY_HALF - 30 - rng.range(0, 70), 0.1, rng.range(-150, 150));
    boat.rotation.y = rng.range(-0.4, 0.4);
    boat.userData.phase = rng.range(0, Math.PI * 2);
    scene.add(boat);
    animated.boats.push(boat);
  }

  // --- buildings -----------------------------------------------------------
  const facadeTex = windowTexture(rng);
  const palette = [0x464c6a, 0x584a6e, 0x41505f, 0x63503f, 0x3a4a5a, 0x524566];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBuilding(x, z, w, h, d, color, emissiveSign = null) {
    const mat = new THREE.MeshLambertMaterial({ color, map: facadeTex, emissive: 0x111122 });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = !fxLow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    if (emissiveSign) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(emissiveSign.w, emissiveSign.h),
        new THREE.MeshBasicMaterial({ map: emissiveSign.tex }),
      );
      sign.position.set(x + emissiveSign.dx, emissiveSign.y, z + emissiveSign.dz);
      sign.rotation.y = emissiveSign.rotY;
      scene.add(sign);
      animated.neonMats.push(sign.material);
    }
    return mesh;
  }

  const landmarkBlocks = new Set(Object.values(LANDMARKS).map((lm) => `${lm.bx},${lm.bz}`));
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      const c = blockCenter(bx, bz);
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const w = rng.range(8, 13);
        const d = rng.range(8, 13);
        const h = rng.range(8, 42);
        const ox = rng.range(-7, 7);
        const oz = rng.range(-7, 7);
        addBuilding(c.x + ox, c.z + oz, w, h, d, rng.pick(palette));
      }
    }
  }

  // --- landmarks -----------------------------------------------------------
  // Meridian Tower: 92 m, with a rotating beacon on top.
  const tower = spots.tower;
  addBuilding(tower.x, tower.z, 18, 92, 18, 0x2e3550, {
    tex: neonSignTexture('MERIDIAN', '#37e0ff'), w: 16, h: 3.2, y: 84,
    dx: 0, dz: 9.2, rotY: 0,
  });
  const beacon = new THREE.Mesh(
    new THREE.ConeGeometry(6, 18, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff5da2, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.set(tower.x, 101, tower.z);
  scene.add(beacon);
  const beaconLight = new THREE.PointLight(0xff5da2, 900, 160);
  beaconLight.position.set(tower.x, 94, tower.z);
  scene.add(beaconLight);
  animated.beacon = beacon;
  animated.beaconLight = beaconLight;

  // Luna Casino: low, wide, pink neon.
  const casino = spots.casino;
  addBuilding(casino.x, casino.z, 26, 14, 20, 0x4a2a4d, {
    tex: neonSignTexture('LUNA', '#ff5da2'), w: 18, h: 4, y: 12,
    dx: 0, dz: 10.2, rotY: 0,
  });
  const casinoGlow = new THREE.PointLight(0xff5da2, 500, 90);
  casinoGlow.position.set(casino.x, 10, casino.z + 14);
  scene.add(casinoGlow);

  // Rosa's Garage: single-storey workshop with a forecourt.
  const garage = spots.garage;
  addBuilding(garage.x, garage.z, 22, 7, 16, 0x37424f, {
    tex: neonSignTexture("ROSA'S", '#ffd23e'), w: 14, h: 3, y: 6,
    dx: 0, dz: 8.2, rotY: 0,
  });
  const garageGlow = new THREE.PointLight(0xffd23e, 350, 70);
  garageGlow.position.set(garage.x, 6, garage.z + 12);
  scene.add(garageGlow);

  // Pelican Diner: small, teal neon.
  const diner = spots.diner;
  addBuilding(diner.x, diner.z, 16, 6, 12, 0x3a4a44, {
    tex: neonSignTexture('PELICAN', '#37e0ff'), w: 12, h: 2.6, y: 5,
    dx: 0, dz: 6.2, rotY: 0,
  });

  // Crew hideout: two-storey house with a purple sign.
  const hideout = spots.hideout;
  addBuilding(hideout.x, hideout.z, 14, 9, 12, 0x453a5e, {
    tex: neonSignTexture('BARRACUDA', '#c9a0ff'), w: 12, h: 2.6, y: 7.5,
    dx: 0, dz: 6.2, rotY: 0,
  });

  // Park: trees + a few benches (no buildings).
  const park = spots.park;
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3d24 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2a7a3a });
  for (let t = 0; t < 9; t++) {
    const tx = park.x + rng.range(-12, 12);
    const tz = park.z + rng.range(-12, 12);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 6), trunkMat);
    trunk.position.set(tx, 1.2, tz);
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(rng.range(1.6, 2.4), rng.range(3, 5), 8), leafMat);
    leaves.position.set(tx, 4.2, tz);
    scene.add(leaves);
    colliders.push({ minX: tx - 0.5, maxX: tx + 0.5, minZ: tz - 0.5, maxZ: tz + 0.5 });
  }

  // Plaza: fountain in the middle.
  const plaza = spots.plaza;
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.6, 1.1, 20),
    new THREE.MeshLambertMaterial({ color: 0x8a8fa8 }),
  );
  fountain.position.set(plaza.x, 0.55, plaza.z);
  scene.add(fountain);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.25, 20),
    new THREE.MeshLambertMaterial({ color: 0x37b6ff, transparent: true, opacity: 0.85 }),
  );
  fountainWater.position.set(plaza.x, 1.1, plaza.z);
  scene.add(fountainWater);
  colliders.push({ minX: plaza.x - 5.6, maxX: plaza.x + 5.6, minZ: plaza.z - 5.6, maxZ: plaza.z + 5.6 });

  // --- street lamps ---------------------------------------------------------
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const line of roadLines()) {
    for (const other of [-132, -44, 44, 132]) {
      for (const [x, z] of [[line, other], [other, line]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
        pole.position.set(x + 6.5, 3, z + 6.5);
        scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), bulbMat);
        bulb.position.set(x + 6.5, 6.2, z + 6.5);
        scene.add(bulb);
      }
    }
  }

  // --- traffic lights at the four central intersections ---------------------
  const tlMats = { ns: null, ew: null };
  for (const [ix, iz] of [[-44, -44], [44, -44], [-44, 44], [44, 44]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.4, 6), lampMat);
    pole.position.set(ix + 7.5, 2.7, iz + 7.5);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    head.position.set(ix + 7.5, 5.6, iz + 7.5);
    scene.add(head);
    const nsBulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0x39ff6a }));
    nsBulb.position.set(ix + 7.5, 6.2, iz + 7.5);
    scene.add(nsBulb);
    const ewBulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    ewBulb.position.set(ix + 7.5, 5.2, iz + 7.5);
    scene.add(ewBulb);
    animated.trafficLights.push({ nsBulb, ewBulb });
  }

  // --- helpers ---------------------------------------------------------------
  function isRoad(x, z) {
    const near = (v) => roadLines().some((line) => Math.abs(v - line) <= ROAD / 2 + 0.5);
    return near(x) || near(z);
  }

  function randomRoadPoint(rng2) {
    const lines = roadLines();
    const along = rng2.pick(lines);
    const cross = rng2.range(-CITY_HALF, CITY_HALF);
    return rng2.chance(0.5) ? { x: along, z: cross } : { x: cross, z: along };
  }

  function nearestRoadPoint(x, z) {
    const lines = roadLines();
    let best = lines[0];
    for (const line of lines) if (Math.abs(line - x) < Math.abs(best - x)) best = line;
    return { x: best, z };
  }

  // Traffic-light cycle: 14 s north-south green, 4 s amber, 14 s east-west
  // green, 4 s amber. Returns 'ns' or 'ew' for the green axis.
  function lightAxis(timeSec) {
    const cycle = timeSec % 36;
    return cycle < 18 ? 'ns' : 'ew';
  }

  function update(dt, timeSec) {
    for (const boat of animated.boats) {
      boat.position.y = 0.1 + Math.sin(timeSec * 0.7 + boat.userData.phase) * 0.25;
      boat.rotation.z = Math.sin(timeSec * 0.5 + boat.userData.phase) * 0.03;
    }
    if (animated.beacon) {
      animated.beacon.rotation.y = timeSec * 0.6;
      animated.beaconLight.intensity = 700 + Math.sin(timeSec * 2.4) * 350;
    }
    const axis = lightAxis(timeSec);
    for (const tl of animated.trafficLights) {
      tl.nsBulb.material.color.setHex(axis === 'ns' ? 0x39ff6a : 0xff3b30);
      tl.ewBulb.material.color.setHex(axis === 'ew' ? 0x39ff6a : 0xff3b30);
    }
  }

  return {
    colliders,
    spots,
    update,
    isRoad,
    randomRoadPoint,
    nearestRoadPoint,
    lightAxis,
    bounds: CITY_HALF,
  };
}
