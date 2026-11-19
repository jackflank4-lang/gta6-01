// Vehicles for Solmar Bay (v10): car meshes, traffic AI, police pursuit and
// arcade driving. Cars are boxes + cylinders with emissive lights; traffic
// follows the road grid and stops at red lights; police cruisers chase the
// player and ram. The player car is driven here too (enter/exit, damage).

const CAR_COLORS = {
  sedan: [0x8a2a2a, 0x2a4a8a, 0x3a5a3a, 0x888888, 0x222222, 0x7a5a2a],
  sports: [0xd42a7a, 0x2ad4c4, 0xff7a1a, 0x1a1a2a],
  van: [0xcccccc, 0x4a6a8a, 0x8a6a3a],
  taxi: [0xf2c200],
  cruiser: [0x1a1a22],
};

function buildCarMesh(scene, type, color) {
  const THREE = window.THREE;
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x0e1420 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 2.1), glass);
  cabin.position.set(0, 1.05, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
  for (const [wx, wz] of [[-0.88, 1.35], [0.88, 1.35], [-0.88, -1.35], [0.88, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    h.position.set(hx, 0.62, 2.12);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const hx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    t.position.set(hx, 0.62, -2.12);
    g.add(t);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe14a }),
    );
    sign.position.set(0, 1.42, -0.25);
    g.add(sign);
  }
  let lightBar = null;
  if (type === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.4, -0.25);
    g.add(bar);
    lightBar = {
      red: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2222 })),
      blue: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.52), new THREE.MeshBasicMaterial({ color: 0x2266ff })),
    };
    lightBar.red.position.set(-0.28, 1.42, -0.25);
    lightBar.blue.position.set(0.28, 1.42, -0.25);
    g.add(lightBar.red);
    g.add(lightBar.blue);
  }
  scene.add(g);
  return { group: g, lightBar };
}

export function createVehicles(game) {
  const THREE = window.THREE;
  const { scene, city, rng, audio } = game;
  const ROADS = [-176, -132, -88, -44, 0, 44, 88, 132, 176];

  const traffic = [];
  const parked = [];
  const police = [];
  let playerCar = null;
  let headlight = null;

  function makeCar(type, x, z, heading) {
    const colors = CAR_COLORS[type] || CAR_COLORS.sedan;
    const color = colors[Math.floor(rng.next() * colors.length)];
    const { group, lightBar } = buildCarMesh(scene, type, color);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    const car = {
      mesh: group, type, color, heading, speed: 0, damage: 0,
      lightBar, isPolice: type === 'cruiser', isParked: false,
      axis: 'x', line: 0, dir: 1, lane: 3.5, targetSpeed: 10,
      flashT: 0,
    };
    return car;
  }

  function spawnTraffic() {
    for (let i = 0; i < 14; i += 1) {
      const p = city.randomRoadPoint();
      const axis = Math.abs(p.x - city.nearestRoadCoord(p.x)) < 1 ? 'z' : 'x';
      const type = rng.next() < 0.18 ? 'taxi' : (rng.next() < 0.12 ? 'van' : (rng.next() < 0.15 ? 'sports' : 'sedan'));
      const car = makeCar(type, p.x, p.z, axis === 'x' ? (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng.next() < 0.5 ? 0 : Math.PI));
      car.axis = axis;
      car.line = axis === 'x' ? city.nearestRoadCoord(p.z) : city.nearestRoadCoord(p.x);
      car.dir = rng.next() < 0.5 ? 1 : -1;
      car.lane = rng.next() < 0.5 ? 3.5 : -3.5;
      car.targetSpeed = rng.range(8, 12);
      car.speed = car.targetSpeed;
      traffic.push(car);
    }
  }

  function spawnParked() {
    for (let i = 0; i < 8; i += 1) {
      const p = city.randomRoadPoint();
      const axis = rng.next() < 0.5 ? 'x' : 'z';
      const type = rng.next() < 0.25 ? 'sports' : 'sedan';
      const line = rng.pick(ROADS);
      const along = rng.range(-160, 160);
      const x = axis === 'x' ? along : line + 5.5;
      const z = axis === 'x' ? line + 5.5 : along;
      const car = makeCar(type, x, z, axis === 'x' ? Math.PI / 2 : 0);
      car.isParked = true;
      car.speed = 0;
      parked.push(car);
    }
  }

  function nearestRoadLine(v) {
    let best = ROADS[0];
    let bd = Infinity;
    for (const r of ROADS) {
      const d = Math.abs(v - r);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  function lightIsGreen(axis) {
    // phase 0: north-south (z axis) green. phase 1: east-west (x axis) green.
    return (city.lightState.phase === 0 && axis === 'z') || (city.lightState.phase === 1 && axis === 'x');
  }

  function updateTraffic(dt, time) {
    for (const car of traffic) {
      // Approaching an intersection? Slow for a red light.
      const along = car.axis === 'x' ? car.mesh.position.x : car.mesh.position.z;
      const nextLine = car.dir > 0
        ? ROADS.find((r) => r > along + 2) ?? 176
        : [...ROADS].reverse().find((r) => r < along - 2) ?? -176;
      const distTo = Math.abs(nextLine - along);
      let want = car.targetSpeed;
      if (distTo < 16 && !lightIsGreen(car.axis)) want = 0;
      // Car ahead in the same lane: match its speed.
      for (const other of traffic) {
        if (other === car || other.axis !== car.axis || other.line !== car.line || other.dir !== car.dir) continue;
        const oAlong = other.axis === 'x' ? other.mesh.position.x : other.mesh.position.z;
        const gap = (oAlong - along) * car.dir;
        if (gap > 0 && gap < 9) { want = Math.min(want, other.speed * 0.85); break; }
      }
      car.speed += Math.max(-14 * dt, Math.min(8 * dt, want - car.speed));
      if (car.speed < 0.05 && want === 0) car.speed = 0;
      // Move along the road.
      const step = car.speed * dt * car.dir;
      if (car.axis === 'x') car.mesh.position.x += step;
      else car.mesh.position.z += step;
      // Reached the intersection: maybe turn.
      if (distTo < 2.5) {
        const cross = car.axis === 'x' ? car.mesh.position.z : car.mesh.position.x;
        if (rng.next() < 0.35) {
          const newAxis = car.axis === 'x' ? 'z' : 'x';
          const newLine = nearestRoadLine(cross);
          car.axis = newAxis;
          car.line = newLine;
          car.dir = rng.next() < 0.5 ? 1 : -1;
          car.lane = rng.next() < 0.5 ? 3.5 : -3.5;
          if (newAxis === 'x') { car.mesh.position.z = newLine + car.lane; }
          else { car.mesh.position.x = newLine + car.lane; }
        }
      }
      // Heading follows the axis and direction.
      const wantHeading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      car.heading += dh * Math.min(1, 6 * dt);
      car.mesh.rotation.y = car.heading;
      // Keep the car glued to its lane.
      if (car.axis === 'x') car.mesh.position.z = car.line + car.lane;
      else car.mesh.position.x = car.line + car.lane;
      // Wrap around the city edge.
      const p = car.mesh.position;
      if (p.x > 185) p.x = -185;
      if (p.x < -185) p.x = 185;
      if (p.z > 185) p.z = -185;
      if (p.z < -185) p.z = 185;
    }
    void time;
  }

  function spawnPolice(count, near) {
    while (police.length < count) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(42, 60);
      let x = near.x + Math.sin(a) * d;
      let z = near.z + Math.cos(a) * d;
      const snapped = city.collideCircle(x, z, 2);
      x = snapped.x;
      z = snapped.z;
      const car = makeCar('cruiser', x, z, Math.atan2(near.x - x, near.z - z));
      car.speed = 12;
      police.push(car);
      game.audio.startSiren();
    }
  }

  function removePolice(count) {
    while (police.length > count) {
      const car = police.pop();
      scene.remove(car.mesh);
    }
  }

  function updatePolice(dt, playerPos, playerInCar, time) {
    for (const car of police) {
      const dx = playerPos.x - car.mesh.position.x;
      const dz = playerPos.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      const turn = Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      car.heading += turn;
      car.mesh.rotation.y = car.heading;
      let want = 0;
      if (playerInCar) want = dist > 5 ? 30 : 12;
      else want = dist > 11 ? 18 : 0;
      car.speed += Math.max(-16 * dt, Math.min(12 * dt, want - car.speed));
      const step = car.speed * dt;
      const nx = car.mesh.position.x + Math.sin(car.heading) * step;
      const nz = car.mesh.position.z + Math.cos(car.heading) * step;
      const fixed = city.collideCircle(nx, nz, 2.1);
      const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
      car.mesh.position.x = fixed.x;
      car.mesh.position.z = fixed.z;
      if (hitWall && car.speed > 8) {
        car.speed *= 0.4;
        car.damage += 4;
      }
      // Ram the player car.
      if (playerInCar && dist < 4.2 && car.speed > 6) {
        game.onPoliceRam(car);
        car.speed *= 0.5;
      }
      // Flash the light bar.
      if (car.lightBar) {
        car.flashT += dt;
        const on = Math.floor(car.flashT * 4) % 2 === 0;
        car.lightBar.red.material.color.setHex(on ? 0xff2222 : 0x440000);
        car.lightBar.blue.material.color.setHex(on ? 0x002244 : 0x2266ff);
      }
    }
    void time;
  }

  function enterCar(car) {
    if (playerCar) return false;
    const idx = parked.indexOf(car);
    if (idx >= 0) parked.splice(idx, 1);
    const ti = traffic.indexOf(car);
    if (ti >= 0) traffic.splice(ti, 1);
    playerCar = car;
    car.isParked = false;
    game.hero.mesh.visible = false;
    // Headlight spotlight for the player car.
    if (!headlight) {
      headlight = new THREE.SpotLight(0xfff2c8, 0, 55, 0.5, 0.45, 1.0);
      headlight.position.set(0, 1, 2);
      const tgt = new THREE.Object3D();
      tgt.position.set(0, 0, 22);
      car.mesh.add(tgt);
      headlight.target = tgt;
      car.mesh.add(headlight);
    } else {
      car.mesh.add(headlight);
    }
    headlight.intensity = game.lightsOn ? 60 : 0;
    audio.startEngine();
    return true;
  }

  function exitCar() {
    if (!playerCar) return null;
    const car = playerCar;
    playerCar = null;
    const hx = car.mesh.position.x - Math.sin(car.heading) * 0 + Math.cos(car.heading) * 2.6;
    const hz = car.mesh.position.z - Math.cos(car.heading) * 0 + -Math.sin(car.heading) * 2.6;
    const fixed = city.collideCircle(hx, hz, 0.8);
    game.hero.pos.set(fixed.x, 0, fixed.z);
    game.hero.mesh.visible = true;
    car.isParked = true;
    parked.push(car);
    audio.setEngine(0, false);
    return car;
  }

  function giveCar(type, x, z, heading) {
    if (playerCar) {
      scene.remove(playerCar.mesh);
      playerCar = null;
    }
    const car = makeCar(type || 'sedan', x, z, heading || 0);
    car.damage = 0;
    enterCar(car);
    return car;
  }

  function drivePlayer(dt, input) {
    if (!playerCar) return 0;
    const car = playerCar;
    const mv = input.moveVector();
    const maxSpeed = 28 * (1 - car.damage / 220);
    if (mv.z > 0) car.speed += 14 * dt;
    else if (mv.z < 0) {
      if (car.speed > 0.5) car.speed -= 22 * dt;
      else car.speed -= 8 * dt;
    } else {
      car.speed -= car.speed * 0.45 * dt;
    }
    if (car.speed > maxSpeed) car.speed = maxSpeed;
    if (car.speed < -8) car.speed = -8;
    const steerAuthority = 1.9 / (1 + Math.abs(car.speed) * 0.045);
    car.heading += -mv.x * steerAuthority * Math.sign(car.speed || 1) * Math.min(1, Math.abs(car.speed) / 6 + 0.25) * dt;
    const step = car.speed * dt;
    const nx = car.mesh.position.x + Math.sin(car.heading) * step;
    const nz = car.mesh.position.z + Math.cos(car.heading) * step;
    const before = { x: car.mesh.position.x, z: car.mesh.position.z };
    const fixed = city.collideCircle(nx, nz, 2.1);
    const hit = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
    car.mesh.position.x = fixed.x;
    car.mesh.position.z = fixed.z;
    if (hit) {
      const impact = Math.abs(car.speed);
      if (impact > 6) {
        car.damage = Math.min(100, car.damage + (impact - 6) * 1.4);
        audio.crash(impact / 28);
        game.onCarCrash(impact);
      }
      car.speed *= 0.35;
    }
    // Bump traffic cars out of the way.
    for (const other of traffic) {
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 3.6) {
        const push = (3.6 - d) / 3.6;
        other.mesh.position.x += (dx / d) * push * 1.2;
        other.mesh.position.z += (dz / d) * push * 1.2;
        if (Math.abs(car.speed) > 8) {
          car.damage = Math.min(100, car.damage + 1.5);
          car.speed *= 0.85;
          audio.crash(0.3);
        }
      }
    }
    car.mesh.rotation.y = car.heading;
    void before;
    return car.speed;
  }

  function nearestStealable(x, z, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const car of parked) {
      const d = Math.hypot(car.mesh.position.x - x, car.mesh.position.z - z);
      if (d < bd) { bd = d; best = car; }
    }
    for (const car of traffic) {
      const d = Math.hypot(car.mesh.position.x - x, car.mesh.position.z - z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  function setHeadlights(on) {
    if (headlight) headlight.intensity = on ? 60 : 0;
  }

  spawnTraffic();
  spawnParked();

  return {
    traffic, parked, police, spawnPolice, removePolice,
    updateTraffic, updatePolice, enterCar, exitCar, giveCar, drivePlayer,
    nearestStealable, setHeadlights,
    get playerCar() { return playerCar; },
  };
}
