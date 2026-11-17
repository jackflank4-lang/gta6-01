// The people of Solmar Bay: pedestrians strolling the sidewalks, the hero on
// foot, and the Barracuda thugs (plus their boss) who fight back. Everyone is
// a few boxes and a sphere — readable at a glance, cheap to draw, and easy to
// animate with a walk swing.

import { Rng } from './rng.js';

const SHIRTS = [0xe8e8e8, 0xd94a4a, 0x4a90d9, 0xe8c33a, 0x7a4a9e, 0x3ba86b, 0xff8a3b, 0x37b8a0];
const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];

export function makeWalkerMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), pantsMat);
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.16;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.78;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), shirtMat);
  armL.position.set(-0.4, 1.16, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  for (const part of [legL, legR, torso, head, armL, armR]) {
    part.castShadow = true;
    group.add(part);
  }
  group.userData = { legL, legR, armL, armR, torso, head };
  return group;
}

// Pedestrians: they pick a sidewalk corner, stroll to the next, and scatter
// when a car screams past or a gun goes off nearby.
export class Crowd {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(31337);
    this.walkers = [];
    const lines = [-169, -132, -88, -44, 0, 44, 88, 132, 169];
    for (let i = 0; i < 22; i += 1) {
      const mesh = makeWalkerMesh(
        this.rng.pick(SHIRTS),
        this.rng.pick([0x2c2c34, 0x4a4a55, 0x7a6a4a]),
        this.rng.pick(SKINS),
      );
      const x = this.rng.pick(lines) + this.rng.range(-5, 5);
      const z = this.rng.range(-160, 160);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.walkers.push({
        mesh,
        target: this.pickCorner(),
        speed: this.rng.range(1.1, 2.0),
        phase: this.rng.range(0, Math.PI * 2),
        flee: null,
      });
    }
  }

  pickCorner() {
    const lines = [-169, -132, -88, -44, 0, 44, 88, 132, 169];
    return {
      x: this.rng.pick(lines) + this.rng.range(-5, 5),
      z: this.rng.range(-160, 160),
    };
  }

  scare(pos, radius) {
    for (const walker of this.walkers) {
      const d = Math.hypot(walker.mesh.position.x - pos.x, walker.mesh.position.z - pos.z);
      if (d < radius) {
        walker.flee = { x: walker.mesh.position.x - pos.x, z: walker.mesh.position.z - pos.z };
      }
    }
  }

  // The nearest pedestrian to a point (for punch/shoot hit tests).
  nearest(pos, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const walker of this.walkers) {
      const d = Math.hypot(walker.mesh.position.x - pos.x, walker.mesh.position.z - pos.z);
      if (d < bestDist) { bestDist = d; best = walker; }
    }
    return best;
  }

  update(dt, time) {
    for (const walker of this.walkers) {
      let tx;
      let tz;
      let speed = walker.speed;
      if (walker.flee) {
        const len = Math.hypot(walker.flee.x, walker.flee.z) || 1;
        tx = walker.mesh.position.x + (walker.flee.x / len) * 20;
        tz = walker.mesh.position.z + (walker.flee.z / len) * 20;
        speed = 4.6;
        if (Math.hypot(tx - walker.mesh.position.x, tz - walker.mesh.position.z) < 1) walker.flee = null;
      } else {
        tx = walker.target.x;
        tz = walker.target.z;
      }
      const dx = tx - walker.mesh.position.x;
      const dz = tz - walker.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1) {
        if (!walker.flee) walker.target = this.pickCorner();
        continue;
      }
      const step = Math.min(speed * dt, dist);
      walker.mesh.position.x += (dx / dist) * step;
      walker.mesh.position.z += (dz / dist) * step;
      walker.mesh.rotation.y = Math.atan2(dx, dz);
      walker.mesh.position.x = Math.max(-172, Math.min(172, walker.mesh.position.x));
      walker.mesh.position.z = Math.max(-172, Math.min(174, walker.mesh.position.z));
      const swing = Math.sin(time * 7 * (speed / 1.6) + walker.phase) * 0.5;
      walker.mesh.userData.legL.rotation.x = swing;
      walker.mesh.userData.legR.rotation.x = -swing;
      walker.mesh.userData.armL.rotation.x = -swing * 0.7;
      walker.mesh.userData.armR.rotation.x = swing * 0.7;
    }
  }
}

// The hero on foot: WASD movement relative to the camera, sprint, jump with
// real gravity, and a punch. The engine owns the hero's position; this class
// only animates the mesh and applies the movement math.
export class Hero {
  constructor(scene) {
    this.scene = scene;
    this.mesh = makeWalkerMesh(0x37b8a0, 0x2c2c34, 0xe8b98a);
    this.mesh.scale.setScalar(1.05);
    // A teal jacket and a cap so the hero reads against the crowd.
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x20242e }),
    );
    cap.position.y = 1.98;
    this.mesh.add(cap);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(-150, 0, 140);
    this.velY = 0;
    this.onGround = true;
    this.heading = 0;
    this.punchTimer = 0;
    this.walkPhase = 0;
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  update(dt, input, camYaw, city) {
    const move = input.moveVector();
    const sprint = input.sprint();
    const speed = sprint ? 9.5 : 5.2;
    // Movement is camera-relative: W walks away from the camera.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const mx = (-sin * move.forward) + (cos * move.strafe);
    const mz = (-cos * move.forward) + (-sin * move.strafe);
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      this.pos.x += (mx / len) * speed * dt;
      this.pos.z += (mz / len) * speed * dt;
      const targetHeading = Math.atan2(mx, mz);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 12);
      this.walkPhase += dt * speed * 1.6;
    }
    // Jump: real gravity, land on the ground plane.
    if (input.hit('Space') && this.onGround) {
      this.velY = 7.5;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.velY -= 22 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.velY = 0;
        this.onGround = true;
      }
    }
    // Buildings are solid: push the hero out of their boxes.
    for (const box of city.colliders) {
      if (Math.abs(this.pos.x - box.x) > box.hx + 0.7) continue;
      if (Math.abs(this.pos.z - box.z) > box.hz + 0.7) continue;
      const dx = this.pos.x - box.x;
      const dz = this.pos.z - box.z;
      const px = box.hx + 0.7 - Math.abs(dx);
      const pz = box.hz + 0.7 - Math.abs(dz);
      if (px < pz) this.pos.x += Math.sign(dx || 1) * px;
      else this.pos.z += Math.sign(dz || 1) * pz;
    }
    this.pos.x = Math.max(-172, Math.min(172, this.pos.x));
    this.pos.z = Math.max(-172, Math.min(174, this.pos.z));

    if (this.punchTimer > 0) this.punchTimer -= dt;
    const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
    if (this.punchTimer > 0.12) {
      u.armR.rotation.x = -1.6;
      u.armL.rotation.x = 0.4;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  punch() {
    if (this.punchTimer > 0) return false;
    this.punchTimer = 0.28;
    return true;
  }
}

// Thugs: mission enemies. They stand at a spot until the player comes close,
// then close in and punch. The boss is bigger, tougher, and hits harder.
export class Thugs {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(x, z, count, boss) {
    const rng = new Rng(555 + this.list.length * 17 + Math.floor(x));
    for (let i = 0; i < count; i += 1) {
      const isBoss = boss && i === 0;
      const mesh = makeWalkerMesh(
        isBoss ? 0x1c1c22 : 0x8a2a2a,
        0x2c2c34,
        this.rngSkin(rng),
      );
      if (isBoss) mesh.scale.setScalar(1.35);
      mesh.position.set(x + rng.range(-8, 8), 0, z + rng.range(-8, 8));
      this.scene.add(mesh);
      this.list.push({
        mesh, hp: isBoss ? 300 : 100, boss: isBoss,
        speed: isBoss ? 3.4 : 2.6, damage: isBoss ? 22 : 12,
        punchTimer: 0, hitTimer: 0, dead: false, fade: 0,
      });
    }
  }

  rngSkin(rng) {
    return rng.pick(SKINS);
  }

  aliveCount() {
    return this.list.filter((t) => !t.dead).length;
  }

  bossAlive() {
    return this.list.some((t) => t.boss && !t.dead);
  }

  clear() {
    for (const thug of this.list) this.scene.remove(thug.mesh);
    this.list = [];
  }

  // Returns the damage dealt to the player this frame (0 when none).
  update(dt, time, playerPos, onKill) {
    let dealt = 0;
    for (const thug of this.list) {
      if (thug.dead) {
        thug.fade += dt;
        thug.mesh.position.y = -thug.fade * 1.2;
        thug.mesh.rotation.x = -Math.PI / 2 * Math.min(1, thug.fade * 2);
        if (thug.fade > 2.5) this.scene.remove(thug.mesh);
        continue;
      }
      if (thug.hitTimer > 0) thug.hitTimer -= dt;
      if (thug.punchTimer > 0) thug.punchTimer -= dt;
      const dx = playerPos.x - thug.mesh.position.x;
      const dz = playerPos.z - thug.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 26) {
        if (dist > 1.6) {
          thug.mesh.position.x += (dx / dist) * thug.speed * dt;
          thug.mesh.position.z += (dz / dist) * thug.speed * dt;
        } else if (thug.punchTimer <= 0) {
          thug.punchTimer = 0.9;
          dealt += thug.damage;
          thug.mesh.userData.armR.rotation.x = -1.6;
        }
        thug.mesh.rotation.y = Math.atan2(dx, dz);
        const swing = Math.sin(time * 8) * 0.4;
        thug.mesh.userData.legL.rotation.x = swing;
        thug.mesh.userData.legR.rotation.x = -swing;
      }
    }
    this.list = this.list.filter((t) => !t.dead || t.fade < 2.5);
    return dealt;
  }

  // A punch or a shot landing on a thug. Returns the thug hit, or null.
  hitAt(pos, range, damage, onKill) {
    let best = null;
    let bestDist = range;
    for (const thug of this.list) {
      if (thug.dead) continue;
      const d = Math.hypot(thug.mesh.position.x - pos.x, thug.mesh.position.z - pos.z);
      if (d < bestDist) { bestDist = d; best = thug; }
    }
    if (!best) return null;
    best.hp -= damage;
    best.hitTimer = 0.25;
    best.mesh.userData.torso.material.emissive = new THREE.Color(0x881111);
    setTimeout(() => {
      if (best.mesh.userData.torso) best.mesh.userData.torso.material.emissive = new THREE.Color(0x000000);
    }, 120);
    if (best.hp <= 0) {
      best.dead = true;
      best.fade = 0;
      if (onKill) onKill(best);
    }
    return best;
  }
}
