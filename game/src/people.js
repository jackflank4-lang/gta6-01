// People for Solmar Bay: the hero Lena Cruz, 22 wandering pedestrians,
// thugs (missions 3 and 5), the boss Vic Marino, and foot cops who chase
// the hero when she is wanted and on foot.
// Movement is deliberately simple and robust: no pathfinding, just steering
// toward a target point with building collision handled by city.blocked.
const THREE = window.THREE;

const PED_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xd35400, 0x7f8c8d];

function makePersonMesh(shirt, pants, scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.8, 0.32),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.65;
  head.castShadow = true;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  for (const lx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), legMat);
    leg.position.set(lx, 0.35, 0);
    g.add(leg);
  }
  g.scale.setScalar(scale);
  return g;
}

export function createPeople(scene, city, rng) {
  const hero = {
    x: 0, y: 0, z: 0, heading: 0, vy: 0, hp: 100,
    onGround: true, mesh: null, punchCooldown: 0, walkPhase: 0,
  };
  hero.mesh = makePersonMesh(0x00c8a0, 0x1c2733);
  // Lena's teal jacket and dark hair set her apart from the crowd.
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x14100c }),
  );
  hair.position.y = 1.72;
  hair.scale.set(1, 0.7, 1);
  hero.mesh.add(hair);
  scene.add(hero.mesh);

  const peds = [];
  for (let i = 0; i < 22; i += 1) {
    const p = city.roadPoint();
    const mesh = makePersonMesh(rng.pick(PED_COLORS), rng.pick([0x2c3e50, 0x5d4037, 0x37474f]));
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    peds.push({
      mesh, x: p.x, z: p.z, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.0), tx: p.x, tz: p.z,
      flee: 0, wait: rng.range(0, 3),
    });
  }

  const thugs = [];
  let boss = null;
  const cops = [];

  function spawnThug(x, z, opts = {}) {
    const mesh = makePersonMesh(opts.shirt || 0x8b1a1a, 0x222222, opts.scale || 1.15);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const t = {
      mesh, x, z, heading: rng.range(0, Math.PI * 2),
      hp: opts.hp || 100, dmg: opts.dmg || 6, speed: opts.speed || 3.2,
      attackCooldown: 0, dead: false, isBoss: !!opts.isBoss, name: opts.name || 'Thug',
      reward: opts.reward || 50,
    };
    thugs.push(t);
    if (opts.isBoss) boss = t;
    return t;
  }

  function spawnFootCop(x, z) {
    const mesh = makePersonMesh(0x1a3a6b, 0x111111, 1.1);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const c = { mesh, x, z, heading: 0, attackCooldown: 0, bustTimer: 0 };
    cops.push(c);
    return c;
  }

  function removePerson(p, list) {
    scene.remove(p.mesh);
    const i = list.indexOf(p);
    if (i >= 0) list.splice(i, 1);
  }

  // Make every pedestrian within radius run away from (x, z).
  function scare(x, z, radius) {
    for (const p of peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.flee = 3;
        const a = Math.atan2(p.x - x, p.z - z);
        p.tx = p.x + Math.sin(a) * 20;
        p.tz = p.z + Math.cos(a) * 20;
      }
    }
  }

  function updateHero(dt, G) {
    const input = G.input;
    hero.punchCooldown = Math.max(0, hero.punchCooldown - dt);
    if (G.driving) {
      // The hero rides inside the car: mesh hidden, position follows it.
      hero.mesh.visible = false;
      if (G.car) {
        hero.x = G.car.x;
        hero.z = G.car.z;
        hero.heading = G.car.heading;
      }
      return;
    }
    hero.mesh.visible = true;
    const mx = input ? input.moveX() : 0;
    const my = input ? input.moveY() : 0;
    const sprint = input ? input.sprint() : false;
    const speed = sprint ? 8 : 5;
    let dx = 0;
    let dz = 0;
    if (mx !== 0 || my !== 0) {
      // Camera-relative movement: forward is away from the camera.
      const camA = G.cameraAngle || 0;
      const fx = Math.sin(camA);
      const fz = Math.cos(camA);
      const rx = Math.cos(camA);
      const rz = -Math.sin(camA);
      dx = fx * my + rx * mx;
      dz = fz * my + rz * mx;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      hero.heading = Math.atan2(dx, dz);
    }
    const nx = hero.x + dx * speed * dt;
    const nz = hero.z + dz * speed * dt;
    if (!city.blocked(nx, hero.z, 0.6)) hero.x = nx;
    if (!city.blocked(hero.x, nz, 0.6)) hero.z = nz;
    hero.walkPhase += dt * (mx !== 0 || my !== 0 ? speed * 1.6 : 0);

    // Jump: exact kinematic update, peak ~1.00 m (vy 6, g 16).
    if (input && input.hit('Space') && hero.onGround) {
      hero.vy = 6;
      hero.onGround = false;
    }
    if (!hero.onGround) {
      hero.y += hero.vy * dt - 0.5 * 16 * dt * dt;
      hero.vy -= 16 * dt;
      if (hero.y <= 0) {
        hero.y = 0;
        hero.vy = 0;
        hero.onGround = true;
      }
    }
    // Punch: F key or mouse click, 2.2 m arc in front.
    const punched = (input && (input.hit('KeyF') || input.mousePressed)) && hero.punchCooldown <= 0;
    if (punched) {
      hero.punchCooldown = 0.45;
      if (G.audio) G.audio.punch();
      const fx = Math.sin(hero.heading);
      const fz = Math.cos(hero.heading);
      for (const t of [...thugs]) {
        if (t.dead) continue;
        const dx2 = t.x - hero.x;
        const dz2 = t.z - hero.z;
        const d = Math.hypot(dx2, dz2);
        if (d < 2.4 && (dx2 * fx + dz2 * fz) / (d || 1) > 0.2) {
          t.hp -= 34;
          if (G.audio) G.audio.punch();
          if (t.hp <= 0) {
            t.dead = true;
            removePerson(t, thugs);
            if (t.isBoss) boss = null;
            if (G.onThugKilled) G.onThugKilled(t);
          }
        }
      }
      for (const c of [...cops]) {
        const d = Math.hypot(c.x - hero.x, c.z - hero.z);
        if (d < 2.4) {
          removePerson(c, cops);
          if (G.onCopDown) G.onCopDown(c);
        }
      }
    }
    hero.mesh.position.set(hero.x, hero.y, hero.z);
    hero.mesh.rotation.y = hero.heading;
    // Little walk bob.
    hero.mesh.position.y = hero.y + Math.abs(Math.sin(hero.walkPhase)) * 0.06;
  }

  function updatePeds(dt, G) {
    for (const p of peds) {
      if (p.flee > 0) p.flee -= dt;
      const dx = p.tx - p.x;
      const dz = p.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        if (p.wait > 0) {
          p.wait -= dt;
        } else {
          const t = city.roadPoint();
          p.tx = t.x;
          p.tz = t.z;
          p.wait = rng.range(1, 4);
        }
        continue;
      }
      const sp = p.flee > 0 ? 4.2 : p.speed;
      const nx = p.x + (dx / d) * sp * dt;
      const nz = p.z + (dz / d) * sp * dt;
      if (!city.blocked(nx, p.z, 0.5)) p.x = nx;
      if (!city.blocked(p.x, nz, 0.5)) p.z = nz;
      p.heading = Math.atan2(dx, dz);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  function updateThugs(dt, G) {
    for (const t of [...thugs]) {
      if (t.dead) continue;
      t.attackCooldown = Math.max(0, t.attackCooldown - dt);
      const dx = hero.x - t.x;
      const dz = hero.z - t.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 26 && !G.driving) {
        const nx = t.x + (dx / d) * t.speed * dt;
        const nz = t.z + (dz / d) * t.speed * dt;
        if (!city.blocked(nx, t.z, 0.6)) t.x = nx;
        if (!city.blocked(t.x, nz, 0.6)) t.z = nz;
        t.heading = Math.atan2(dx, dz);
        if (d < 1.9 && t.attackCooldown <= 0) {
          t.attackCooldown = 1.15;
          if (G.onHeroDamaged) G.onHeroDamaged(t.dmg, t.isBoss ? 'boss' : 'thug');
        }
      }
      t.mesh.position.set(t.x, 0, t.z);
      t.mesh.rotation.y = t.heading;
    }
  }

  function updateCops(dt, G) {
    for (const c of [...cops]) {
      c.attackCooldown = Math.max(0, c.attackCooldown - dt);
      const dx = hero.x - c.x;
      const dz = hero.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 1.6) {
        c.bustTimer += dt;
        if (c.bustTimer > 1.5 && G.onBusted) G.onBusted();
      } else {
        c.bustTimer = 0;
      }
      if (!G.driving && d > 1.4) {
        const nx = c.x + (dx / d) * 5.2 * dt;
        const nz = c.z + (dz / d) * 5.2 * dt;
        if (!city.blocked(nx, c.z, 0.6)) c.x = nx;
        if (!city.blocked(c.x, nz, 0.6)) c.z = nz;
        c.heading = Math.atan2(dx, dz);
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
  }

  function update(dt, G) {
    updateHero(dt, G);
    updatePeds(dt, G);
    updateThugs(dt, G);
    updateCops(dt, G);
  }

  function resetHero(x, z) {
    hero.x = x;
    hero.z = z;
    hero.y = 0;
    hero.vy = 0;
    hero.heading = 0;
    hero.mesh.position.set(x, 0, z);
    hero.mesh.visible = true;
  }

  return {
    update, hero, peds, thugs, cops,
    get boss() { return boss; },
    spawnThug, spawnFootCop, scare, resetHero,
  };
}
