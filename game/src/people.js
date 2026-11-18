// people.js — Lena Cruz, the pedestrians of Solmar Bay, and the
// Barracuda crew she fights: thugs and boss Vic Marino.
// Combat is fists only: punch range 2.6 m, 60-degree arc, 25 damage,
// 0.3 s cooldown. Thugs have 50 HP and pay $50 when they drop; Vic
// has 300 HP. Pedestrians wander the sidewalks and flee a fight.
import { makeRng } from './rng.js';

function buildPersonMesh(opts) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: opts.jacket });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: opts.pants });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
  body.position.y = 1.15;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.85;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: opts.hair }));
  hair.position.y = 1.9;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), pants);
  legL.position.set(-0.17, 0.38, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), pants);
  legR.position.set(0.17, 0.38, 0);
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), jacket);
  armL.position.set(-0.42, 1.2, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), jacket);
  armR.position.set(0.42, 1.2, 0);
  g.add(armR);
  g.userData = { legL, legR, armL, armR, body };
  if (opts.scale) g.scale.setScalar(opts.scale);
  return g;
}

export class People {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.rng = makeRng(2024);
    this.hero = {
      pos: new THREE.Vector3(0, 0, 40),
      heading: 0,
      hp: 100,
      onFoot: true,
      grounded: true,
      vy: 0,
      walkPhase: 0,
      mesh: buildPersonMesh({ jacket: 0x0e7a6e, pants: 0x1a2a4a, hair: 0x1a1a1a }),
    };
    this.scene.add(this.hero.mesh);
    this.pedestrians = [];
    this.thugs = [];
    this.boss = null;
    this.punchCooldown = 0;
    this.punchTimer = 0;
    this.onKill = null; // (kind) => void — engine wires the $50 payout
    this.onPunch = null;
    this._spawnPedestrians();
  }

  _spawnPedestrians() {
    const palette = [
      { jacket: 0xc0392b, pants: 0x2c3e50, hair: 0x3a2a1a },
      { jacket: 0x2980b9, pants: 0x1a1a1a, hair: 0x111111 },
      { jacket: 0xf39c12, pants: 0x34495e, hair: 0x6b4a2f },
      { jacket: 0x8e44ad, pants: 0x2c3e50, hair: 0x000000 },
      { jacket: 0x27ae60, pants: 0x7a6a4a, hair: 0x4a2a1a },
    ];
    for (let i = 0; i < 22; i++) {
      const c = this.rng.pick(palette);
      const mesh = buildPersonMesh(c);
      const x = this.rng.range(-170, 170);
      const z = this.rng.range(-170, 170);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.pedestrians.push({
        pos: mesh.position,
        heading: this.rng.range(0, Math.PI * 2),
        mesh,
        speed: this.rng.range(1.2, 2.2),
        walkPhase: this.rng.range(0, 6),
        turnT: this.rng.range(1, 5),
        fleeT: 0,
      });
    }
  }

  spawnThugs(n, x, z) {
    for (let i = 0; i < n; i++) {
      const mesh = buildPersonMesh({ jacket: 0x2a2a2a, pants: 0x3a3a3a, hair: 0x1a1a1a, scale: 1.12 });
      const a = (i / Math.max(n, 1)) * Math.PI * 2;
      const px = x + Math.cos(a) * this.rng.range(3, 6);
      const pz = z + Math.sin(a) * this.rng.range(3, 6);
      mesh.position.set(px, 0, pz);
      this.scene.add(mesh);
      this.thugs.push({
        pos: mesh.position,
        heading: 0,
        hp: 50,
        mesh,
        kind: 'thug',
        speed: 3.2,
        attackCooldown: this.rng.range(0.3, 1),
        walkPhase: this.rng.range(0, 6),
        punchAnim: 0,
      });
    }
  }

  spawnBoss(x, z) {
    const mesh = buildPersonMesh({ jacket: 0xe8e8e8, pants: 0x1a1a1a, hair: 0x888888, scale: 1.3 });
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.boss = {
      pos: mesh.position,
      heading: 0,
      hp: 300,
      mesh,
      kind: 'boss',
      speed: 3.6,
      attackCooldown: 0.5,
      walkPhase: 0,
      punchAnim: 0,
    };
    return this.boss;
  }

  clearEnemies() {
    for (const t of this.thugs) this.scene.remove(t.mesh);
    this.thugs = [];
    if (this.boss) { this.scene.remove(this.boss.mesh); this.boss = null; }
  }

  hurtHero(amt) {
    this.hero.hp = Math.max(0, this.hero.hp - amt);
    this.audio.hurt();
  }

  // Returns {hit, kind, killed} for the closest enemy in the punch arc,
  // or null when nothing is in range. Firing it also swings the arm.
  heroPunch() {
    if (this.punchCooldown > 0 || !this.hero.onFoot) return null;
    this.punchCooldown = 0.3;
    this.punchTimer = 0.3;
    this.audio.punch();
    const h = this.hero;
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    let best = null;
    let bestD = 2.6;
    const targets = [...this.thugs];
    if (this.boss) targets.push(this.boss);
    for (const t of targets) {
      const dx = t.pos.x - h.pos.x;
      const dz = t.pos.z - h.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > bestD) continue;
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      if (dot < 0.5) continue; // outside the 60-degree arc
      best = t;
      bestD = d;
    }
    if (!best) return { hit: false, kind: null, killed: false };
    best.hp -= 25;
    const killed = best.hp <= 0;
    if (killed) {
      this.scene.remove(best.mesh);
      if (best.kind === 'boss') this.boss = null;
      else this.thugs.splice(this.thugs.indexOf(best), 1);
      if (this.onKill) this.onKill(best.kind);
    }
    if (this.onPunch) this.onPunch(best.kind, killed);
    return { hit: true, kind: best.kind, killed };
  }

  update(dt, input, driving, camYaw) {
    const h = this.hero;
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    if (driving) {
      h.mesh.visible = false;
      return;
    }
    h.mesh.visible = true;
    const axes = input.axes();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? 9 : 6;
    // Camera-relative movement.
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let mx = fx * axes.y + rx * axes.x;
    let mz = fz * axes.y + rz * axes.x;
    const ml = Math.sqrt(mx * mx + mz * mz);
    if (ml > 0.01) {
      mx /= ml; mz /= ml;
      h.heading = Math.atan2(mx, mz);
      h.pos.x += mx * speed * dt;
      h.pos.z += mz * speed * dt;
      h.walkPhase += dt * speed * 1.6;
    }
    // Jump.
    if (input.wasPressed('Space') && h.grounded) {
      h.vy = 6.5;
      h.grounded = false;
    }
    if (!h.grounded) {
      h.vy -= 18 * dt;
      h.pos.y += h.vy * dt;
      if (h.pos.y <= 0) { h.pos.y = 0; h.vy = 0; h.grounded = true; }
    }
    // Keep Lena inside the world and out of buildings.
    h.pos.x = Math.max(-196, Math.min(196, h.pos.x));
    h.pos.z = Math.max(-196, Math.min(232, h.pos.z));
    this.city.resolveCircle(h.pos, 0.6);
    // Punch key.
    if (input.wasPressed('KeyF')) this.heroPunch();
    // Mesh pose.
    const m = h.mesh;
    m.position.copy(h.pos);
    m.rotation.y = h.heading;
    const swing = ml > 0.01 ? Math.sin(h.walkPhase) * 0.55 : 0;
    m.userData.legL.rotation.x = swing;
    m.userData.legR.rotation.x = -swing;
    m.userData.armL.rotation.x = -swing * 0.7;
    m.userData.armR.rotation.x = this.punchTimer > 0 ? -1.6 : swing * 0.7;
    // Pedestrians: stroll, turn sometimes, flee a fight.
    for (const p of this.pedestrians) {
      p.turnT -= dt;
      const dhx = h.pos.x - p.pos.x;
      const dhz = h.pos.z - p.pos.z;
      const dh = Math.sqrt(dhx * dhx + dhz * dhz);
      let spd = p.speed;
      if (dh < 7 && this.thugs.length + (this.boss ? 1 : 0) > 0) {
        // Flee from the hero during a brawl.
        p.heading = Math.atan2(-dhx, -dhz);
        spd = 5;
        p.fleeT = 1;
      } else if (p.turnT <= 0) {
        p.heading += this.rng.range(-1.2, 1.2);
        p.turnT = this.rng.range(2, 6);
      }
      p.pos.x += Math.sin(p.heading) * spd * dt;
      p.pos.z += Math.cos(p.heading) * spd * dt;
      if (p.pos.x > 178 || p.pos.x < -178 || p.pos.z > 178 || p.pos.z < -178) {
        p.heading += Math.PI;
        p.pos.x = Math.max(-176, Math.min(176, p.pos.x));
        p.pos.z = Math.max(-176, Math.min(176, p.pos.z));
      }
      this.city.resolveCircle(p.pos, 0.6);
      p.walkPhase += dt * spd * 1.6;
      p.mesh.rotation.y = p.heading;
      const sw = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legL.rotation.x = sw;
      p.mesh.userData.legR.rotation.x = -sw;
      p.mesh.userData.armL.rotation.x = -sw * 0.6;
      p.mesh.userData.armR.rotation.x = sw * 0.6;
    }
    // Thugs and boss chase Lena and swing when close.
    const enemies = [...this.thugs];
    if (this.boss) enemies.push(this.boss);
    for (const e of enemies) {
      e.attackCooldown -= dt;
      e.punchAnim = Math.max(0, e.punchAnim - dt);
      const dx = h.pos.x - e.pos.x;
      const dz = h.pos.z - e.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.5) {
        e.heading = Math.atan2(dx, dz);
        if (d > 2.1) {
          e.pos.x += Math.sin(e.heading) * e.speed * dt;
          e.pos.z += Math.cos(e.heading) * e.speed * dt;
          e.walkPhase += dt * e.speed * 1.6;
        }
      }
      if (d < 2.3 && e.attackCooldown <= 0 && h.hp > 0) {
        e.attackCooldown = e.kind === 'boss' ? 1.0 : 1.2;
        e.punchAnim = 0.3;
        this.hurtHero(e.kind === 'boss' ? 10 : 5);
      }
      this.city.resolveCircle(e.pos, 0.7);
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = e.heading;
      const sw = Math.sin(e.walkPhase) * 0.5;
      e.mesh.userData.legL.rotation.x = sw;
      e.mesh.userData.legR.rotation.x = -sw;
      e.mesh.userData.armR.rotation.x = e.punchAnim > 0 ? -1.6 : -sw * 0.6;
      e.mesh.userData.armL.rotation.x = sw * 0.6;
    }
    // Gentle separation between enemies so they don't stack.
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i], b = enemies[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 1.44 && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const push = (1.2 - d) / 2;
          a.pos.x -= (dx / d) * push;
          a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push;
          b.pos.z += (dz / d) * push;
        }
      }
    }
  }
}
