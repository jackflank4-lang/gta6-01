// People for Solmar Bay — Neon Heat.
// Lena (the hero), wandering pedestrians, mission thugs, the boss Vic
// Marino, and foot cops who bust the player when the heat is on.
const THREE = window.THREE;

function makePersonMesh(shirt, pants, scale, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin || 0xd9a066, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.85, 8), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  for (const x of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 6), pantsMat);
    leg.position.set(x, 0.31, 0);
    g.add(leg);
  }
  for (const x of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.7, 6), shirtMat);
    arm.position.set(x, 1.1, 0);
    g.add(arm);
  }
  g.scale.setScalar(scale || 1);
  return g;
}

const PED_SHIRTS = [0x3a7bd8, 0xd83a3a, 0x3ad8a0, 0xe8d83a, 0x8a3ad8, 0xd8d8e0, 0x5ad8e0, 0xd88a3a];
const PED_PANTS = [0x2a2a30, 0x3a4a6a, 0x5a3a2a, 0x2a3a2a];

export class PeopleSystem {
  constructor(scene, city, rng, callbacks) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cb = callbacks || {};
    this.hero = {
      pos: new THREE.Vector3(-110, 0, 96),
      heading: Math.PI,
      vy: 0,
      grounded: true,
      hp: 100,
      punchCd: 0,
      speed: 0,
      onFoot: true,
      mesh: null,
    };
    this.pedestrians = [];
    this.thugs = [];
    this.boss = null;
    this.cops = [];
    this.spawnPedestrians();
  }

  spawnPedestrians() {
    for (let i = 0; i < 22; i++) {
      const mesh = makePersonMesh(
        this.rng.pick(PED_SHIRTS),
        this.rng.pick(PED_PANTS),
        this.rng.range(0.92, 1.08)
      );
      const x = this.rng.range(-160, 160);
      const z = this.rng.range(-160, 160);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.pedestrians.push({
        mesh,
        pos: mesh.position,
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.1, 1.8),
        target: { x: this.rng.range(-160, 160), z: this.rng.range(-160, 160) },
        flee: 0,
      });
    }
  }

  heroMesh() {
    if (!this.hero.mesh) {
      // Lena: teal jacket, dark jeans, pink bandana cap.
      const m = makePersonMesh(0x0e8a8a, 0x1a1a2e, 1.0, 0xe8b088);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xff5ce1, roughness: 0.6 })
      );
      cap.position.y = 1.78;
      m.add(cap);
      this.hero.mesh = m;
      this.scene.add(m);
    }
    return this.hero.mesh;
  }

  spawnThugs(n, center, spread) {
    for (let i = 0; i < n; i++) {
      const mesh = makePersonMesh(0x8a1a1a, 0x1a1a1a, 1.08, 0xc98a5a);
      const x = center.x + this.rng.range(-spread, spread);
      const z = center.z + this.rng.range(-spread, spread);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.thugs.push({ mesh, pos: mesh.position, hp: 50, attackCd: 0, alive: true, heading: 0 });
    }
    return this.thugs;
  }

  spawnBoss(pos) {
    const mesh = makePersonMesh(0x1a1a1a, 0x3a2a1a, 1.3, 0xd9a066);
    // Gold chain.
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.05, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd23a, metalness: 0.9, roughness: 0.3 })
    );
    chain.position.y = 1.35;
    chain.rotation.x = Math.PI / 2.4;
    mesh.add(chain);
    mesh.position.set(pos.x, 0, pos.z);
    this.scene.add(mesh);
    this.boss = { mesh, pos: mesh.position, hp: 300, attackCd: 0, alive: true, heading: 0 };
    return this.boss;
  }

  spawnFootCop(pos) {
    const mesh = makePersonMesh(0x1a2a5a, 0x1a1a2e, 1.02, 0xc98a5a);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x0a1a3a, roughness: 0.5 })
    );
    cap.position.y = 1.92;
    mesh.add(cap);
    mesh.position.set(pos.x, 0, pos.z);
    this.scene.add(mesh);
    const cop = { mesh, pos: mesh.position, touchTimer: 0, giveUp: 0 };
    this.cops.push(cop);
    return cop;
  }

  clearEnemies() {
    for (const t of this.thugs) this.scene.remove(t.mesh);
    this.thugs = [];
    if (this.boss) {
      this.scene.remove(this.boss.mesh);
      this.boss = null;
    }
    for (const c of this.cops) this.scene.remove(c.mesh);
    this.cops = [];
  }

  // Hero punch: 25 damage to the nearest enemy in front within 2.4 m.
  heroPunch() {
    const h = this.hero;
    if (h.punchCd > 0 || !h.onFoot) return null;
    h.punchCd = 0.35;
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    let best = null;
    let bestD = 2.4;
    const consider = (target, kind) => {
      const dx = target.pos.x - h.pos.x;
      const dz = target.pos.z - h.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > bestD) return;
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      if (dot < 0.35) return;
      bestD = d;
      best = { target, kind };
    };
    for (const t of this.thugs) if (t.alive) consider(t, 'thug');
    if (this.boss && this.boss.alive) consider(this.boss, 'boss');
    for (const c of this.cops) consider(c, 'cop');
    for (const p of this.pedestrians) consider(p, 'ped');
    if (!best) return { hit: false };
    if (best.kind === 'ped') {
      best.target.flee = 3;
      return { hit: true, kind: 'ped' };
    }
    if (best.kind === 'cop') {
      this.scene.remove(best.target.mesh);
      this.cops.splice(this.cops.indexOf(best.target), 1);
      if (this.cb.onCopDown) this.cb.onCopDown();
      return { hit: true, kind: 'cop' };
    }
    best.target.hp -= 25;
    if (best.target.hp <= 0) {
      best.target.alive = false;
      this.scene.remove(best.target.mesh);
      if (best.kind === 'thug') {
        this.thugs.splice(this.thugs.indexOf(best.target), 1);
        if (this.cb.onThugKilled) this.cb.onThugKilled(best.target);
      } else if (best.kind === 'boss') {
        if (this.cb.onBossKilled) this.cb.onBossKilled(best.target);
      }
      return { hit: true, kind: best.kind, killed: true };
    }
    return { hit: true, kind: best.kind, hpLeft: best.target.hp };
  }

  hurtHero(amount) {
    const h = this.hero;
    h.hp = Math.max(0, h.hp - amount);
    if (this.cb.onHeroHurt) this.cb.onHeroHurt(h.hp);
    return h.hp;
  }

  update(dt, input, driving, camYaw) {
    const h = this.hero;
    h.punchCd = Math.max(0, h.punchCd - dt);
    if (h.onFoot && !driving) {
      const axes = input.axes();
      const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const speed = sprint ? 9 : 6;
      // Camera-relative movement.
      const fwdX = Math.sin(camYaw);
      const fwdZ = Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);
      let mx = fwdX * axes.y + rightX * axes.x;
      let mz = fwdZ * axes.y + rightZ * axes.x;
      const len = Math.sqrt(mx * mx + mz * mz);
      if (len > 0.01) {
        mx /= len;
        mz /= len;
        h.speed = speed;
        const wantHeading = Math.atan2(mx, mz);
        let dh = wantHeading - h.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        h.heading += Math.max(-10 * dt, Math.min(10 * dt, dh));
        const nx = h.pos.x + mx * speed * dt;
        const nz = h.pos.z + mz * speed * dt;
        const fixed = this.city.collideCircle(nx, nz, 0.5);
        h.pos.x = fixed.x;
        h.pos.z = fixed.z;
      } else {
        h.speed = 0;
      }
      // Jump.
      if ((input.wasPressed('Space') || input.wasPressed('KeyJ')) && h.grounded) {
        h.vy = 6.5;
        h.grounded = false;
      }
      if (!h.grounded) {
        h.vy -= 22 * dt;
        h.pos.y += h.vy * dt;
        if (h.pos.y <= 0) {
          h.pos.y = 0;
          h.vy = 0;
          h.grounded = true;
        }
      }
      const mesh = this.heroMesh();
      mesh.position.copy(h.pos);
      mesh.rotation.y = h.heading;
      // Walk bob.
      mesh.position.y = h.pos.y + (h.speed > 0 ? Math.abs(Math.sin(performance.now() / 140)) * 0.06 : 0);
    }

    // Pedestrians wander; flee when punched.
    for (const p of this.pedestrians) {
      let tx = p.target.x;
      let tz = p.target.z;
      let sp = p.speed;
      if (p.flee > 0) {
        p.flee -= dt;
        const dx = p.pos.x - h.pos.x;
        const dz = p.pos.z - h.pos.z;
        const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
        tx = p.pos.x + (dx / d) * 20;
        tz = p.pos.z + (dz / d) * 20;
        sp = 5;
      }
      const dx = tx - p.pos.x;
      const dz = tz - p.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.5) {
        p.target = { x: this.rng.range(-160, 160), z: this.rng.range(-160, 160) };
      } else {
        p.heading = Math.atan2(dx, dz);
        const nx = p.pos.x + (dx / d) * sp * dt;
        const nz = p.pos.z + (dz / d) * sp * dt;
        const fixed = this.city.collideCircle(nx, nz, 0.5);
        p.pos.x = fixed.x;
        p.pos.z = fixed.z;
        p.mesh.rotation.y = p.heading;
      }
    }

    // Thugs chase and punch.
    for (const t of this.thugs) {
      if (!t.alive) continue;
      t.attackCd = Math.max(0, t.attackCd - dt);
      const dx = h.pos.x - t.pos.x;
      const dz = h.pos.z - t.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 26 && h.onFoot) {
        if (d > 1.9) {
          t.pos.x += (dx / d) * 3.6 * dt;
          t.pos.z += (dz / d) * 3.6 * dt;
          const fixed = this.city.collideCircle(t.pos.x, t.pos.z, 0.5);
          t.pos.x = fixed.x;
          t.pos.z = fixed.z;
        } else if (t.attackCd <= 0) {
          t.attackCd = 1.1;
          this.hurtHero(6);
        }
        t.heading = Math.atan2(dx, dz);
        t.mesh.rotation.y = t.heading;
      }
    }

    // Boss Vic Marino: faster, hits harder.
    if (this.boss && this.boss.alive) {
      const b = this.boss;
      b.attackCd = Math.max(0, b.attackCd - dt);
      const dx = h.pos.x - b.pos.x;
      const dz = h.pos.z - b.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 30 && h.onFoot) {
        if (d > 2.1) {
          b.pos.x += (dx / d) * 4.4 * dt;
          b.pos.z += (dz / d) * 4.4 * dt;
          const fixed = this.city.collideCircle(b.pos.x, b.pos.z, 0.7);
          b.pos.x = fixed.x;
          b.pos.z = fixed.z;
        } else if (b.attackCd <= 0) {
          b.attackCd = 1.0;
          this.hurtHero(14);
        }
        b.heading = Math.atan2(dx, dz);
        b.mesh.rotation.y = b.heading;
      }
    }

    // Foot cops chase on foot; a sustained touch busts the player.
    for (const c of [...this.cops]) {
      const dx = h.pos.x - c.pos.x;
      const dz = h.pos.z - c.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (!h.onFoot || d > 60) {
        c.giveUp += dt;
        if (c.giveUp > 8) {
          this.scene.remove(c.mesh);
          this.cops.splice(this.cops.indexOf(c), 1);
        }
        continue;
      }
      c.giveUp = 0;
      if (d > 1.3) {
        c.touchTimer = 0;
        c.pos.x += (dx / d) * 5.2 * dt;
        c.pos.z += (dz / d) * 5.2 * dt;
        const fixed = this.city.collideCircle(c.pos.x, c.pos.z, 0.5);
        c.pos.x = fixed.x;
        c.pos.z = fixed.z;
      } else {
        c.touchTimer += dt;
        if (c.touchTimer > 0.6 && this.cb.onBusted) {
          this.cb.onBusted();
          c.touchTimer = 0;
        }
      }
      c.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }
}
