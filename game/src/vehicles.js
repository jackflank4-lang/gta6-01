// Vehicles: car meshes, arcade driving physics, traffic AI (with red-light
// stops), and the police pursuit that answers the wanted level.

import { Rng } from './rng.js';

const CAR_COLORS = [0xd23b3b, 0x3b7dd2, 0x37c978, 0xe8c93b, 0x8a5fd2, 0xd2691e, 0xdddddd, 0x222226, 0x37e0ff, 0xff6b9d];

function box(w, h, d, color, emissive = 0x000000) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive }),
  );
  mesh.castShadow = true;
  return mesh;
}

// Build a car mesh. Kinds: sedan, sport, taxi, truck, police.
export function makeCarMesh(kind, color) {
  const group = new THREE.Group();
  const bodyColor = kind === 'taxi' ? 0xf2c200 : kind === 'police' ? 0xf0f0f0 : color;
  const body = box(2.0, 0.62, 4.4, bodyColor);
  body.position.y = 0.62;
  group.add(body);
  const cabin = box(1.7, 0.55, 2.1, 0x18202e);
  cabin.position.set(0, 1.18, -0.25);
  group.add(cabin);
  if (kind === 'truck') {
    const bed = box(1.9, 0.5, 1.8, 0x5a5f6e);
    bed.position.set(0, 1.05, -1.2);
    group.add(bed);
  }
  if (kind === 'taxi') {
    const sign = box(0.9, 0.22, 0.5, 0xffd23e, 0x664400);
    sign.position.set(0, 1.58, -0.25);
    group.add(sign);
  }
  if (kind === 'police') {
    const barBase = box(1.2, 0.14, 0.5, 0x111111);
    barBase.position.set(0, 1.52, -0.25);
    group.add(barBase);
    const red = box(0.5, 0.16, 0.4, 0xff2222, 0xaa0000);
    red.position.set(-0.32, 1.6, -0.25);
    red.name = 'sirenRed';
    group.add(red);
    const blue = box(0.5, 0.16, 0.4, 0x2244ff, 0x0000aa);
    blue.position.set(0.32, 1.6, -0.25);
    blue.name = 'sirenBlue';
    group.add(blue);
    const door = box(0.06, 0.4, 2.2, 0x111111);
    door.position.set(1.01, 0.7, 0);
    group.add(door);
  }
  // Headlights and taillights.
  for (const sx of [-0.7, 0.7]) {
    const head = box(0.34, 0.16, 0.08, 0xfff6c9, 0x888844);
    head.position.set(sx, 0.62, 2.22);
    head.name = 'headlight';
    group.add(head);
    const tail = box(0.34, 0.16, 0.08, 0xff2222, 0x660000);
    tail.position.set(sx, 0.62, -2.22);
    group.add(tail);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
  group.userData.wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    group.userData.wheels.push(wheel);
  }
  group.userData.kind = kind;
  return group;
}

// Circle vs building AABB: push the circle out and report the hit normal.
export function collideCircleBox(x, z, radius, colliders) {
  let hit = null;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.001;
      const push = radius - d;
      x += (dx / d) * push;
      z += (dz / d) * push;
      hit = { nx: dx / d, nz: dz / d, depth: push };
    }
  }
  return { x, z, hit };
}

export class Car {
  constructor(mesh, kind, opts = {}) {
    this.mesh = mesh;
    this.kind = kind;
    this.x = opts.x ?? 0;
    this.z = opts.z ?? 0;
    this.heading = opts.heading ?? 0;
    this.speed = 0;
    this.maxSpeed = opts.maxSpeed ?? (kind === 'sport' ? 30 : kind === 'truck' ? 19 : 24);
    this.accel = opts.accel ?? 13;
    this.damage = 0; // 0..1; at 1 the car is wrecked
    this.isPolice = kind === 'police';
    this.isTraffic = !!opts.traffic;
    this.stolen = false;
    this.headlightsOn = false;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  setHeadlights(on) {
    this.headlightsOn = on;
    this.mesh.traverse((child) => {
      if (child.name === 'headlight') child.material.emissive.setHex(on ? 0xffffaa : 0x888844);
    });
  }

  // Arcade drive step. `throttle` in [-1, 1], `steer` in [-1, 1].
  drive(dt, throttle, steer, colliders) {
    if (this.damage >= 1) throttle = 0;
    const target = throttle * this.maxSpeed;
    const rate = throttle !== 0 ? this.accel : 9;
    if (this.speed < target) this.speed = Math.min(target, this.speed + rate * dt);
    else if (this.speed > target) this.speed = Math.max(target, this.speed - rate * dt);
    // Steering bites harder at speed, and reverses when backing up.
    const steerAuthority = Math.min(Math.abs(this.speed) / 8, 1) * (this.speed >= 0 ? 1 : -1);
    this.heading += steer * 1.9 * steerAuthority * dt;
    const f = this.forward();
    const nx = this.x + f.x * this.speed * dt;
    const nz = this.z + f.z * this.speed * dt;
    const res = collideCircleBox(nx, nz, 1.5, colliders);
    if (res.hit) {
      const impact = Math.abs(this.speed);
      if (impact > 6) this.damage = Math.min(1, this.damage + impact * 0.012);
      // Kill the velocity component into the wall.
      const along = f.x * res.hit.nx + f.z * res.hit.nz;
      if (along > 0) this.speed *= 0.35;
      this.x = res.x;
      this.z = res.z;
    } else {
      this.x = nx;
      this.z = nz;
    }
    // Keep inside the map (the bay is a hard wall).
    this.x = Math.max(-182, Math.min(182, this.x));
    this.z = Math.max(-182, Math.min(182, this.z));
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += this.speed * dt * 2.4;
  }
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(20261);
    this.cars = [];
    this.spawn();
  }

  spawn() {
    const lines = roadLinesLocal();
    for (let i = 0; i < 14; i++) {
      const kind = this.rng.pick(['sedan', 'sedan', 'sport', 'truck', 'sedan']);
      const mesh = makeCarMesh(kind, this.rng.pick(CAR_COLORS));
      this.scene.add(mesh);
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const line = this.rng.pick(lines);
      const along = this.rng.range(-170, 170);
      const car = new Car(mesh, kind, {
        x: axis === 'x' ? along : line,
        z: axis === 'x' ? line : along,
        heading: axis === 'x' ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (this.rng.chance(0.5) ? 0 : Math.PI),
        maxSpeed: this.rng.range(9, 14),
        traffic: true,
      });
      car.axis = axis;
      car.dir = this.rng.chance(0.5) ? 1 : -1;
      car.line = line;
      car.cruise = this.rng.range(9, 14);
      this.cars.push(car);
    }
  }

  // One AI step: follow the road, stop at red lights, don't rear-end.
  update(dt, timeSec, colliders, allCars) {
    const lines = roadLinesLocal();
    const axis = this.city.lightAxis(timeSec);
    for (const car of this.cars) {
      // Snap back onto the lane (traffic never leaves the road grid).
      if (car.axis === 'x') car.z += (car.line - car.z) * Math.min(1, dt * 2);
      else car.x += (car.line - car.x) * Math.min(1, dt * 2);

      let throttle = 1;
      // Red light: the car's own axis is red when the green axis is the other.
      const myGreen = (car.axis === 'x' && axis === 'ew') || (car.axis === 'z' && axis === 'ns');
      if (!myGreen) {
        const along = car.axis === 'x' ? car.x : car.z;
        const nextLine = nextRoadLine(along, car.dir, lines);
        if (nextLine !== null && Math.abs(nextLine - along) < 13 && Math.abs(nextLine - along) > 2) {
          throttle = 0.12; // crawl to the stop line
          if (Math.abs(nextLine - along) < 5.5) throttle = 0;
        }
      }
      // Car ahead on the same lane (traffic, police or the player): slow down.
      for (const other of allCars) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
        const lateral = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (ahead > 0 && ahead < 9 && lateral < 3) {
          throttle = Math.min(throttle, 0);
          if (ahead < 4.5) car.speed = Math.min(car.speed, 0);
        }
      }
      // Random turn at an intersection.
      const along = car.axis === 'x' ? car.x : car.z;
      if (Math.abs(along % 44) < 1.2 && this.rng.chance(dt * 2)) {
        const cross = car.axis === 'x' ? car.z : car.x;
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.line = Math.round(cross / 44) * 44;
        car.dir = this.rng.chance(0.5) ? 1 : -1;
      }
      car.drive(dt, throttle, 0, colliders);
      // Keep the heading on the lane.
      const targetHeading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += dh * Math.min(1, dt * 3);
      car.mesh.rotation.y = car.heading;
    }
  }
}

function roadLinesLocal() {
  const lines = [];
  for (let k = 0; k <= 8; k++) lines.push(-176 + k * 44);
  return lines;
}

function nextRoadLine(along, dir, lines) {
  let best = null;
  for (const line of lines) {
    const d = (line - along) * dir;
    if (d > 0.5 && (best === null || d < (best - along) * dir)) best = line;
  }
  return best;
}

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cruisers = [];
    this.spawnCooldown = 0;
    this.sirenBlink = 0;
  }

  wantedCruiserCount(wanted) {
    return wanted <= 0 ? 0 : wanted <= 2 ? 1 + (wanted - 1) : wanted <= 4 ? 3 : 4;
  }

  update(dt, timeSec, playerPos, wanted, colliders, onRam) {
    this.spawnCooldown -= dt;
    this.sirenBlink += dt;
    const want = this.wantedCruiserCount(wanted);
    // Spawn more cruisers while under strength.
    if (this.cruisers.length < want && this.spawnCooldown <= 0) {
      const spot = this.city.nearestRoadPoint(playerPos.x, playerPos.z);
      const mesh = makeCarMesh('police', 0xffffff);
      this.scene.add(mesh);
      const cruiser = new Car(mesh, 'police', {
        x: spot.x + (Math.random() * 30 - 15),
        z: spot.z + (Math.random() > 0.5 ? 42 : -42),
        maxSpeed: 31,
        accel: 16,
      });
      this.cruisers.push(cruiser);
      this.spawnCooldown = 2.5;
    }
    // Remove the extras when the heat dies down.
    while (this.cruisers.length > want) {
      const extra = this.cruisers.pop();
      this.scene.remove(extra.mesh);
    }
    for (const cruiser of this.cruisers) {
      if (cruiser.shotHold) {
        // Staged chase shot: cruise straight ahead at a steady gap instead
        // of pursuing, so the camera keeps the cruiser in frame.
        cruiser.drive(dt, 0.55, 0, colliders);
      } else {
        const dx = playerPos.x - cruiser.x;
        const dz = playerPos.z - cruiser.z;
        const dist = Math.hypot(dx, dz) || 1;
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - cruiser.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, dh * 1.6));
        const throttle = dist > 5 ? 1 : 0.5;
        cruiser.drive(dt, throttle, steer, colliders);
        // Ram: shove the player and deal damage on contact.
        if (dist < 3.6 && onRam) onRam(cruiser, dist);
      }
      // Flash the light bar.
      const on = Math.floor(this.sirenBlink * 4) % 2 === 0;
      cruiser.mesh.traverse((child) => {
        if (child.name === 'sirenRed') child.material.emissive.setHex(on ? 0xff0000 : 0x220000);
        if (child.name === 'sirenBlue') child.material.emissive.setHex(on ? 0x000022 : 0x0000ff);
      });
    }
  }

  clear() {
    for (const cruiser of this.cruisers) this.scene.remove(cruiser.mesh);
    this.cruisers = [];
  }
}
