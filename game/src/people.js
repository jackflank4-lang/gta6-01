// People: pedestrians who wander the sidewalks and flee trouble, thugs who
// fight back, and the boss Vic Marino. Blocky low-poly figures with a simple
// walk swing; combat is a short-range punch arc with knockback.

import { Rng } from './rng.js';

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0, 0x6e4426];
const SHIRTS = [0xd23b3b, 0x3b7dd2, 0x37c978, 0xe8c93b, 0x8a5fd2, 0xff6b9d, 0x37e0ff, 0xdddddd];

export function makePersonMesh(shirt, skin, scale = 1) {
  const group = new THREE.Group();
  const mat = (color) => new THREE.MeshLambertMaterial({ color });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), mat(shirt));
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat(skin));
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), mat(0x1c1410));
  hair.position.y = 1.9;
  group.add(hair);
  const legGeo = new THREE.BoxGeometry(0.24, 0.72, 0.26);
  const legMat = mat(0x22262e);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16, 0.36, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.16, 0.36, 0);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.2);
  const armL = new THREE.Mesh(armGeo, mat(shirt));
  armL.position.set(-0.42, 1.1, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, mat(shirt));
  armR.position.set(0.42, 1.1, 0);
  group.add(armR);
  group.scale.setScalar(scale);
  group.userData = { legL, legR, armL, armR };
  return group;
}

class Walker {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.speed = 0;
    this.walkPhase = 0;
    this.mesh.position.set(x, 0, z);
  }

  // Move toward (tx, tz) at `speed`, swinging limbs. Returns distance left.
  stepToward(tx, tz, speed, dt) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      const want = Math.atan2(dx, dz);
      let dh = want - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += Math.max(-3.2 * dt, Math.min(3.2 * dt, dh));
      const step = Math.min(dist, speed * dt);
      this.x += Math.sin(this.heading) * step;
      this.z += Math.cos(this.heading) * step;
      this.speed = speed;
    } else {
      this.speed = 0;
    }
    this.walkPhase += dt * (4 + this.speed * 2.4);
    const swing = Math.sin(this.walkPhase) * 0.55 * Math.min(1, this.speed / 2);
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    return dist;
  }

  takeKnockback(fromX, fromZ, force) {
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.x += (dx / d) * force;
    this.z += (dz / d) * force;
  }
}

export class Pedestrian extends Walker {
  constructor(scene, rng) {
    const mesh = makePersonMesh(rng.pick(SHIRTS), rng.pick(SKINS));
    const lines = [];
    for (let k = 0; k <= 8; k++) lines.push(-176 + k * 44);
    const line = rng.pick(lines);
    const along = rng.range(-170, 170);
    const side = rng.chance(0.5) ? 9.5 : -9.5;
    const x = rng.chance(0.5) ? along : line + side;
    const z = rng.chance(0.5) ? line + side : along;
    super(mesh, x, z);
    this.rng = rng;
    this.axis = rng.chance(0.5) ? 'x' : 'z';
    this.dir = rng.chance(0.5) ? 1 : -1;
    this.line = line;
    this.side = side;
    this.fleeTimer = 0;
    this.fleeX = 0;
    this.fleeZ = 0;
    scene.add(mesh);
  }

  update(dt, player, playerInCar, playerSpeed) {
    // Flee when the player's car bears down, or a punch lands nearby.
    const dx = this.x - player.x;
    const dz = this.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (this.fleeTimer <= 0 && dist < (playerInCar ? 9 : 4) && (playerInCar ? playerSpeed > 4 : true)) {
      this.fleeTimer = 2.2;
      this.fleeX = this.x + (dx / (dist || 1)) * 26;
      this.fleeZ = this.z + (dz / (dist || 1)) * 26;
    }
    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      this.stepToward(this.fleeX, this.fleeZ, 5.2, dt);
      return;
    }
    // Amble along the sidewalk; turn at intersections sometimes.
    const along = this.axis === 'x' ? this.x : this.z;
    if (Math.abs(along % 44) < 1 && this.rng.chance(dt * 0.8)) {
      this.axis = this.axis === 'x' ? 'z' : 'x';
      this.dir = this.rng.chance(0.5) ? 1 : -1;
      this.line = Math.round((this.axis === 'x' ? this.z : this.x) / 44) * 44;
      this.side = this.rng.chance(0.5) ? 9.5 : -9.5;
    }
    const target = this.axis === 'x'
      ? { x: this.x + this.dir * 10, z: this.line + this.side }
      : { x: this.line + this.side, z: this.z + this.dir * 10 };
    this.stepToward(target.x, target.z, 1.4, dt);
    this.x = Math.max(-180, Math.min(180, this.x));
    this.z = Math.max(-180, Math.min(180, this.z));
  }
}

export class Thug extends Walker {
  constructor(scene, x, z, opts = {}) {
    const mesh = makePersonMesh(opts.shirt ?? 0x1c1c22, opts.skin ?? SKINS[0], opts.scale ?? 1.08);
    super(mesh, x, z);
    this.hp = opts.hp ?? 40;
    this.maxHp = this.hp;
    this.punchDamage = opts.damage ?? 8;
    this.punchRange = 1.9;
    this.punchCooldown = 0;
    this.attackSpeed = opts.speed ?? 3.1;
    this.reward = opts.reward ?? 25;
    this.dead = false;
    this.isBoss = !!opts.boss;
    this.name = opts.name ?? 'Thug';
    scene.add(mesh);
  }

  // Chase the player and punch when close. Returns damage dealt this frame.
  update(dt, player, onHitPlayer) {
    if (this.dead) return 0;
    this.punchCooldown -= dt;
    const dist = Math.hypot(player.x - this.x, player.z - this.z);
    if (dist < 14) {
      this.stepToward(player.x, player.z, this.attackSpeed, dt);
    } else {
      this.stepToward(this.x, this.z, 0, dt);
    }
    if (dist < this.punchRange && this.punchCooldown <= 0) {
      this.punchCooldown = 0.95;
      // Wind the arm up so the punch reads on screen.
      this.mesh.userData.armR.rotation.x = -1.6;
      if (onHitPlayer) onHitPlayer(this.punchDamage);
      return this.punchDamage;
    }
    return 0;
  }

  takeHit(damage, fromX, fromZ) {
    if (this.dead) return false;
    this.hp -= damage;
    this.takeKnockback(fromX, fromZ, 0.7);
    if (this.hp <= 0) {
      this.dead = true;
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.4;
      return true;
    }
    return false;
  }
}

export class People {
  constructor(scene) {
    this.scene = scene;
    this.rng = new Rng(4242);
    this.pedestrians = [];
    this.thugs = [];
    this.boss = null;
    for (let i = 0; i < 22; i++) this.pedestrians.push(new Pedestrian(scene, this.rng));
  }

  spawnAmbientThugs(near) {
    for (let i = 0; i < 3; i++) {
      // Stand clear of the plaza fountain (radius ~5.6 around the centre).
      const thug = new Thug(this.scene, near.x + (i - 1) * 4, near.z + 9, {});
      this.thugs.push(thug);
    }
  }

  spawnMissionThugs(center, count) {
    const made = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const thug = new Thug(this.scene, center.x + Math.cos(angle) * 7, center.z + Math.sin(angle) * 7, {});
      this.thugs.push(thug);
      made.push(thug);
    }
    return made;
  }

  spawnBoss(center) {
    this.boss = new Thug(this.scene, center.x, center.z, {
      hp: 300, damage: 18, speed: 3.6, scale: 1.22, shirt: 0xd4af37, reward: 0, boss: true, name: 'Vic Marino',
    });
    this.thugs.push(this.boss);
    // His crew: three more thugs at his flanks.
    for (const [ox, oz] of [[-6, 4], [6, 4], [0, 8]]) {
      this.thugs.push(new Thug(this.scene, center.x + ox, center.z + oz, {}));
    }
    return this.boss;
  }

  update(dt, player, playerInCar, playerSpeed, onHitPlayer) {
    for (const ped of this.pedestrians) ped.update(dt, player, playerInCar, playerSpeed);
    for (const thug of this.thugs) thug.update(dt, player, onHitPlayer);
  }

  // The player's punch: everything in range and in front of the player
  // takes damage. Returns the list of thugs killed by this punch.
  playerPunch(px, pz, heading, range = 2.1) {
    const killed = [];
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (const thug of this.thugs) {
      if (thug.dead) continue;
      const dx = thug.x - px;
      const dz = thug.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > range) continue;
      const dot = (dx * fx + dz * fz) / (dist || 1);
      if (dot < 0.25 && dist > 0.6) continue; // must be roughly in front
      if (thug.takeHit(20, px, pz)) killed.push(thug);
    }
    // Pedestrians scatter, never take damage.
    for (const ped of this.pedestrians) {
      if (Math.hypot(ped.x - px, ped.z - pz) < 4) {
        ped.fleeTimer = 2.5;
        ped.fleeX = ped.x + (ped.x - px) * 3;
        ped.fleeZ = ped.z + (ped.z - pz) * 3;
      }
    }
    return killed;
  }

  clearThugs() {
    for (const thug of this.thugs) this.scene.remove(thug.mesh);
    this.thugs = [];
    this.boss = null;
  }
}
