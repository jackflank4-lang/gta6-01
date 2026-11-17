// Cars in Solmar Bay: how they look, how traffic drives them, how the police
// chase the player, and how the player's stolen car handles. Cars are built
// from boxes and cylinders only — no model files — with a small set of kinds
// (sedan, taxi, truck, sports, cruiser) that read at a glance in screenshots.

import { Rng } from './rng.js';

const CAR_COLORS = [0xc23b3b, 0x3b6fc2, 0xe8e8e8, 0x2c2c34, 0x3ba86b, 0xd9a03b, 0x7a4a9e, 0x4a9e9e];

export function makeCarMesh(kind, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a20 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1e2c3a });

  const low = kind === 'sports';
  const long = kind === 'truck';
  const bodyH = low ? 0.55 : 0.75;
  const bodyL = long ? 5.4 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, bodyH, bodyL), bodyMat);
  body.position.y = 0.55 + (low ? -0.1 : 0);
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, low ? 0.45 : 0.62, long ? 1.4 : 2.1),
    glassMat,
  );
  cabin.position.set(0, 0.55 + bodyH / 2 + (low ? 0.2 : 0.3), long ? 1.4 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), darkMat);
    spoiler.position.set(0, 1.15, -bodyL / 2 + 0.3);
    group.add(spoiler);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd23b }),
    );
    sign.position.set(0, 1.5, -0.2);
    group.add(sign);
  }

  // Wheels: cylinders spun so their axis lies across the car.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz * (long ? 1.25 : 1));
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), headMat);
    lamp.position.set(hx, 0.62, bodyL / 2 + 0.02);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const hx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06), tailMat);
    lamp.position.set(hx, 0.68, -bodyL / 2 - 0.02);
    group.add(lamp);
  }

  let lightBar = null;
  if (kind === 'cruiser') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    red.position.x = -0.4;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }),
    );
    blue.position.x = 0.4;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.45, -0.2);
    group.add(lightBar);
    group.userData.barRed = red;
    group.userData.barBlue = blue;
  }

  group.userData.wheels = wheels;
  group.userData.kind = kind;
  group.userData.lightBar = lightBar;
  return group;
}

// One spotlight, clipped to the player's car only (a light per traffic car
// would cost too much in SwiftShader).
export function attachHeadlight(car) {
  const spot = new THREE.SpotLight(0xfff2b0, 0, 55, 0.5, 0.5, 1.2);
  spot.position.set(0, 0.8, 1.8);
  const target = new THREE.Object3D();
  target.position.set(0, 0, 24);
  car.add(target);
  spot.target = target;
  car.add(spot);
  return spot;
}

function circleVsBox(px, pz, radius, box) {
  const cx = Math.max(box.x - box.hx, Math.min(px, box.x + box.hx));
  const cz = Math.max(box.z - box.hz, Math.min(pz, box.z + box.hz));
  const dx = px - cx;
  const dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return null;
  if (d2 < 1e-6) return { x: 0, z: radius };
  const d = Math.sqrt(d2);
  return { x: (dx / d) * (radius - d), z: (dz / d) * (radius - d) };
}

export function collideBuildings(pos, radius, city) {
  for (const box of city.colliders) {
    if (Math.abs(pos.x - box.x) > box.hx + radius + 2) continue;
    if (Math.abs(pos.z - box.z) > box.hz + radius + 2) continue;
    const push = circleVsBox(pos.x, pos.z, radius, box);
    if (push) {
      pos.x += push.x;
      pos.z += push.z;
      return true;
    }
  }
  return false;
}

// Traffic: cars looping rectangular routes around blocks, stopping at red
// lights and slowing for the car ahead. Parked cars sit at the kerb waiting
// to be stolen.
export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(4242);
    this.cars = [];
    this.parked = [];
    this.spawnMoving(14);
    this.spawnParked(10);
  }

  loopAroundBlock(bx, bz) {
    const x0 = -169 + bx * 44 + 7;
    const z0 = -169 + bz * 44 + 7;
    const x1 = x0 + 30;
    const z1 = z0 + 30;
    // Drive on the right: clockwise around the block, hugging the kerb.
    return [
      { x: x1 + 3.5, z: z0 - 3.5 },
      { x: x1 + 3.5, z: z1 + 3.5 },
      { x: x0 - 3.5, z: z1 + 3.5 },
      { x: x0 - 3.5, z: z0 - 3.5 },
    ];
  }

  spawnMoving(count) {
    for (let i = 0; i < count; i += 1) {
      const kind = this.rng.pick(['sedan', 'sedan', 'taxi', 'truck', 'sports', 'sedan']);
      const color = kind === 'taxi' ? 0xffd23b : this.rng.pick(CAR_COLORS);
      const mesh = makeCarMesh(kind, color);
      const bx = this.rng.int(0, 7);
      const bz = this.rng.int(0, 7);
      const path = this.loopAroundBlock(bx, bz);
      const start = this.rng.int(0, 3);
      mesh.position.set(path[start].x, 0, path[start].z);
      this.scene.add(mesh);
      this.cars.push({
        mesh, path, seg: start, speed: 0,
        cruise: this.rng.range(7, 11),
        kind,
      });
    }
  }

  spawnParked(count) {
    for (let i = 0; i < count; i += 1) {
      const kind = this.rng.pick(['sedan', 'sedan', 'sports', 'truck']);
      const mesh = makeCarMesh(kind, this.rng.pick(CAR_COLORS));
      const line = this.rng.pick([-132, -88, -44, 0, 44, 88, 132]);
      const along = this.rng.range(-150, 150);
      const horizontal = this.rng.chance(0.5);
      const x = horizontal ? along : line + 5.5;
      const z = horizontal ? line + 5.5 : along;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = horizontal ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      this.scene.add(mesh);
      this.parked.push({ mesh, kind });
    }
  }

  // The closest drivable car (moving or parked) to a point, within maxDist.
  nearestCar(pos, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.cars) {
      const d = Math.hypot(car.mesh.position.x - pos.x, car.mesh.position.z - pos.z);
      if (d < bestDist) { bestDist = d; best = { mesh: car.mesh, kind: car.kind, moving: car }; }
    }
    for (const car of this.parked) {
      const d = Math.hypot(car.mesh.position.x - pos.x, car.mesh.position.z - pos.z);
      if (d < bestDist) { bestDist = d; best = { mesh: car.mesh, kind: car.kind, parked: car }; }
    }
    return best;
  }

  // Take a car out of traffic (stolen by the player). Its mesh is returned
  // for the player car to adopt; the car stops being simulated.
  steal(entry) {
    if (entry.moving) {
      const index = this.cars.indexOf(entry.moving);
      if (index >= 0) this.cars.splice(index, 1);
    }
    if (entry.parked) {
      const index = this.parked.indexOf(entry.parked);
      if (index >= 0) this.parked.splice(index, 1);
    }
    return entry.mesh;
  }

  // Put a car back as a parked car where the player left it.
  abandon(mesh, kind) {
    this.parked.push({ mesh, kind });
  }

  update(dt, time) {
    for (const car of this.cars) {
      const target = car.path[(car.seg + 1) % 4];
      const dx = target.x - car.mesh.position.x;
      const dz = target.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const movingX = Math.abs(dx) > Math.abs(dz);

      // Stop at a red light when the next corner is an intersection.
      let want = car.cruise;
      const phase = this.city.lightPhaseAt(target.x, target.z, time);
      const redForMe = movingX ? (phase === 0 || phase === 1) : (phase === 2 || phase === 3);
      if (redForMe && dist < 12) want = 0;

      // Slow for the car ahead.
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = other.mesh.position.x - car.mesh.position.x;
        const oz = other.mesh.position.z - car.mesh.position.z;
        const ahead = movingX ? ox * Math.sign(dx) : oz * Math.sign(dz);
        const side = movingX ? Math.abs(oz) : Math.abs(ox);
        if (ahead > 0 && ahead < 9 && side < 3) want = Math.min(want, 0);
      }

      car.speed += Math.max(-14, Math.min(8, (want - car.speed))) * dt;
      if (car.speed < 0.05) car.speed = 0;
      if (dist < 1.2) {
        car.seg = (car.seg + 1) % 4;
        continue;
      }
      const step = Math.min(car.speed * dt, dist);
      car.mesh.position.x += (dx / dist) * step;
      car.mesh.position.z += (dz / dist) * step;
      const heading = Math.atan2(dx, dz);
      let diff = heading - car.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.mesh.rotation.y += diff * Math.min(1, dt * 6);
      for (const wheel of car.mesh.userData.wheels) {
        wheel.rotation.x += (car.speed * dt) / 0.42;
      }
    }
  }
}

// The police: cruisers that spawn when the player is wanted, chase, and ram.
// Their numbers grow with the wanted level; they give up when it clears.
export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(9911);
    this.cruisers = [];
    this.wanted = 0;
  }

  setWanted(n) {
    this.wanted = n;
    const want = Math.min(n, 4);
    while (this.cruisers.length < want) {
      const mesh = makeCarMesh('cruiser', 0x1c1c22);
      const angle = this.rng.range(0, Math.PI * 2);
      mesh.position.set(Math.cos(angle) * 60, 0, Math.sin(angle) * 60);
      this.scene.add(mesh);
      this.cruisers.push({ mesh, speed: 0, heading: 0, flash: this.rng.range(0, 1) });
    }
  }

  // Returns true when a cruiser is touching the player's car.
  update(dt, time, playerPos, playerSpeed) {
    let touching = false;
    const keep = [];
    for (const cop of this.cruisers) {
      if (this.wanted === 0) {
        this.scene.remove(cop.mesh);
        continue;
      }
      keep.push(cop);
      const dx = playerPos.x - cop.mesh.position.x;
      const dz = playerPos.z - cop.mesh.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      if (dist > 170) {
        // Teleport a lost cruiser back onto a road near the player.
        const angle = this.rng.range(0, Math.PI * 2);
        cop.mesh.position.set(playerPos.x + Math.cos(angle) * 55, 0, playerPos.z + Math.sin(angle) * 55);
        cop.speed = 0;
        continue;
      }
      const wantSpeed = 13 + this.wanted * 1.6;
      cop.speed += Math.max(-16, Math.min(10, (wantSpeed - cop.speed))) * dt;
      const heading = Math.atan2(dx, dz);
      let diff = heading - cop.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.mesh.rotation.y += diff * Math.min(1, dt * 3.2);
      cop.mesh.position.x += Math.sin(cop.mesh.rotation.y) * cop.speed * dt;
      cop.mesh.position.z += Math.cos(cop.mesh.rotation.y) * cop.speed * dt;
      if (collideBuildings(cop.mesh.position, 2, this.city)) cop.speed *= 0.5;
      if (dist < 3.4) touching = true;
      // Flashing light bar.
      const on = Math.sin(time * 10 + cop.flash * 6) > 0;
      cop.mesh.userData.barRed.material.color.setHex(on ? 0xff2020 : 0x550000);
      cop.mesh.userData.barBlue.material.color.setHex(on ? 0x101080 : 0x2040ff);
      for (const wheel of cop.mesh.userData.wheels) {
        wheel.rotation.x += (cop.speed * dt) / 0.42;
      }
    }
    this.cruisers = keep;
    return touching;
  }
}

// The car the player is driving: simple arcade handling — accelerate, brake,
// steer that tightens as you slow, handbrake drift — plus damage and repair.
export class PlayerCar {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.kind = 'sedan';
    this.speed = 0;
    this.heading = 0;
    this.damage = 0;
    this.headlight = null;
    this.headlightsOn = false;
    this.hornTimer = 0;
  }

  get active() { return this.mesh !== null; }
  get pos() { return this.mesh ? this.mesh.position : null; }

  takeOver(mesh, kind) {
    this.mesh = mesh;
    this.kind = kind;
    this.speed = 0;
    this.heading = mesh.rotation.y;
    this.damage = 0;
    this.headlight = attachHeadlight(mesh);
    this.headlight.intensity = 0;
  }

  abandon() {
    if (!this.mesh) return null;
    const mesh = this.mesh;
    if (this.headlight) {
      mesh.remove(this.headlight);
      this.headlight = null;
    }
    this.mesh = null;
    return mesh;
  }

  repair() { this.damage = 0; }

  update(dt, input, city, traffic) {
    if (!this.mesh) return;
    const move = input.moveVector();
    const maxSpeed = this.kind === 'sports' ? 40 : this.kind === 'truck' ? 28 : 34;
    const handbrake = input.down('Space');
    if (move.forward > 0) this.speed += 15 * dt;
    else if (move.forward < 0) this.speed -= this.speed > 0.5 ? 24 * dt : 9 * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    this.speed = Math.max(-11, Math.min(maxSpeed, this.speed));
    if (handbrake) this.speed *= Math.max(0, 1 - 1.6 * dt);

    const steer = move.strafe;
    const grip = handbrake ? 1.9 : 1.0;
    const turnRate = (2.4 - Math.min(1.4, Math.abs(this.speed) * 0.035)) * grip;
    this.heading += steer * turnRate * dt * (this.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(this.speed) / 4 + 0.25);

    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);
    this.mesh.position.x += forwardX * this.speed * dt;
    this.mesh.position.z += forwardZ * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = -steer * Math.min(0.06, Math.abs(this.speed) * 0.002) * (this.speed >= 0 ? 1 : -1);

    // Buildings stop the car; traffic cars shove each other aside.
    if (collideBuildings(this.mesh.position, 2.0, city)) {
      if (Math.abs(this.speed) > 8) {
        this.damage = Math.min(100, this.damage + Math.abs(this.speed) * 0.7);
        this.speed *= 0.35;
      } else {
        this.speed *= 0.6;
      }
    }
    for (const car of traffic.cars) {
      const dx = this.mesh.position.x - car.mesh.position.x;
      const dz = this.mesh.position.z - car.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 4.2) {
        const push = (4.2 - d) * 0.5;
        car.mesh.position.x -= (dx / d) * push;
        car.mesh.position.z -= (dz / d) * push;
        this.mesh.position.x += (dx / d) * push * 0.3;
        this.mesh.position.z += (dz / d) * push * 0.3;
        if (Math.abs(this.speed) > 10) this.damage = Math.min(100, this.damage + 4);
      }
    }
    // Keep the car inside the city and out of the water.
    this.mesh.position.x = Math.max(-172, Math.min(172, this.mesh.position.x));
    this.mesh.position.z = Math.max(-172, Math.min(174, this.mesh.position.z));

    const spin = (this.speed * dt) / 0.42;
    for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += spin;
    if (this.hornTimer > 0) this.hornTimer -= dt;
  }

  honk() {
    if (this.hornTimer > 0) return false;
    this.hornTimer = 0.5;
    return true;
  }

  toggleHeadlights() {
    this.headlightsOn = !this.headlightsOn;
    if (this.headlight) this.headlight.intensity = this.headlightsOn ? 2.2 : 0;
    return this.headlightsOn;
  }
}
