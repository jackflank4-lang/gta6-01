// Vehicles for Solmar Bay — Neon Heat.
// Traffic AI (lane following, intersection turns, red-light stops),
// parked cars to steal, and police cruisers that chase the player.
const THREE = window.THREE;

const CAR_COLORS = [0xd83a3a, 0x3a7bd8, 0x3ad8a0, 0xe8d83a, 0xd8d8e0, 0x8a3ad8, 0xd88a3a, 0x2a2a30, 0x5ad8e0];

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e1a2a, roughness: 0.1, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 2.4), bodyMat);
    bed.position.set(0, 0.95, 1.1);
    g.add(bed);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), headMat);
    h.position.set(x, 0.62, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), tailMat);
    t.position.set(x, 0.62, -2.22);
    g.add(t);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23a })
    );
    sign.position.set(0, 1.5, -0.25);
    g.add(sign);
  }
  if (kind === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    bar.position.set(-0.2, 1.45, -0.25);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    bar2.position.set(0.55, 1.45, -0.25);
    g.add(bar2);
  }
  return { group: g, wheels };
}

export class TrafficSystem {
  constructor(scene, city, rng, callbacks) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cb = callbacks || {};
    this.cars = [];
    this.cruisers = [];
    this.lightTimer = 0;
    this.lightRed = false;
    this.playerCar = null;
  }

  addCar(kind, x, z, heading, parked, color) {
    const carColor = color !== undefined ? color : kind === 'cruiser' ? 0xe8e8f0 : kind === 'taxi' ? 0xffd23a : this.rng.pick(CAR_COLORS);
    const { group, wheels } = makeCarMesh(carColor, kind);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    this.scene.add(group);
    const car = {
      mesh: group,
      wheels,
      pos: group.position,
      heading,
      speed: 0,
      targetSpeed: parked ? 0 : this.rng.range(7, 11),
      kind,
      color: carColor,
      parked: !!parked,
      damage: 0,
      police: kind === 'cruiser',
      routeAxis: Math.abs(Math.sin(heading)) < 0.5 ? 'z' : 'x',
      routeLine: Math.abs(Math.sin(heading)) < 0.5 ? x : z,
      routeDir: 1,
      stopped: false,
    };
    if (car.routeAxis === 'z') car.routeDir = Math.cos(heading) >= 0 ? 1 : -1;
    else car.routeDir = Math.sin(heading) >= 0 ? 1 : -1;
    this.cars.push(car);
    return car;
  }

  spawnInitial() {
    for (let i = 0; i < 14; i++) {
      const p = this.city.randomRoadPoint(this.rng);
      this.addCar(this.rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sports']), p.x, p.z, p.heading, false);
    }
    for (let i = 0; i < 6; i++) {
      const p = this.city.randomRoadPoint(this.rng);
      // Parked cars sit at the road edge, facing along the road.
      this.addCar('sedan', p.x + (this.rng.chance(0.5) ? 5 : -5), p.z, p.heading, true);
    }
  }

  nearestCar(pos, maxDist, excludePolice) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (excludePolice && c.police) continue;
      if (c === this.playerCar) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  giveCar(type, x, z, heading, color) {
    const car = this.addCar(type || 'sedan', x, z, heading || 0, true, color);
    return car;
  }

  enterCar(car) {
    car.parked = false;
    car.speed = 0;
    this.playerCar = car;
    return car;
  }

  exitCar() {
    const car = this.playerCar;
    this.playerCar = null;
    if (car) {
      car.parked = true;
      car.speed = 0;
    }
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    if (this.playerCar === car) this.playerCar = null;
    const j = this.cruisers.indexOf(car);
    if (j >= 0) this.cruisers.splice(j, 1);
  }

  spawnCruiser(nearPos) {
    if (this.cruisers.length >= 4) return null;
    const p = this.city.randomRoadPoint(this.rng);
    const car = this.addCar('cruiser', nearPos ? nearPos.x + this.rng.range(-30, 30) : p.x, nearPos ? nearPos.z + this.rng.range(-30, 30) : p.z, p.heading, false);
    car.targetSpeed = 26;
    this.cruisers.push(car);
    return car;
  }

  despawnCruisers() {
    [...this.cruisers].forEach((c) => this.removeCar(c));
  }

  // Player-driven car physics. Returns speed in m/s.
  updatePlayer(dt, input, camYaw) {
    const car = this.playerCar;
    if (!car) return 0;
    const fwd = input.isDown('KeyW') || input.isDown('ArrowUp');
    const rev = input.isDown('KeyS') || input.isDown('ArrowDown');
    const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
    const right = input.isDown('KeyD') || input.isDown('ArrowRight');
    const accel = fwd ? 13 : rev ? -9 : 0;
    car.speed += accel * dt;
    if (!fwd && !rev) car.speed *= Math.max(0, 1 - 0.5 * dt); // gentle rolling drag
    car.speed = Math.max(-8, Math.min(30, car.speed));
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    const steerRate = 1.9 * Math.min(1, Math.abs(car.speed) / 8);
    if (Math.abs(car.speed) > 0.2) {
      car.heading += steer * steerRate * dt * Math.sign(car.speed);
    }
    const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = this.city.collideCircle(nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) {
      if (Math.abs(car.speed) > 6 && this.cb.onCrash) this.cb.onCrash(car);
      car.speed *= 0.35;
    }
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
    car.mesh.rotation.y = car.heading;
    car.wheels.forEach((w) => { w.rotation.x += (car.speed * dt) / 0.36; });
    return car.speed;
  }

  update(dt, heroPos) {
    this.lightTimer += dt;
    if (this.lightTimer > 9) {
      this.lightTimer = 0;
      this.lightRed = !this.lightRed;
    }
    for (const car of this.cars) {
      if (car === this.playerCar || car.police) continue;
      if (car.parked) continue;
      // Car ahead? Slow down.
      let ahead = false;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 9) {
          const fx = Math.sin(car.heading);
          const fz = Math.cos(car.heading);
          if (dx * fx + dz * fz > 0) { ahead = true; break; }
        }
      }
      // Red light near an intersection?
      let atLight = false;
      if (this.lightRed) {
        const nearX = Math.abs(((car.pos.x + 176) % 44) - 22) < 4 || Math.abs(((car.pos.x + 176) % 44) + 22) < 4;
        const nearZ = Math.abs(((car.pos.z + 176) % 44) - 22) < 4 || Math.abs(((car.pos.z + 176) % 44) + 22) < 4;
        atLight = nearX || nearZ;
      }
      const want = ahead || atLight ? 0 : car.targetSpeed;
      car.speed += (want - car.speed) * Math.min(1, 1.2 * dt);
      const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      // Turn around at the city edge; random turn at intersections.
      if (nx > 172 || nx < -172 || nz > 172 || nz < -172) {
        car.heading += Math.PI;
        car.pos.x = Math.max(-170, Math.min(170, nx));
        car.pos.z = Math.max(-170, Math.min(170, nz));
      } else {
        car.pos.x = nx;
        car.pos.z = nz;
      }
      const onCrossing = Math.abs(((car.pos.x + 176) % 44) - 22) < 2 && Math.abs(((car.pos.z + 176) % 44) - 22) < 2;
      if (onCrossing && this.rng.chance(dt * 0.25)) {
        car.heading += this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      }
      car.mesh.rotation.y = car.heading;
      car.wheels.forEach((w) => { w.rotation.x += (car.speed * dt) / 0.36; });
    }
    this.updateCruisers(dt, heroPos);
  }

  updateCruisers(dt, heroPos) {
    if (!heroPos) return;
    for (const c of this.cruisers) {
      const dx = heroPos.x - c.pos.x;
      const dz = heroPos.z - c.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const targetSpeed = dist > 40 ? 28 : dist > 12 ? 22 : 14;
      c.speed += (targetSpeed - c.speed) * Math.min(1, 1.5 * dt);
      const nx = c.pos.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.pos.z + Math.cos(c.heading) * c.speed * dt;
      const fixed = this.city.collideCircle(nx, nz, 1.6);
      if (fixed.x !== nx || fixed.z !== nz) c.speed *= 0.4;
      c.pos.x = fixed.x;
      c.pos.z = fixed.z;
      c.mesh.rotation.y = c.heading;
      c.wheels.forEach((w) => { w.rotation.x += (c.speed * dt) / 0.36; });
      // Ram: shove the player's car / hero and add damage. Gated by a
      // per-cruiser cooldown, or the ram would fire every substep.
      if (dist < 3.4 && this.cb.onRam) {
        c.ramCd = (c.ramCd || 0) - dt;
        if (c.ramCd <= 0) {
          c.ramCd = 1.0;
          this.cb.onRam(c, dist);
        }
      }
    }
  }
}
