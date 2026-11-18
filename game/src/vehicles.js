// vehicles.js — cars, traffic, police and the player's ride.
// Traffic drives the road grid on fixed lanes and turns at random
// intersections; police cruisers spawn by wanted level and ram the
// player's car. Player driving is arcade: W/S accelerate and brake,
// A/D steer, E enters and exits the nearest car.
import { makeRng } from './rng.js';

const ROADS = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
const CAR_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x95a5a6, 0x1a1a1a, 0xe8e8e8, 0x16a085];

function buildCarMesh(color, police) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xe8e8e8 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: police ? 0x1a1a1a : 0x111522 }),
  );
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
    h.position.set(x, 0.6, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  for (const x of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    t.position.set(x, 0.6, -2.22);
    g.add(t);
  }
  if (police) {
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barR.position.set(-0.45, 1.6, -0.2);
    g.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2020ff }));
    barB.position.set(0.45, 1.6, -0.2);
    g.add(barB);
    g.userData.barR = barR;
    g.userData.barB = barB;
  }
  return g;
}

export class Vehicles {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.rng = makeRng(555);
    this.cars = []; // traffic + parked (not police)
    this.cruisers = [];
    this.playerCar = null;
    this._flashT = 0;
    this._spawnTraffic();
  }

  _addCar(x, z, heading, parked, police, color) {
    const mesh = buildCarMesh(color, police);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = {
      pos: mesh.position,
      heading,
      speed: 0,
      parked,
      police,
      mesh,
      color,
      damage: 0,
      topSpeed: police ? 30 : this.rng.range(9, 14),
      // traffic route state
      axis: Math.abs(Math.sin(heading)) > 0.5 ? 'x' : 'z',
      dir: Math.sin(heading) !== 0 ? Math.sign(Math.sin(heading)) : Math.sign(Math.cos(heading)),
      lane: this.rng.pick([-3.5, 3.5]),
      turnCooldown: this.rng.range(1, 4),
    };
    if (police) this.cruisers.push(car);
    else this.cars.push(car);
    return car;
  }

  _spawnTraffic() {
    // Parked cars along the curbs.
    for (let i = 0; i < 14; i++) {
      const road = this.rng.pick(ROADS);
      const along = this.rng.range(-160, 160);
      const side = this.rng.pick([-1, 1]);
      const horizontal = this.rng.chance(0.5);
      const x = horizontal ? along : road + side * 5.5;
      const z = horizontal ? road + side * 5.5 : along;
      const heading = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
      this._addCar(x, z, heading, true, false, this.rng.pick(CAR_COLORS));
    }
    // Moving traffic on the roads.
    for (let i = 0; i < 12; i++) {
      const road = this.rng.pick(ROADS);
      const along = this.rng.range(-160, 160);
      const horizontal = this.rng.chance(0.5);
      const dir = this.rng.pick([-1, 1]);
      const x = horizontal ? along : road + (dir > 0 ? 3.5 : -3.5);
      const z = horizontal ? road + (dir > 0 ? 3.5 : -3.5) : along;
      const heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const car = this._addCar(x, z, heading, false, false, this.rng.pick(CAR_COLORS));
      car.speed = car.topSpeed * this.rng.range(0.6, 1);
    }
  }

  nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of [...this.cars, ...this.cruisers]) {
      if (c === this.playerCar) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  enterCar(car) {
    if (!car) return null;
    car.parked = false;
    car.speed = 0;
    this.playerCar = car;
    return car;
  }

  exitCar() {
    if (!this.playerCar) return null;
    const car = this.playerCar;
    car.speed = 0;
    car.parked = true;
    this.playerCar = null;
    return car;
  }

  spawnCruiser(nearX, nearZ) {
    const road = this.rng.pick(ROADS);
    const edge = this.rng.pick([-1, 1]);
    const x = edge > 0 ? nearX + 40 : nearX - 40;
    const z = road;
    const heading = Math.atan2(nearX - x, nearZ - z);
    const c = this._addCar(x, z, heading, false, true, 0xffffff);
    c.speed = 12;
    return c;
  }

  despawnCruisers() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = [];
  }

  cruiserCountFor(wanted) {
    if (wanted <= 0) return 0;
    if (wanted === 1) return 1;
    if (wanted === 2) return 2;
    if (wanted <= 4) return 3;
    return 4;
  }

  update(dt, input, hero, wanted) {
    this._flashT += dt;
    // Flash police light bars.
    for (const c of this.cruisers) {
      const on = Math.sin(this._flashT * 10) > 0;
      if (c.mesh.userData.barR) c.mesh.userData.barR.material.color.setHex(on ? 0xff2020 : 0x550000);
      if (c.mesh.userData.barB) c.mesh.userData.barB.material.color.setHex(on ? 0x2020ff : 0x000055);
    }
    // Player car physics.
    if (this.playerCar) this._updatePlayerCar(dt, input);
    // Traffic AI.
    for (const car of this.cars) {
      if (car === this.playerCar) continue;
      this._updateTrafficCar(dt, car);
    }
    // Police pursuit.
    const want = this.cruiserCountFor(wanted);
    const target = this.playerCar ? this.playerCar.pos : (hero.onFoot ? hero.pos : null);
    while (this.cruisers.length < want && target) {
      this.spawnCruiser(target.x, target.z);
    }
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
    for (const c of this.cruisers) this._updateCruiser(dt, c, target, hero);
  }

  _updatePlayerCar(dt, input) {
    const car = this.playerCar;
    const axes = input.axes();
    const forward = axes.y;
    const steer = axes.x;
    if (forward > 0) car.speed += 12 * dt;
    else if (forward < 0) {
      if (car.speed > 0.5) car.speed -= 22 * dt; // brake
      else car.speed -= 7 * dt; // reverse
    } else {
      car.speed -= car.speed * 0.6 * dt; // drag
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    car.speed = Math.max(-9, Math.min(car.topSpeed + 16, car.speed));
    const spd = Math.abs(car.speed);
    if (spd > 0.1) {
      const turn = steer * 1.9 * Math.min(1, spd / 8) * (car.speed >= 0 ? 1 : -1);
      car.heading += turn * dt;
    }
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const nx = car.pos.x + fx * car.speed * dt;
    const nz = car.pos.z + fz * car.speed * dt;
    const beforeX = car.pos.x, beforeZ = car.pos.z;
    car.pos.x = nx;
    car.pos.z = nz;
    // Building collision: slide off, take damage on hard hits.
    const hit = this.city.resolveCircle(car.pos, 2.2);
    if (hit) {
      const impact = Math.abs(car.speed);
      if (impact > 6) {
        car.damage += (impact - 6) * 2.5;
        this.audio.crash(impact > 14);
      }
      car.speed *= 0.45;
    }
    // World bounds.
    car.pos.x = Math.max(-196, Math.min(196, car.pos.x));
    car.pos.z = Math.max(-196, Math.min(232, car.pos.z));
    // Bump into other cars.
    for (const other of [...this.cars, ...this.cruisers]) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 16 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (4 - d) / 2;
        const ux = dx / d, uz = dz / d;
        other.pos.x += ux * push;
        other.pos.z += uz * push;
        car.pos.x -= ux * push * 0.5;
        car.pos.z -= uz * push * 0.5;
        if (Math.abs(car.speed) > 5) {
          car.damage += 4;
          this.audio.crash(false);
          car.speed *= 0.7;
        }
        other.speed = 0;
      }
    }
    if (car.damage >= 100) {
      car.speed = 0;
      car.damage = 100;
    }
    car.mesh.rotation.y = car.heading;
    car.mesh.position.y = 0;
    this.audio.setEngine(Math.abs(car.speed) / 30, true);
  }

  _updateTrafficCar(dt, car) {
    car.turnCooldown -= dt;
    // At an intersection, sometimes turn onto the crossing road.
    const onXRoad = ROADS.some((r) => Math.abs(car.pos.z - r) < 1.2);
    const onZRoad = ROADS.some((r) => Math.abs(car.pos.x - r) < 1.2);
    if (car.turnCooldown <= 0 && onXRoad && onZRoad && this.rng.chance(0.4)) {
      const newAxis = car.axis === 'x' ? 'z' : 'x';
      const newDir = this.rng.pick([-1, 1]);
      car.axis = newAxis;
      car.dir = newDir;
      car.heading = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
      car.turnCooldown = this.rng.range(2, 6);
    }
    car.speed += (car.topSpeed - car.speed) * 0.5 * dt;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    // U-turn at the city edge.
    if (car.pos.x > 178 || car.pos.x < -178 || car.pos.z > 178 || car.pos.z < -178) {
      car.heading += Math.PI;
      car.axis = car.axis === 'x' ? 'x' : 'z';
      car.dir = -car.dir;
      car.pos.x = Math.max(-176, Math.min(176, car.pos.x));
      car.pos.z = Math.max(-176, Math.min(176, car.pos.z));
    }
    this.city.resolveCircle(car.pos, 2.2);
    car.mesh.rotation.y = car.heading;
  }

  _updateCruiser(dt, car, target, hero) {
    if (!target) { car.speed = 0; return; }
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    car.speed += (Math.min(30, 14 + dist * 0.12) - car.speed) * 0.8 * dt;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    this.city.resolveCircle(car.pos, 2.2);
    car.pos.x = Math.max(-196, Math.min(196, car.pos.x));
    car.pos.z = Math.max(-196, Math.min(232, car.pos.z));
    car.mesh.rotation.y = car.heading;
    // Ram the player's car.
    if (this.playerCar && dist < 4.5) {
      const pc = this.playerCar;
      pc.damage += 6 * dt * 4;
      pc.speed *= 0.985;
      const push = 0.12;
      pc.pos.x += (pc.pos.x - car.pos.x) / dist * push;
      pc.pos.z += (pc.pos.z - car.pos.z) / dist * push;
      if (this.rng.chance(dt * 2)) this.audio.crash(false);
    }
  }
}
