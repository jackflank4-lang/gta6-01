// Vehicles for Solmar Bay: traffic AI, police pursuit, parked cars and the
// car factory. Cars are simple box-built meshes (body, cabin, wheels,
// lights) so they stay cheap under the software renderer.
// Heading convention: forward = (sin(h), cos(h)) in (x, z); mesh.rotation.y = h.
import { Rng } from './rng.js';
import { ROAD_LINES } from './city.js';

const THREE = window.THREE;

const CAR_COLORS = [0xb03030, 0x3060b0, 0xd8c23a, 0x3a8a4a, 0xd8d8d8, 0x303030, 0x7a4a9a, 0xc07030];

export function makeCar(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xe8e8e8 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a2a4a : 0x222831 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  group.add(cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x1a2a6a }),
    );
    stripe.position.y = 0.75;
    group.add(stripe);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0x333300, emissive: 0xfff2b0, emissiveIntensity: 1.2 });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
    h.position.set(hx, 0.7, 2.22);
    group.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 0.8 });
  for (const hx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    t.position.set(hx, 0.7, -2.22);
    group.add(t);
  }
  let lightBar = null;
  let lightBarL = null;
  let lightBarR = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    lightBarL = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x220000, emissive: 0xff2222, emissiveIntensity: 2 }),
    );
    lightBarL.position.x = -0.45;
    lightBarR = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x000022, emissive: 0x2244ff, emissiveIntensity: 2 }),
    );
    lightBarR.position.x = 0.45;
    lightBar.add(lightBarL, lightBarR);
    lightBar.position.y = 1.75;
    group.add(lightBar);
  }
  return {
    mesh: group,
    x: 0, z: 0, heading: 0, speed: 0, damage: 0,
    isPolice: !!isPolice,
    lightBarL, lightBarR,
    sync() {
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
    },
  };
}

export class Vehicles {
  constructor(city) {
    this.city = city;
    this.rng = new Rng(1234);
    this.group = new THREE.Group();
    this.traffic = [];
    this.parked = [];
    this.cruisers = [];
    this._buildTraffic();
    this._buildParked();
  }

  _randomRoadPos() {
    const line = this.rng.pick(ROAD_LINES);
    const along = this.rng.range(-170, 170);
    return { line, along };
  }

  _buildTraffic() {
    for (let i = 0; i < 14; i += 1) {
      const car = makeCar(this.rng.pick(CAR_COLORS), false);
      const vertical = this.rng.chance(0.5);
      const p = this._randomRoadPos();
      car.x = vertical ? p.line : p.along;
      car.z = vertical ? p.along : p.line;
      car.heading = vertical ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      car.vertical = vertical;
      car.line = p.line;
      car.dir = vertical ? (car.heading === 0 ? 1 : -1) : (car.heading === Math.PI / 2 ? 1 : -1);
      car.targetSpeed = this.rng.range(8, 12);
      car.speed = car.targetSpeed;
      car.sync();
      this.group.add(car.mesh);
      this.traffic.push(car);
    }
  }

  _buildParked() {
    const spots = [
      { line: 0, along: -60, side: 1 }, { line: 0, along: 30, side: -1 },
      { line: 44, along: -110, side: 1 }, { line: -44, along: 80, side: -1 },
      { line: 88, along: -20, side: 1 }, { line: -88, along: 120, side: -1 },
      { line: 132, along: 10, side: 1 }, { line: -132, along: -70, side: -1 },
    ];
    for (const s of spots) {
      const car = makeCar(this.rng.pick(CAR_COLORS), false);
      const vertical = this.rng.chance(0.5);
      car.x = vertical ? s.line + s.side * 4.5 : s.along;
      car.z = vertical ? s.along : s.line + s.side * 4.5;
      car.heading = vertical ? 0 : Math.PI / 2;
      car.stolen = false;
      car.sync();
      this.group.add(car.mesh);
      this.parked.push(car);
    }
  }

  // Nearest car (traffic, parked or cruiser) within range of (x, z).
  nearestCar(x, z, range, includeTraffic) {
    let best = null;
    let bestD = range;
    const lists = [this.parked, this.cruisers];
    if (includeTraffic) lists.push(this.traffic);
    for (const list of lists) {
      for (const c of list) {
        const dx = c.x - x;
        const dz = c.z - z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    return best;
  }

  spawnCruiser(x, z) {
    const car = makeCar(0, true);
    car.x = x;
    car.z = z;
    car.heading = 0;
    car.speed = 0;
    car.ramCooldown = 0;
    car.sync();
    this.group.add(car.mesh);
    this.cruisers.push(car);
    return car;
  }

  removeCruiser(car) {
    const i = this.cruisers.indexOf(car);
    if (i >= 0) this.cruisers.splice(i, 1);
    this.group.remove(car.mesh);
  }

  // Traffic: follow the road grid, stop at red lights, keep distance.
  updateTraffic(dt, lightsOn) {
    for (const car of this.traffic) {
      // Car ahead on the same road?
      let ahead = null;
      let aheadD = 999;
      for (const other of this.traffic) {
        if (other === car || other.vertical !== car.vertical || other.line !== car.line) continue;
        const along = car.vertical ? (other.z - car.z) * car.dir : (other.x - car.x) * car.dir;
        if (along > 0 && along < aheadD) { aheadD = along; ahead = other; }
      }
      let want = car.targetSpeed;
      if (ahead && aheadD < 9) want = Math.min(want, ahead.speed * 0.9);
      // Red light: stop before the intersection.
      if (lightsOn) {
        for (const tl of this.city.trafficLights) {
          const cross = car.vertical ? tl.z : tl.x;
          const along = car.vertical ? (tl.z - car.z) * car.dir : (tl.x - car.x) * car.dir;
          const lateral = car.vertical ? Math.abs(car.x - tl.x) : Math.abs(car.z - tl.z);
          if (lateral > 2 || along < 0 || along > 14) continue;
          const green = car.vertical ? tl.nsGreen : !tl.nsGreen;
          if (!green) want = 0;
        }
      }
      car.speed += Math.max(-8 * dt, Math.min(4 * dt, want - car.speed));
      const step = car.speed * dt;
      if (car.vertical) car.z += step * car.dir;
      else car.x += step * car.dir;
      // At an intersection, sometimes turn onto the crossing road.
      const nearLine = ROAD_LINES.find((l) => Math.abs((car.vertical ? car.z : car.x) - l) < 1.2);
      if (nearLine !== undefined && car.speed > 2 && this.rng.chance(0.02)) {
        const crossLine = car.vertical ? car.x : car.z;
        const newLine = nearLine;
        const newVertical = !car.vertical;
        const newDir = this.rng.chance(0.5) ? 1 : -1;
        car.vertical = newVertical;
        car.line = newLine;
        car.dir = newDir;
        if (newVertical) { car.x = newLine; car.heading = newDir > 0 ? 0 : Math.PI; }
        else { car.z = newLine; car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        void crossLine;
      }
      // Wrap around the city edge.
      if (car.vertical && (car.z > 180 || car.z < -180)) { car.z = car.z > 0 ? -178 : 178; }
      if (!car.vertical && (car.x > 180 || car.x < -180)) { car.x = car.x > 0 ? -178 : 178; }
      // Smooth heading towards the road direction.
      const targetH = car.vertical ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      let dh = targetH - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.5 * dt, Math.min(2.5 * dt, dh));
      car.sync();
    }
  }

  // Police pursuit. hero: {x, z, inCar}. onRam(cruiser) fires when a ram
  // lands (engine applies the damage). Cruisers never ram a hero on foot:
  // they stop 5 m out and the foot cops do the work.
  updateCruisers(dt, hero, onRam, time) {
    for (const car of this.cruisers) {
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
      const dx = hero.x - car.x;
      const dz = hero.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
      const wantH = Math.atan2(dx, dz);
      let dh = wantH - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const stopDist = hero.inCar ? 2.5 : 5;
      if (dist > stopDist) {
        car.speed = Math.min(24, car.speed + 10 * dt);
      } else {
        car.speed = Math.max(0, car.speed - 20 * dt);
      }
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // Ram the hero's car on contact (1.2 s cooldown per cruiser).
      if (hero.inCar && dist < 4.5 && car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        if (onRam) onRam(car);
      }
      // Flash the light bar.
      const phase = Math.floor(time * 4) % 2 === 0;
      if (car.lightBarL) car.lightBarL.material.emissiveIntensity = phase ? 2.5 : 0.2;
      if (car.lightBarR) car.lightBarR.material.emissiveIntensity = phase ? 0.2 : 2.5;
      car.sync();
    }
  }
}
