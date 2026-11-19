// People for Solmar Bay (v10): the hero Lena Cruz, pedestrians, thugs, foot
// cops and the boss Vic Marino. People are simple cylinder + sphere figures
// with a walk bob; thugs and cops chase and punch, pedestrians wander and
// flee when scared.

const SHIRT_COLORS = [0xd4a24a, 0x4a7ad4, 0x7a4ad4, 0x4ad47a, 0xd44a7a, 0x9a9a9a, 0x4a9ad4, 0xd47a4a];

function buildPersonMesh(scene, shirtColor, scale) {
  const THREE = window.THREE;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.36, 1.05, 10),
    new THREE.MeshLambertMaterial({ color: shirtColor }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xc89878 }),
  );
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.42, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x22242e }),
  );
  legs.position.y = 0.21;
  g.add(legs);
  g.scale.setScalar(scale || 1);
  scene.add(g);
  return g;
}

export function createPeople(game) {
  const { scene, city, rng } = game;
  const THREE = window.THREE;

  // The hero: Lena Cruz, red jacket, starts at the crew hideout.
  const heroMesh = buildPersonMesh(scene, 0xc22a2a, 1);
  heroMesh.position.set(66, 0, 96);
  const hero = {
    mesh: heroMesh,
    pos: heroMesh.position,
    heading: Math.PI,
    velY: 0,
    onGround: true,
    walkT: 0,
    punchCd: 0,
    hurtCd: 0,
  };

  const pedestrians = [];
  for (let i = 0; i < 22; i += 1) {
    const p = city.randomSidewalkPoint();
    const mesh = buildPersonMesh(scene, SHIRT_COLORS[i % SHIRT_COLORS.length], 0.95 + rng.next() * 0.1);
    mesh.position.set(p.x, 0, p.z);
    pedestrians.push({
      mesh, pos: mesh.position, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(0.8, 1.6), target: city.randomSidewalkPoint(),
      fleeT: 0, walkT: rng.range(0, 6),
    });
  }

  const thugs = [];
  const cops = [];
  let boss = null;

  function spawnThug(x, z, hp, isMission) {
    const mesh = buildPersonMesh(scene, 0x1a1a22, 1.06);
    mesh.position.set(x, 0, z);
    const thug = {
      mesh, pos: mesh.position, heading: rng.range(0, Math.PI * 2),
      hp: hp || 60, maxHp: hp || 60, isMission: !!isMission,
      attackCd: 0, down: false, downT: 0, walkT: 0, home: { x, z },
    };
    thugs.push(thug);
    return thug;
  }
  // Three ambient thugs hang around the plaza and the casino.
  spawnThug(30, 30, 60, false);
  spawnThug(14, 16, 60, false);
  spawnThug(104, -102, 60, false);

  function spawnBoss(x, z) {
    if (boss) return boss;
    const mesh = buildPersonMesh(scene, 0xf0ead8, 1.18);
    mesh.position.set(x, 0, z);
    boss = {
      mesh, pos: mesh.position, heading: 0, hp: 300, maxHp: 300,
      attackCd: 0, down: false, walkT: 0,
    };
    return boss;
  }

  function spawnCop(x, z) {
    const mesh = buildPersonMesh(scene, 0x1a2a6a, 1.02);
    mesh.position.set(x, 0, z);
    const cop = {
      mesh, pos: mesh.position, heading: 0, hp: 50,
      attackCd: 0, bustT: 0, down: false, walkT: 0,
    };
    cops.push(cop);
    return cop;
  }

  function moveWithCollision(person, nx, nz, r) {
    const fixed = city.collideCircle(nx, nz, r);
    person.pos.x = fixed.x;
    person.pos.z = fixed.z;
  }

  function updateHero(dt, input, cameraYaw) {
    const mv = input.moveVector();
    const sprint = input.sprinting();
    const speed = sprint ? 9 : 5.2;
    // Camera-relative movement: forward is where the camera looks.
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    const rx = Math.cos(cameraYaw);
    const rz = -Math.sin(cameraYaw);
    let mx = fx * mv.z + rx * mv.x;
    let mz = fz * mv.z + rz * mv.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const nx = hero.pos.x + mx * speed * dt;
      const nz = hero.pos.z + mz * speed * dt;
      moveWithCollision(hero, nx, nz, 0.7);
      hero.heading = Math.atan2(mx, mz);
      hero.walkT += dt * (sprint ? 13 : 9);
    }
    hero.mesh.rotation.y = hero.heading;
    // Jump + gravity (~1 m high).
    if (input.wasPressed('Space') && hero.onGround) {
      hero.velY = 6.4;
      hero.onGround = false;
    }
    if (!hero.onGround) {
      hero.velY -= 20 * dt;
      hero.pos.y += hero.velY * dt;
      if (hero.pos.y <= 0) {
        hero.pos.y = 0;
        hero.velY = 0;
        hero.onGround = true;
      }
    }
    // Walk bob.
    hero.mesh.position.y = hero.pos.y + (len > 0.01 ? Math.abs(Math.sin(hero.walkT)) * 0.07 : 0);
    if (hero.punchCd > 0) hero.punchCd -= dt;
    if (hero.hurtCd > 0) hero.hurtCd -= dt;
  }

  function updatePedestrians(dt, playerPos, scared) {
    for (const p of pedestrians) {
      let tx = p.target.x;
      let tz = p.target.z;
      let sp = p.speed;
      if (p.fleeT > 0) {
        p.fleeT -= dt;
        const dx = p.pos.x - playerPos.x;
        const dz = p.pos.z - playerPos.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = p.pos.x + (dx / d) * 20;
        tz = p.pos.z + (dz / d) * 20;
        sp = 5.2;
      } else if (scared) {
        const d = Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z);
        if (d < 12) p.fleeT = 2.5;
      }
      const dx = tx - p.pos.x;
      const dz = tz - p.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5 && p.fleeT <= 0) {
        p.target = city.randomSidewalkPoint();
      } else if (dist > 0.05) {
        const nx = p.pos.x + (dx / dist) * sp * dt;
        const nz = p.pos.z + (dz / dist) * sp * dt;
        const fixed = city.collideCircle(nx, nz, 0.6);
        p.pos.x = fixed.x;
        p.pos.z = fixed.z;
        p.heading = Math.atan2(dx, dz);
        p.walkT += dt * 8;
      }
      p.mesh.rotation.y = p.heading;
      p.mesh.position.y = Math.abs(Math.sin(p.walkT)) * 0.05;
    }
  }

  function chaseAndPunch(person, dt, targetPos, range, damage, cooldown, onHit) {
    const dx = targetPos.x - person.pos.x;
    const dz = targetPos.z - person.pos.z;
    const dist = Math.hypot(dx, dz);
    if (person.attackCd > 0) person.attackCd -= dt;
    if (dist > range) {
      const sp = person === boss ? 4.6 : 3.6;
      const nx = person.pos.x + (dx / dist) * sp * dt;
      const nz = person.pos.z + (dz / dist) * sp * dt;
      const fixed = city.collideCircle(nx, nz, 0.7);
      person.pos.x = fixed.x;
      person.pos.z = fixed.z;
      person.heading = Math.atan2(dx, dz);
      person.walkT += dt * 9;
      person.mesh.position.y = Math.abs(Math.sin(person.walkT)) * 0.06;
    } else if (person.attackCd <= 0) {
      person.attackCd = cooldown;
      person.heading = Math.atan2(dx, dz);
      onHit(damage);
    }
    person.mesh.rotation.y = person.heading;
  }

  function updateThugs(dt, heroPos, onHeroHit, onThugDown) {
    for (const t of thugs) {
      if (t.down) {
        t.downT += dt;
        t.mesh.rotation.x = -Math.PI / 2;
        t.mesh.position.y = 0.35;
        continue;
      }
      const d = Math.hypot(heroPos.x - t.pos.x, heroPos.z - t.pos.z);
      if (t.isMission) {
        if (d < 26) chaseAndPunch(t, dt, heroPos, 1.9, 8, 1.0, onHeroHit);
      } else if (d < 7) {
        chaseAndPunch(t, dt, heroPos, 1.9, 8, 1.1, onHeroHit);
      } else if (d > 12) {
        // Drift back home.
        const dx = t.home.x - t.pos.x;
        const dz = t.home.z - t.pos.z;
        const hd = Math.hypot(dx, dz);
        if (hd > 1) {
          t.pos.x += (dx / hd) * 1.4 * dt;
          t.pos.z += (dz / hd) * 1.4 * dt;
          t.heading = Math.atan2(dx, dz);
          t.mesh.rotation.y = t.heading;
        }
      }
    }
    // Remove thugs that have been down for a while (mission thugs stay down).
    for (let i = thugs.length - 1; i >= 0; i -= 1) {
      const t = thugs[i];
      if (t.down && t.downT > 25 && !t.isMission) {
        scene.remove(t.mesh);
        thugs.splice(i, 1);
        const home = t.home;
        spawnThug(home.x + 2, home.z + 2, 60, false);
      }
    }
    void onThugDown;
  }

  function updateCops(dt, heroPos, onHeroHit, onBusted) {
    for (const c of cops) {
      if (c.down) continue;
      const d = Math.hypot(heroPos.x - c.pos.x, heroPos.z - c.pos.z);
      if (d < 1.7) {
        c.bustT += dt;
        if (c.bustT > 1.5) {
          onBusted();
          return;
        }
      } else {
        c.bustT = Math.max(0, c.bustT - dt);
      }
      chaseAndPunch(c, dt, heroPos, 1.9, 10, 1.1, onHeroHit);
    }
  }

  function updateBoss(dt, heroPos, onHeroHit) {
    if (!boss || boss.down) return;
    const d = Math.hypot(heroPos.x - boss.pos.x, heroPos.z - boss.pos.z);
    if (d < 22) {
      chaseAndPunch(boss, dt, heroPos, 2.4, 15, 1.2, onHeroHit);
    }
  }

  // Hero punch: hits the nearest enemy in a 2.3 m front arc. Returns the
  // victim ({kind, ref}) or null. Damage is applied here.
  function heroPunch() {
    if (hero.punchCd > 0) return null;
    hero.punchCd = 0.45;
    const fx = Math.sin(hero.heading);
    const fz = Math.cos(hero.heading);
    let best = null;
    let bd = 2.4;
    function consider(list, kind) {
      for (const p of list) {
        if (p.down) continue;
        const dx = p.pos.x - hero.pos.x;
        const dz = p.pos.z - hero.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > bd) continue;
        const dot = (dx * fx + dz * fz) / (d || 1);
        if (dot < 0.25) continue;
        bd = d;
        best = { kind, ref: p };
      }
    }
    consider(thugs, 'thug');
    consider(cops, 'cop');
    if (boss && !boss.down) consider([boss], 'boss');
    if (!best) return null;
    best.ref.hp -= 25;
    if (best.ref.hp <= 0) {
      best.ref.down = true;
      best.ref.downT = 0;
      if (best.kind === 'thug') {
        // Fall over; mission thugs stay down for the mission check.
        best.ref.mesh.rotation.x = -Math.PI / 2;
        best.ref.mesh.position.y = 0.35;
      } else if (best.kind === 'boss') {
        best.ref.mesh.rotation.x = -Math.PI / 2;
        best.ref.mesh.position.y = 0.4;
      } else {
        best.ref.mesh.rotation.x = -Math.PI / 2;
        best.ref.mesh.position.y = 0.35;
      }
    }
    return best;
  }

  function countThugsDown(isMission) {
    let n = 0;
    for (const t of thugs) if (t.down && t.isMission === isMission) n += 1;
    return n;
  }
  function countThugsAlive(isMission) {
    let n = 0;
    for (const t of thugs) if (!t.down && t.isMission === isMission) n += 1;
    return n;
  }

  return {
    hero, pedestrians, thugs, cops,
    get boss() { return boss; },
    spawnThug, spawnBoss, spawnCop,
    updateHero, updatePedestrians, updateThugs, updateCops, updateBoss,
    heroPunch, countThugsDown, countThugsAlive,
  };
}
