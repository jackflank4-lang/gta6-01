// City generation for Solmar Bay (v10): an 8x8 block grid, 30 m blocks, 14 m
// roads, a beach and marina on the south edge. A seeded RNG (seed 2026) drives
// the layout so the city is identical on every run. Buildings are boxes with
// canvas facade textures (lit windows); landmarks are placed by hand.

const BLOCK = 30;
const ROAD_W = 14;
const PITCH = 44;
const ROADS = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
const BLOCK_C = [-154, -110, -66, -22, 22, 66, 110, 154];

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d');
  const S = 1024 / 420; // px per metre, city spans -210..210
  const X = (mx) => (mx + 210) * S;
  const Z = (mz) => (mz + 210) * S;
  // Base: dark blue-grey ground.
  g.fillStyle = '#232733';
  g.fillRect(0, 0, 1024, 1024);
  // Blocks: slightly lighter pavement.
  for (const bx of BLOCK_C) {
    for (const bz of BLOCK_C) {
      g.fillStyle = '#2e3242';
      g.fillRect(X(bx - 15), Z(bz - 15), 30 * S, 30 * S);
      g.fillStyle = '#3a3f52';
      g.fillRect(X(bx - 15), Z(bz - 15), 30 * S, 2 * S);
    }
  }
  // Roads: near-black asphalt with a centre dash.
  g.fillStyle = '#171a21';
  for (const r of ROADS) {
    g.fillRect(X(r - 7), 0, 14 * S, 1024);
    g.fillRect(0, Z(r - 7), 1024, 14 * S);
  }
  g.fillStyle = '#c8a84a';
  for (const r of ROADS) {
    for (let m = -196; m < 200; m += 12) {
      g.fillRect(X(r) - 1, Z(m), 2, 6 * S);
      g.fillRect(X(m), Z(r) - 1, 6 * S, 2);
    }
  }
  // Park (green) and plaza (pale stone).
  g.fillStyle = '#1e4d2e';
  g.fillRect(X(-22 - 15), Z(22 - 15), 30 * S, 30 * S);
  g.fillStyle = '#6b6252';
  g.fillRect(X(22 - 15), Z(22 - 15), 30 * S, 30 * S);
  // Beach sand (south edge) and water beyond it.
  g.fillStyle = '#b89a68';
  g.fillRect(0, Z(176), 1024, (205 - 176) * S);
  const grad = g.createLinearGradient(0, Z(205), 0, 1024);
  grad.addColorStop(0, '#1a5a7a');
  grad.addColorStop(1, '#0a2a4a');
  g.fillStyle = grad;
  g.fillRect(0, Z(205), 1024, 1024 - Z(205));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function facadeTexture(seedRng, base, lit) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const on = seedRng.next() < lit;
      g.fillStyle = on ? '#ffd27a' : '#10131c';
      g.fillRect(8 + col * 20, 10 + row * 20, 12, 14);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 240, 128, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textTexture(text, fg, bg, fontPx) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = `bold ${fontPx || 72}px Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const THREE = window.THREE;
  const colliders = [];
  const animated = { boats: [], beacon: null, waterMat: null };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  // Sky: dusk gradient. Fog for depth.
  const skyC = document.createElement('canvas');
  skyC.width = 4;
  skyC.height = 256;
  const sg = skyC.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#160b2e');
  grad.addColorStop(0.55, '#4a2050');
  grad.addColorStop(0.8, '#b34a4a');
  grad.addColorStop(1, '#ff7a3c');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyC);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.Fog(0x2a1a3a, 190, 560);

  // Lights: warm dusk sun from the west, cool ambient, soft hemisphere.
  scene.add(new THREE.AmbientLight(0x604a6a, 0.85));
  const hemi = new THREE.HemisphereLight(0x8a6a9a, 0x1a1420, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.25);
  sun.position.set(-140, 110, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Water plane (animated offset) past the beach.
  const waterTexC = document.createElement('canvas');
  waterTexC.width = 128;
  waterTexC.height = 128;
  const wg = waterTexC.getContext('2d');
  wg.fillStyle = '#144a6e';
  wg.fillRect(0, 0, 128, 128);
  wg.strokeStyle = 'rgba(120,200,255,0.5)';
  wg.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    wg.beginPath();
    const y = 8 + i * 12;
    wg.moveTo(0, y);
    wg.bezierCurveTo(40, y - 5, 80, y + 5, 128, y);
    wg.stroke();
  }
  const waterTex = new THREE.CanvasTexture(waterTexC);
  waterTex.wrapS = THREE.RepeatWrapping;
  waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(6, 2);
  waterTex.colorSpace = THREE.SRGBColorSpace;
  const waterMat = new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 90), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.12, 245);
  scene.add(water);
  animated.waterMat = waterMat;

  // Facade materials (shared).
  const facades = [
    facadeTexture(rng, '#4a4a58', 0.5),
    facadeTexture(rng, '#5a4038', 0.42),
    facadeTexture(rng, '#38485a', 0.55),
    facadeTexture(rng, '#3d3a4d', 0.35),
  ];
  const facadeMats = facades.map((t) => new THREE.MeshLambertMaterial({
    map: t, emissive: 0x553311, emissiveMap: t, emissiveIntensity: 0.55,
  }));

  function addBuilding(cx, cz, w, h, d, matIdx) {
    const m = new THREE.Mesh(boxGeo, facadeMats[matIdx % facadeMats.length]);
    m.scale.set(w, h, d);
    m.position.set(cx, h / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    return m;
  }

  // Landmark blocks (col,row) -> skip generic buildings there.
  const parkKey = '3,4';
  const plazaKey = '4,4';
  const special = {
    '4,3': 'tower',
    '6,2': 'casino',
    '1,5': 'garage',
    '2,6': 'diner',
    '5,6': 'hideout',
  };

  for (let col = 0; col < 8; col += 1) {
    for (let row = 0; row < 8; row += 1) {
      const key = `${col},${row}`;
      if (key === parkKey || key === plazaKey || special[key]) continue;
      const cx = BLOCK_C[col];
      const cz = BLOCK_C[row];
      const n = rng.int(1, 3);
      if (n === 1) {
        addBuilding(cx, cz, rng.range(18, 24), rng.range(10, 34), rng.range(18, 24), rng.int(0, 3));
      } else if (n === 2) {
        addBuilding(cx - 7, cz, rng.range(10, 13), rng.range(8, 26), rng.range(16, 22), rng.int(0, 3));
        addBuilding(cx + 7, cz, rng.range(10, 13), rng.range(12, 38), rng.range(16, 22), rng.int(0, 3));
      } else {
        addBuilding(cx - 8, cz - 6, 11, rng.range(8, 20), 12, rng.int(0, 3));
        addBuilding(cx + 8, cz - 6, 11, rng.range(14, 30), 12, rng.int(0, 3));
        addBuilding(cx, cz + 8, 20, rng.range(6, 14), 9, rng.int(0, 3));
      }
    }
  }

  // Meridian Tower: 92 m, beacon on top, at block (22, -66).
  const towerMat = new THREE.MeshLambertMaterial({ map: facades[2], emissive: 0x332211, emissiveMap: facades[2], emissiveIntensity: 0.7 });
  const tower = new THREE.Mesh(boxGeo, towerMat);
  tower.scale.set(20, 92, 20);
  tower.position.set(22, 46, -66);
  tower.castShadow = true;
  scene.add(tower);
  colliders.push({ minX: 12, maxX: 32, minZ: -76, maxZ: -56 });
  const beaconBall = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff2a3c }),
  );
  beaconBall.position.set(22, 94, -66);
  scene.add(beaconBall);
  const beaconLight = new THREE.SpotLight(0xff3344, 90, 260, 0.35, 0.5, 1.2);
  beaconLight.position.set(22, 94, -66);
  beaconLight.target.position.set(22, 0, -160);
  scene.add(beaconLight);
  scene.add(beaconLight.target);
  animated.beacon = beaconLight;

  // Luna Casino: low wide building with a neon sign.
  const casino = addBuilding(110, -110, 26, 14, 22, 1);
  casino.material = new THREE.MeshLambertMaterial({ color: 0x7a2a5a, emissive: 0x441133 });
  const casinoSign = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ map: textTexture('LUNA', '#ffd24a', '#2a0a2a') }),
  );
  casinoSign.position.set(110, 12, -98.5);
  scene.add(casinoSign);

  // Rosa's Garage: low shed + sign; delivery point on the road south of it.
  const garageB = addBuilding(-110, 66, 22, 8, 18, 0);
  garageB.material = new THREE.MeshLambertMaterial({ color: 0x3a5a7a, emissive: 0x0a1a2a });
  const garageSign = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 4.5),
    new THREE.MeshBasicMaterial({ map: textTexture("ROSA'S", '#7ad4ff', '#0a1a2a') }),
  );
  garageSign.position.set(-110, 7, 75.5);
  scene.add(garageSign);

  // Pelican Diner.
  const diner = addBuilding(-66, 110, 20, 9, 16, 3);
  diner.material = new THREE.MeshLambertMaterial({ color: 0x6a4a2a, emissive: 0x221105 });
  const dinerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshBasicMaterial({ map: textTexture('PELICAN', '#ff9a5c', '#241105') }),
  );
  dinerSign.position.set(-66, 8, 118.5);
  scene.add(dinerSign);

  // Crew hideout.
  const hideout = addBuilding(66, 110, 18, 10, 16, 2);
  hideout.material = new THREE.MeshLambertMaterial({ color: 0x2a4a3a, emissive: 0x051205 });

  // Park trees.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2f1a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x1e5a2e });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
  const leafGeo = new THREE.ConeGeometry(2.6, 6, 8);
  for (let i = 0; i < 9; i += 1) {
    const tx = -22 + rng.range(-12, 12);
    const tz = 22 + rng.range(-12, 12);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(tx, 1.5, tz);
    scene.add(trunk);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(tx, 5.5, tz);
    leaf.castShadow = true;
    scene.add(leaf);
  }
  // A few sidewalk trees.
  for (let i = 0; i < 14; i += 1) {
    const bx = rng.pick(BLOCK_C);
    const bz = rng.pick(BLOCK_C);
    const tx = bx + rng.pick([-16, 16]);
    const tz = bz + rng.range(-14, 14);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(tx, 1.5, tz);
    scene.add(trunk);
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(tx, 5.5, tz);
    scene.add(leaf);
  }

  // Street lamps along the main roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
  for (const r of [-132, -44, 44, 132]) {
    for (let m = -160; m <= 160; m += 64) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(r + 7.5, 3, m);
      scene.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(r + 7.5, 6.2, m);
      scene.add(lamp);
    }
  }

  // Traffic-light gantries at the four central intersections.
  const lightState = { phase: 0, timer: 0 };
  const lightHeads = [];
  for (const [ix, iz] of [[0, 0], [0, 88], [88, 0], [-88, 0]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.5, 6), poleMat);
    post.position.set(ix + 8, 2.75, iz + 8);
    scene.add(post);
    const head = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
    head.scale.set(0.9, 2.2, 0.9);
    head.position.set(ix + 8, 5.4, iz + 8);
    scene.add(head);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(ix + 8, 5.9, iz + 8.5);
    scene.add(red);
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
    green.position.set(ix + 8, 5.0, iz + 8.5);
    scene.add(green);
    lightHeads.push({ red, green });
  }

  // Marina: docks + boats on the water.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  for (let i = 0; i < 3; i += 1) {
    const dock = new THREE.Mesh(boxGeo, dockMat);
    dock.scale.set(4, 0.6, 26);
    dock.position.set(-60 + i * 60, 0.4, 216);
    scene.add(dock);
  }
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const hullMat2 = new THREE.MeshLambertMaterial({ color: 0x3a6a8a });
  for (let i = 0; i < 4; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo, i % 2 ? hullMat2 : hullMat);
    hull.scale.set(3.2, 1.2, 8);
    hull.position.y = 0.6;
    boat.add(hull);
    const cabin = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x222a33 }));
    cabin.scale.set(2, 1.4, 3);
    cabin.position.set(0, 1.9, -0.5);
    boat.add(cabin);
    boat.position.set(-58 + i * 58, 0, 226 + (i % 2) * 10);
    scene.add(boat);
    animated.boats.push(boat);
  }

  function isRoad(x, z) {
    for (const r of ROADS) {
      if (Math.abs(x - r) <= 7.5 || Math.abs(z - r) <= 7.5) return true;
    }
    return false;
  }
  function nearestRoadCoord(v) {
    let best = ROADS[0];
    let bd = Infinity;
    for (const r of ROADS) {
      const d = Math.abs(v - r);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  function randomRoadPoint() {
    if (rng.next() < 0.5) {
      return { x: rng.pick(ROADS) + rng.range(-3.5, 3.5), z: rng.range(-176, 176) };
    }
    return { x: rng.range(-176, 176), z: rng.pick(ROADS) + rng.range(-3.5, 3.5) };
  }
  function randomSidewalkPoint() {
    const bx = rng.pick(BLOCK_C);
    const bz = rng.pick(BLOCK_C);
    const edge = rng.int(0, 3);
    if (edge === 0) return { x: bx + rng.range(-15, 15), z: bz - 16.5 };
    if (edge === 1) return { x: bx + rng.range(-15, 15), z: bz + 16.5 };
    if (edge === 2) return { x: bx - 16.5, z: bz + rng.range(-15, 15) };
    return { x: bx + 16.5, z: bz + rng.range(-15, 15) };
  }
  function collideCircle(x, z, r) {
    // Clamp to the playable bounds (water blocks the south).
    x = Math.max(-188, Math.min(188, x));
    z = Math.max(-188, Math.min(204, z));
    for (const b of colliders) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-6) {
          // Centre inside the box: push out along the smallest axis.
          const pl = x - b.minX;
          const pr = b.maxX - x;
          const pt = z - b.minZ;
          const pb = b.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.minX - r;
          else if (m === pr) x = b.maxX + r;
          else if (m === pt) z = b.minZ - r;
          else z = b.maxZ + r;
        } else {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        }
      }
    }
    return { x, z };
  }

  return {
    bounds: { minX: -188, maxX: 188, minZ: -188, maxZ: 204 },
    garage: { x: -110, z: 88 },
    tower: { x: 22, z: -66 },
    casino: { x: 110, z: -110 },
    diner: { x: -66, z: 110 },
    hideout: { x: 66, z: 110 },
    park: { x: -22, z: 22 },
    plaza: { x: 22, z: 22 },
    marina: { x: 0, z: 205 },
    colliders,
    animated,
    lightState,
    lightHeads,
    sun,
    isRoad,
    nearestRoadCoord,
    randomRoadPoint,
    randomSidewalkPoint,
    collideCircle,
  };
}
