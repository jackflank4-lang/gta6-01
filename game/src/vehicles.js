// Cars: meshes, traffic AI, police pursuit. Traffic cars drive the road
// grid, stop at red lights, and never leave the roads. Parked cars line
// the kerbs and can be stolen. Police cruisers spawn on the wanted level
// and ram the player's car; foot cops chase the player on foot.
import { Rng } from './rng.js';

const THREE = window.THREE;

const CAR_COLORS = [0xc23b2e, 0x2e6ac2, 0xd8c23a, 0x3a9e5a, 0x8a5ac2, 0xd8d8d8, 0x222222, 0xe07a2a];
const CAR_TYPES = ['sedan', 'coupe', 'van', 'sports'];

export function makeCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const long = kind === 'van' ? 5.2 : kind === 'sports' ? 4.0 : 4.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, long), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, kind === 'van' ? 3.4 : 2.0),
    glassMat,
  );
  cabin.position.set(0, 1.15, kind === 'van' ? 0.2 : -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
  }
  // Headlights and tail lights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(wx, 0.6, long / 2 + 0.02);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const wx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(wx, 0.6, -long / 2 - 0.02);
    group.add(t);
  }
  group.userData.kind = kind;
  return group;
}

function makePoliceMesh() {
  const group = makeCarMesh(0x111144, 'sedan');
  const barMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), barMat);
  bar.position.set(0, 1.6, -0.2);
  bar.name = 'lightbar';
  group.add(bar);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  bar2.position.set(0.35, 1.6, -0.2);
  bar2.name = 'lightbar2';
  group.add(bar2);
  return group;
}

// Global light cycle: 8 s north-south green, 8 s east-west green.
export function lightState(time) {
  return (Math.floor(time / 8) % 2) === 0 ? 'ns' : 'ew';
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(1234);
    this.parked = [];
    this.moving = [];
    this.spawnParked();
    this.spawnMoving(14);
  }

  spawnParked() {
    const spots = [];
    for (let k = 0; k <= 8; k += 1) {
      const line = this.city.roadLines[k];
      for (const along of [-150, -100, -60, -20, 30, 80, 130]) {
        if (this.rng.chance(0.5)) spots.push({ x: line + 5.5, z: along, axis: 'z', heading: 0 });
        if (this.rng.chance(0.5)) spots.push({ x: along, z: line + 5.5, axis: 'x', heading: Math.PI / 2 });
      }
    }
    this.rng.shuffle(spots);
    for (const s of spots.slice(0, 12)) {
      const kind = this.rng.pick(CAR_TYPES);
      const mesh = makeCarMesh(this.rng.pick(CAR_COLORS), kind);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.heading;
      this.scene.add(mesh);
      this.parked.push({ mesh, kind, taken: false, color: mesh.children[0].material.color.getHex() });
    }
  }

  spawnMoving(n) {
    for (let i = 0; i < n; i += 1) {
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const line = this.rng.pick(this.city.roadLines);
      const along = this.rng.range(-170, 170);
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const kind = this.rng.pick(CAR_TYPES);
      const mesh = makeCarMesh(this.rng.pick(CAR_COLORS), kind);
      mesh.position.set(axis === 'x' ? along : line, 0, axis === 'x' ? line : along);
      this.scene.add(mesh);
      this.moving.push({
        mesh, kind, axis, line, dir,
        speed: this.rng.range(7, 11),
        maxSpeed: this.rng.range(8, 12),
        heading: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      });
    }
  }

  nearestParked(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.parked) {
      if (p.taken) continue;
      const dx = p.mesh.position.x - pos.x;
      const dz = p.mesh.position.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  update(dt, time) {
    const state = lightState(time);
    for (const c of this.moving) {
      // Next intersection along the road.
      const pos = c.mesh.position;
      const along = c.axis === 'x' ? pos.x : pos.z;
      const nextLine = c.dir > 0
        ? this.city.roadLines.find((l) => l > along + 2)
        : [...this.city.roadLines].reverse().find((l) => l < along - 2);
      let want = c.maxSpeed;
      if (nextLine !== undefined) {
        const dist = Math.abs(nextLine - along);
        const myAxisGreen = (c.axis === 'z' && state === 'ns') || (c.axis === 'x' && state === 'ew');
        if (dist < 14 && !myAxisGreen) want = 0;
        else if (dist < 26 && !myAxisGreen) want = Math.min(want, 3);
      }
      c.speed += Math.max(-14 * dt, Math.min(8 * dt, want - c.speed));
      const step = c.speed * c.dir * dt;
      if (c.axis === 'x') pos.x += step;
      else pos.z += step;
      // Turn at an intersection sometimes, or wrap at the city edge.
      const atEdge = Math.abs(along) > 172;
      const atJunction = nextLine !== undefined && Math.abs(nextLine - along) < 1.2;
      if (atEdge || (atJunction && this.rng.chance(0.25))) {
        if (atEdge) {
          c.dir *= -1;
          c.heading += Math.PI;
        } else {
          const oldAxis = c.axis;
          c.axis = oldAxis === 'x' ? 'z' : 'x';
          c.line = nextLine;
          c.dir = this.rng.chance(0.5) ? 1 : -1;
          if (c.axis === 'x') {
            pos.z = c.line;
            c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            pos.x = c.line;
            c.heading = c.dir > 0 ? 0 : Math.PI;
          }
        }
      }
      c.mesh.rotation.y = c.heading;
    }
  }
}

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(7777);
    this.cruisers = [];
    this.footCops = [];
    this.wanted = 0;
    this.flashT = 0;
  }

  setWanted(n) {
    this.wanted = n;
    const wantCruisers = n === 0 ? 0 : Math.min(n + 1, 4);
    while (this.cruisers.length < wantCruisers) this.spawnCruiser();
    while (this.cruisers.length > wantCruisers) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
    const wantCops = n >= 2 ? Math.min(n - 1, 2) : 0;
    while (this.footCops.length < wantCops) this.spawnFootCop();
    while (this.footCops.length > wantCops) {
      const c = this.footCops.pop();
      this.scene.remove(c.mesh);
    }
  }

  spawnCruiser() {
    const mesh = makePoliceMesh();
    this.scene.add(mesh);
    this.cruisers.push({ mesh, speed: 0, heading: 0, stuck: 0 });
  }

  spawnFootCop() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x1a2a5a }),
    );
    body.position.y = 0.95;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8a878 }),
    );
    head.position.y = 1.75;
    group.add(head);
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 0.18, 8),
      new THREE.MeshLambertMaterial({ color: 0x0a1a3a }),
    );
    hat.position.y = 1.95;
    group.add(hat);
    this.scene.add(group);
    this.footCops.push({ mesh: group, touchTime: 0 });
  }

  // Cruisers steer toward the player and ram; foot cops run the player down.
  update(dt, playerPos, playerInCar, onRam, onBustedTouch) {
    this.flashT += dt;
    for (const c of this.cruisers) {
      const m = c.mesh;
      const dx = playerPos.x - m.position.x;
      const dz = playerPos.z - m.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist > 90) {
        // Teleport a far cruiser back onto a road near the player.
        const line = this.city.roadLines[this.rng.int(0, 8)];
        m.position.set(playerPos.x + this.rng.range(-50, 50), 0, playerPos.z + this.rng.range(-50, 50));
        if (this.rng.chance(0.5)) { m.position.x = line; } else { m.position.z = line; }
        c.speed = 10;
      }
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const turn = Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      c.heading += turn;
      c.speed = Math.min(c.speed + 12 * dt, dist > 25 ? 26 : 20);
      m.position.x += Math.sin(c.heading) * c.speed * dt;
      m.position.z += Math.cos(c.heading) * c.speed * dt;
      m.rotation.y = c.heading;
      // Light bar flashes.
      const bar = m.getObjectByName('lightbar');
      const bar2 = m.getObjectByName('lightbar2');
      const on = Math.floor(this.flashT * 4) % 2 === 0;
      if (bar) bar.material.color.setHex(on ? 0xff2222 : 0x881111);
      if (bar2) bar2.material.color.setHex(on ? 0x111188 : 0x2244ff);
      if (dist < 3.4) onRam(c, dist);
    }
    for (const cop of this.footCops) {
      const m = cop.mesh;
      const dx = playerPos.x - m.position.x;
      const dz = playerPos.z - m.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const speed = 5.2;
      m.position.x += (dx / dist) * speed * dt;
      m.position.z += (dz / dist) * speed * dt;
      m.rotation.y = Math.atan2(dx, dz);
      m.position.y = Math.abs(Math.sin(this.flashT * 9)) * 0.12;
      if (dist < 1.7 && !playerInCar) {
        cop.touchTime += dt;
        if (cop.touchTime > 1.5) onBustedTouch();
      } else {
        cop.touchTime = Math.max(0, cop.touchTime - dt);
      }
    }
  }
}
