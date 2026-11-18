// Vehicles for Solmar Bay: the player's car, 14 traffic cars and the
// police cruisers. Traffic drives only on the road grid — a car runs along
// one road line at a time and turns only at intersections, so it can never
// cut across a block. Police chase the hero when the wanted level is up
// and ram the player's car (with a cooldown so a touch is not a shredder).
const THREE = window.THREE;

const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x8e44ad, 0x16a085, 0xe67e22, 0xecf0f1, 0x2c3e50];
const TRAFFIC_COUNT = 14;

function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2028 }),
  );
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(hx, 0.6, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const hx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(hx, 0.6, -2.22);
    g.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.35;
    bar.add(red);
    bar.add(blue);
    bar.position.set(0, 1.45, -0.2);
    g.add(bar);
    lightBar = { red, blue, phase: false, timer: 0 };
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  return { group: g, wheels, lightBar };
}

function roadCoord(rng) {
  // A coordinate that lies on a road centreline.
  return -176 + rng.int(0, 8) * 44;
}

export function createVehicles(scene, city, rng, audio) {
  const cars = [];
  const traffic = [];
  const parked = [];
  const police = [];
  let playerCar = null;

  function spawnCar(color, isPolice, x, z, heading) {
    const { group, wheels, lightBar } = makeCarMesh(color, isPolice);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    const car = {
      mesh: group, wheels, lightBar, color, isPolice,
      x, z, heading, speed: 0, damage: 0, ramCooldown: 0,
    };
    cars.push(car);
    return car;
  }

  // --- Traffic: 14 cars running the grid ---
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = roadCoord(rng);
    const along = rng.range(-160, 160);
    const dir = rng.chance(0.5) ? 1 : -1;
    const x = axis === 'x' ? along : line;
    const z = axis === 'x' ? line : along;
    const car = spawnCar(rng.pick(CAR_COLORS), false, x, z, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    car.axis = axis;
    car.line = line;
    car.along = along;
    car.dir = dir;
    car.targetAlong = along + dir * rng.range(30, 120);
    car.cruise = rng.range(7, 11);
    car.stopped = 0;
    traffic.push(car);
  }

  // --- Parked cars the hero can steal ---
  for (let i = 0; i < 8; i += 1) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = roadCoord(rng);
    const along = rng.range(-150, 150);
    const x = axis === 'x' ? along : line + (rng.chance(0.5) ? 5.5 : -5.5);
    const z = axis === 'x' ? line + (rng.chance(0.5) ? 5.5 : -5.5) : along;
    const car = spawnCar(rng.pick(CAR_COLORS), false, x, z, axis === 'x' ? Math.PI / 2 : 0);
    car.parked = true;
    parked.push(car);
  }

  function nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of parked) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function giveCar(kind, x, z, heading) {
    if (playerCar) return playerCar;
    const color = kind === 'taxi' ? 0xf1c40f : rng.pick(CAR_COLORS);
    const car = spawnCar(color, false, x, z, heading);
    car.isPlayer = true;
    playerCar = car;
    return car;
  }

  // Steal a parked car: it stops being parked and becomes the player's car.
  function stealParked(car) {
    const idx = parked.indexOf(car);
    if (idx >= 0) parked.splice(idx, 1);
    car.parked = false;
    car.isPlayer = true;
    playerCar = car;
    return car;
  }

  function removePlayerCar() {
    if (!playerCar) return;
    scene.remove(playerCar.mesh);
    const idx = cars.indexOf(playerCar);
    if (idx >= 0) cars.splice(idx, 1);
    playerCar = null;
  }

  function spawnPolice(x, z) {
    const car = spawnCar(0xecf0f1, true, x, z, 0);
    car.isPolice = true;
    car.cruise = 15;
    police.push(car);
    return car;
  }

  function removePolice(car) {
    scene.remove(car.mesh);
    let idx = cars.indexOf(car);
    if (idx >= 0) cars.splice(idx, 1);
    idx = police.indexOf(car);
    if (idx >= 0) police.splice(idx, 1);
  }

  // Drive one traffic car along its road line.
  function updateTraffic(car, dt, G) {
    if (car.stopped > 0) {
      car.stopped -= dt;
      car.speed = Math.max(0, car.speed - 20 * dt);
    } else {
      // Slow for a red light near a central intersection.
      const nearRed = city.lightRedAt ? city.lightRedAt(car.x, car.z) : false;
      const target = nearRed ? 0 : car.cruise;
      car.speed += Math.sign(target - car.speed) * 6 * dt;
      car.speed = Math.max(0, Math.min(car.cruise, car.speed));
    }
    const step = car.dir * car.speed * dt;
    if (car.axis === 'x') car.x += step;
    else car.z += step;
    car.along += step;
    // Reached the end of this leg: continue or turn at an intersection.
    if ((car.dir > 0 && car.along >= car.targetAlong) || (car.dir < 0 && car.along <= car.targetAlong)) {
      const snapped = Math.round((car.along + 176) / 44) * 44 - 176;
      if (rng.chance(0.5)) {
        // Turn onto the crossing road at this intersection.
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.line = Math.max(-176, Math.min(176, snapped));
        car.along = car.line === car.x || car.axis === 'z' ? car.z : car.x;
        car.along = car.axis === 'x' ? car.x : car.z;
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.targetAlong = car.along + car.dir * rng.range(30, 120);
      } else {
        car.targetAlong = car.along + car.dir * rng.range(30, 120);
      }
      car.targetAlong = Math.max(-170, Math.min(170, car.targetAlong));
    }
    // Keep inside the city.
    if (car.along > 172 || car.along < -172) {
      car.dir *= -1;
      car.targetAlong = car.along + car.dir * rng.range(30, 120);
    }
    const targetHeading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += dh * Math.min(1, dt * 6);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.38;
  }

  function updatePolice(car, dt, G) {
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);
    // Chase the hero (in the car, or on foot as a last resort).
    const tx = G.heroX;
    const tz = G.heroZ;
    const dx = tx - car.x;
    const dz = tz - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 1.5));
    car.speed = Math.min(car.cruise + G.wanted * 1.5, car.speed + 12 * dt);
    car.heading += steer * 1.8 * dt * Math.min(1, car.speed / 8 + 0.3);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!city.blocked(nx, nz, 1.8)) {
      car.x = nx;
      car.z = nz;
    } else {
      car.speed *= 0.4;
    }
    // Ram: touch the player's car and it takes damage (cooldown 1.2 s).
    if (playerCar && car.ramCooldown <= 0) {
      const pd = Math.hypot(playerCar.x - car.x, playerCar.z - car.z);
      if (pd < 3.4) {
        car.ramCooldown = 1.2;
        const impact = Math.min(1, car.speed / 15);
        playerCar.damage += 4 + impact * 10;
        if (G.onCrash) G.onCrash(0.4 + impact * 0.6);
        // Shove the player's car sideways a touch.
        playerCar.x += Math.sin(car.heading) * 0.6;
        playerCar.z += Math.cos(car.heading) * 0.6;
      }
    }
    // Flashing light bar.
    if (car.lightBar) {
      car.lightBar.timer += dt;
      if (car.lightBar.timer > 0.28) {
        car.lightBar.timer = 0;
        car.lightBar.phase = !car.lightBar.phase;
        car.lightBar.red.material.color.setHex(car.lightBar.phase ? 0xff2222 : 0x551111);
        car.lightBar.blue.material.color.setHex(car.lightBar.phase ? 0x112255 : 0x2266ff);
      }
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.38;
  }

  function updatePlayer(dt, G) {
    if (!playerCar) return;
    const input = G.input;
    const fwd = input ? input.moveY() : 0;
    const steer = input ? input.moveX() : 0;
    const maxSpeed = 23; // ~51 mph
    if (fwd > 0) playerCar.speed += 14 * dt;
    else if (fwd < 0) playerCar.speed -= playerCar.speed > 0.5 ? 30 * dt : 8 * dt;
    else playerCar.speed -= Math.sign(playerCar.speed) * Math.min(Math.abs(playerCar.speed), 6 * dt);
    playerCar.speed = Math.max(-8, Math.min(maxSpeed, playerCar.speed));
    const turnAuthority = Math.min(1, Math.abs(playerCar.speed) / 6 + 0.25);
    playerCar.heading += steer * 1.9 * turnAuthority * dt * (playerCar.speed >= 0 ? 1 : -1);
    const nx = playerCar.x + Math.sin(playerCar.heading) * playerCar.speed * dt;
    const nz = playerCar.z + Math.cos(playerCar.heading) * playerCar.speed * dt;
    if (!city.blocked(nx, nz, 1.7)) {
      playerCar.x = nx;
      playerCar.z = nz;
    } else {
      // Hit a building: bounce, take damage, make noise.
      if (Math.abs(playerCar.speed) > 4) {
        const impact = Math.abs(playerCar.speed) / maxSpeed;
        playerCar.damage += impact * 12;
        if (G.onCrash) G.onCrash(impact);
      }
      playerCar.speed *= -0.25;
    }
    playerCar.mesh.position.set(playerCar.x, 0, playerCar.z);
    playerCar.mesh.rotation.y = playerCar.heading;
    for (const w of playerCar.wheels) w.rotation.x += (playerCar.speed * dt) / 0.38;
    // Engine hum follows speed.
    if (G.audio) G.audio.setEngine(Math.abs(playerCar.speed) / maxSpeed, true);
  }

  function update(dt, G) {
    for (const car of traffic) updateTraffic(car, dt, G);
    for (const car of [...police]) updatePolice(car, dt, G);
    updatePlayer(dt, G);
    // Parked cars never move, but keep their meshes in place.
    for (const car of parked) {
      car.mesh.position.set(car.x, 0, car.z);
    }
  }

  return {
    update,
    traffic,
    parked,
    police,
    spawnPolice,
    removePolice,
    giveCar,
    stealParked,
    removePlayerCar,
    nearestParked,
    get playerCar() { return playerCar; },
  };
}
