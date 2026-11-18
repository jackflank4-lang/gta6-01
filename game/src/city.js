// Solmar Bay: the city itself. An 8x8 grid of 30 m blocks on 14 m roads
// (44 m pitch, 352 m across), built once from seed 777 so the layout is
// identical every run. Landmarks are fixed so missions and screenshots can
// find them: Meridian Tower, Luna Casino, Rosa's Garage, the Pelican
// Diner, the crew hideout, a park, a plaza, and a marina with a beach on
// the bay side. Buildings collide as axis-aligned boxes; the module hands
// out a blocked(x, z, r) test the hero, cars and pedestrians all share.
// three.min.js is the UMD build and is loaded by index.html as a classic
// script, so it lives on window.THREE — importing it as a module would give
// an empty namespace.
const THREE = window.THREE;

export const BLOCK = 30;
export const ROAD = 14;
export const PITCH = BLOCK + ROAD; // 44
export const GRID = 8;
export const HALF = (GRID * PITCH) / 2; // 176

const LANDMARKS = {
  tower: { bx: 6, bz: 6 },
  casino: { bx: 1, bz: 6 },
  garage: { bx: 1, bz: 1 },
  diner: { bx: 6, bz: 1 },
  hideout: { bx: 3, bz: 3 },
  park: { bx: 4, bz: 4 },
  plaza: { bx: 4, bz: 2 },
};

function cellCenter(b) {
  return -HALF + PITCH / 2 + b * PITCH;
}

// One canvas texture of lit windows, reused by every building.
function makeWindowTexture(rng, base, lit) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      if (rng.chance(0.55)) {
        g.fillStyle = rng.pick(lit);
        g.fillRect(x, y, 6, 8);
      } else {
        g.fillStyle = '#101018';
        g.fillRect(x, y, 6, 8);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function neonSign(text, color, w, h) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return mesh;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const addCollider = (x, z, hx, hz) => {
    colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
  };
  const blocked = (x, z, r) => {
    if (Math.abs(x) > HALF + 40 || Math.abs(z) > HALF + 40) return true;
    for (let i = 0; i < colliders.length; i += 1) {
      const c = colliders[i];
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  };

  // Dusk sky gradient is the renderer's clear colour; the ground is a big
  // dark slab, roads are darker strips on top of it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 260, HALF * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x2e3a2f }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -40);
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x23232c });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
  for (let i = 0; i <= GRID; i += 1) {
    const c = -HALF + i * PITCH;
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, HALF * 2), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(c, 0, 0);
    roadV.receiveShadow = true;
    group.add(roadV);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, ROAD), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(0, 0, c);
    roadH.receiveShadow = true;
    group.add(roadH);
    // Sidewalk edging on both sides of each road.
    for (const off of [-ROAD / 2 - 1.5, ROAD / 2 + 1.5]) {
      const walkV = new THREE.Mesh(new THREE.PlaneGeometry(3, HALF * 2), walkMat);
      walkV.rotation.x = -Math.PI / 2;
      walkV.position.set(c + off, 0.01, 0);
      group.add(walkV);
      const walkH = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 3), walkMat);
      walkH.rotation.x = -Math.PI / 2;
      walkH.position.set(0, 0.01, c + off);
      group.add(walkH);
    }
  }

  // Bay: water south of the grid plus a sand beach strip.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 260, 120),
    new THREE.MeshLambertMaterial({ color: 0x14425e, emissive: 0x06121f }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.3, -HALF - 60);
  group.add(water);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 260, 16),
    new THREE.MeshLambertMaterial({ color: 0x8a7a55 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, -HALF - 8);
  sand.receiveShadow = true;
  group.add(sand);

  // Marina: five moored boats on the water.
  const boats = [];
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xd8d8e0 });
  const hullMat2 = new THREE.MeshLambertMaterial({ color: 0x3a6ea5 });
  for (let i = 0; i < 5; i += 1) {
    const bx = -120 + i * 60 + rng.range(-8, 8);
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 12), i % 2 ? hullMat : hullMat2);
    hull.position.y = 0.4;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0xf0ead8 }));
    cabin.position.set(0, 1.8, -1);
    boat.add(cabin);
    boat.position.set(bx, -0.2, -HALF - 46 - rng.range(0, 30));
    boat.rotation.y = rng.range(-0.15, 0.15);
    group.add(boat);
    boats.push(boat);
  }

  // Building textures: three facade variants.
  const facades = [
    makeWindowTexture(rng, '#2a2a38', ['#ffd27a', '#ffe9a8', '#9fd8ff']),
    makeWindowTexture(rng, '#33262e', ['#ffb36b', '#ffd27a', '#ff9d5c']),
    makeWindowTexture(rng, '#24303a', ['#9fd8ff', '#ffd27a', '#c8f0ff']),
  ];
  const facadeMats = facades.map(
    (tex) => new THREE.MeshLambertMaterial({ map: tex, emissive: 0x555544, emissiveMap: tex, emissiveIntensity: 0.55 }),
  );

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBuilding(x, z, w, h, d, mat) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    addCollider(x, z, w / 2, d / 2);
    return m;
  }

  const isLandmark = (bx, bz) => Object.values(LANDMARKS).some((l) => l.bx === bx && l.bz === bz);

  // Ordinary blocks: one to three buildings each.
  for (let bx = 0; bx < GRID; bx += 1) {
    for (let bz = 0; bz < GRID; bz += 1) {
      if (isLandmark(bx, bz)) continue;
      const cx = cellCenter(bx);
      const cz = cellCenter(bz);
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k += 1) {
        const w = rng.range(9, 15);
        const d = rng.range(9, 15);
        const h = rng.range(8, 38);
        const ox = rng.range(-7, 7);
        const oz = rng.range(-7, 7);
        addBuilding(cx + ox, cz + oz, w, h, d, rng.pick(facadeMats));
      }
    }
  }

  // --- Landmarks (fixed positions) ---
  const pts = {};
  function landmarkPoint(bx, bz, dx, dz) {
    return { x: cellCenter(bx) + dx, z: cellCenter(bz) + dz };
  }

  // Meridian Tower: 92 m, beacon on top.
  {
    const { bx, bz } = LANDMARKS.tower;
    const cx = cellCenter(bx);
    const cz = cellCenter(bz);
    addBuilding(cx, cz, 22, 92, 22, facadeMats[2]);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2a55 }),
    );
    beacon.position.set(cx, 94, cz);
    group.add(beacon);
    const beaconLight = new THREE.PointLight(0xff2a55, 60, 120);
    beaconLight.position.set(cx, 94, cz);
    group.add(beaconLight);
    pts.tower = { x: cx, z: cz };
  }
  // Luna Casino: wide, low, magenta neon.
  {
    const { bx, bz } = LANDMARKS.casino;
    const cx = cellCenter(bx);
    const cz = cellCenter(bz);
    addBuilding(cx, cz, 26, 14, 18, facadeMats[1]);
    const sign = neonSign('LUNA CASINO', '#ff4fd8', 20, 5);
    sign.position.set(cx, 12, cz - 9.2);
    group.add(sign);
    pts.casino = { x: cx, z: cz + 14 };
  }
  // Rosa's Garage: mission 1 delivery point in front of it.
  {
    const { bx, bz } = LANDMARKS.garage;
    const cx = cellCenter(bx);
    const cz = cellCenter(bz);
    addBuilding(cx, cz, 20, 9, 14, facadeMats[0]);
    const sign = neonSign("ROSA'S GARAGE", '#ffb347', 16, 4);
    sign.position.set(cx, 8, cz - 7.2);
    group.add(sign);
    pts.garage = landmarkPoint(bx, bz, 0, 16);
  }
  // Pelican Diner: mission 2 drop-off.
  {
    const { bx, bz } = LANDMARKS.diner;
    const cx = cellCenter(bx);
    const cz = cellCenter(bz);
    addBuilding(cx, cz, 16, 10, 14, facadeMats[1]);
    const sign = neonSign('PELICAN DINER', '#7ae0ff', 16, 4);
    sign.position.set(cx, 9, cz - 7.2);
    group.add(sign);
    pts.diner = landmarkPoint(bx, bz, 0, 14);
  }
  // Crew hideout: respawn point.
  {
    const { bx, bz } = LANDMARKS.hideout;
    const cx = cellCenter(bx);
    const cz = cellCenter(bz);
    addBuilding(cx, cz, 12, 7, 10, facadeMats[0]);
    pts.hideout = landmarkPoint(bx, bz, 0, 10);
  }
  // Park: green lawn and trees.
  {
    const { bx, bz } = LANDMARKS.park;
    const cx = cellCenter(bx);
    const cz = cellCenter(bz);
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(BLOCK, BLOCK),
      new THREE.MeshLambertMaterial({ color: 0x2f6b34 }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, 0.03, cz);
    lawn.receiveShadow = true;
    group.add(lawn);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
    for (let i = 0; i < 7; i += 1) {
      const tx = cx + rng.range(-11, 11);
      const tz = cz + rng.range(-11, 11);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3, 6), trunkMat);
      trunk.position.set(tx, 1.5, tz);
      trunk.castShadow = true;
      group.add(trunk);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 8), leafMat);
      leaves.position.set(tx, 5.5, tz);
      leaves.castShadow = true;
      group.add(leaves);
      addCollider(tx, tz, 0.7, 0.7);
    }
    pts.park = { x: cx, z: cz };
  }
  // Plaza: open paved square for the mission-3 brawl.
  {
    const { bx, bz } = LANDMARKS.plaza;
    const cx = cellCenter(bx);
    const cz = cellCenter(bz);
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(BLOCK, BLOCK),
      new THREE.MeshLambertMaterial({ color: 0x555560 }),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(cx, 0.04, cz);
    slab.receiveShadow = true;
    group.add(slab);
    pts.plaza = { x: cx, z: cz };
  }

  // Streetlights along every road, alternating sides.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let i = 0; i < GRID; i += 1) {
    for (let j = 0; j < GRID; j += 1) {
      const x = -HALF + i * PITCH + (j % 2 ? 8 : -8);
      const z = -HALF + j * PITCH;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), poleMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
      lamp.position.set(x, 7.1, z);
      group.add(lamp);
    }
  }

  // Traffic lights at the four central intersections; they cycle.
  const lights = [];
  const lightGeo = new THREE.BoxGeometry(0.7, 2.2, 0.7);
  const lightMats = {
    red: new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    amber: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
    green: new THREE.MeshBasicMaterial({ color: 0x22ff66 }),
    off: new THREE.MeshBasicMaterial({ color: 0x331111 }),
  };
  for (const [ix, iz] of [[3, 3], [3, 4], [4, 3], [4, 4]]) {
    const x = -HALF + ix * PITCH;
    const z = -HALF + iz * PITCH;
    const housing = new THREE.Mesh(lightGeo, new THREE.MeshLambertMaterial({ color: 0x111114 }));
    housing.position.set(x + 8, 3.4, z + 8);
    group.add(housing);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lightMats.green);
    lamp.position.set(x + 8, 4.1, z + 8);
    group.add(lamp);
    lights.push({ lamp, phase: (ix + iz) % 2 });
  }
  let lightTimer = 0;
  function update(dt) {
    lightTimer += dt;
    const cycle = Math.floor(lightTimer / 6) % 3;
    for (const l of lights) {
      const state = (cycle + l.phase) % 3;
      l.lamp.material = state === 0 ? lightMats.green : state === 1 ? lightMats.amber : lightMats.red;
    }
    // Gentle water shimmer.
    water.position.y = -0.3 + Math.sin(lightTimer * 0.7) * 0.08;
  }

  // True when the traffic light at the central intersection nearest to
  // (x, z) is red right now. Traffic uses it to stop at red lights.
  const CENTRAL = [[3, 3], [3, 4], [4, 3], [4, 4]];
  function lightRedAt(x, z) {
    for (const [ix, iz] of CENTRAL) {
      const lx = -HALF + ix * PITCH;
      const lz = -HALF + iz * PITCH;
      if (Math.abs(x - lx) < 14 && Math.abs(z - lz) < 14) {
        const cycle = Math.floor(lightTimer / 6) % 3;
        const state = (cycle + ((ix + iz) % 2)) % 3;
        return state === 2;
      }
    }
    return false;
  }

  // A random point on a road (for traffic spawns).
  function roadPoint() {
    const along = rng.range(-HALF + 10, HALF - 10);
    const road = -HALF + rng.int(0, GRID) * PITCH;
    if (rng.chance(0.5)) return { x: road, z: along };
    return { x: along, z: road };
  }

  return {
    group,
    colliders,
    blocked,
    update,
    roadPoint,
    lightRedAt,
    garage: pts.garage,
    diner: pts.diner,
    tower: pts.tower,
    plaza: pts.plaza,
    hideout: pts.hideout,
    casino: pts.casino,
    park: pts.park,
    bounds: HALF,
    trafficLights: lights,
  };
}
