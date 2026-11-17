// People: pedestrians who stroll and flee, thugs who fight, and the boss.
// Meshes are simple built-up figures (body, head, limbs) so the game needs
// no model files.
import { Rng } from './rng.js';

const THREE = window.THREE;

const SHIRTS = [0xd85a5a, 0x5a8ad8, 0x5ad88a, 0xd8c25a, 0x9a5ad8, 0xd8d8d8, 0x5ad8c2, 0xe07a2a];
const SKINS = [0xd8a878, 0xb98a5a, 0x8a5a3a, 0xe8c8a8];

export function makePersonMesh(shirt, opts = {}) {
  const group = new THREE.Group();
  const scale = opts.scale || 1;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.95, 0.36),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 10, 8),
    new THREE.MeshLambertMaterial({ color: opts.skin || 0xd8a878 }),
  );
  head.position.y = 1.68;
  group.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: opts.pants || 0x2a2a33 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), legMat);
  legL.position.set(-0.16, 0.38, 0);
  legL.name = 'legL';
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), legMat);
  legR.position.set(0.16, 0.38, 0);
  legR.name = 'legR';
  group.add(legR);
  const armMat = new THREE.MeshLambertMaterial({ color: shirt });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.22), armMat);
  armL.position.set(-0.42, 1.0, 0);
  armL.name = 'armL';
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.22), armMat);
  armR.position.set(0.42, 1.0, 0);
  armR.name = 'armR';
  group.add(armR);
  group.scale.setScalar(scale);
  return group;
}

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(4242);
    this.list = [];
    for (let i = 0; i < 22; i += 1) {
      const mesh = makePersonMesh(this.rng.pick(SHIRTS), { skin: this.rng.pick(SKINS) });
      const x = this.rng.range(-165, 165);
      const z = this.rng.range(-165, 165);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.list.push({
        mesh,
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.0, 1.8),
        state: 'walk',
        fleeT: 0,
        walkT: this.rng.range(2, 8),
        bob: this.rng.range(0, 6),
      });
    }
  }

  scare(fromPos, radius) {
    for (const p of this.list) {
      const dx = p.mesh.position.x - fromPos.x;
      const dz = p.mesh.position.z - fromPos.z;
      if (Math.hypot(dx, dz) < radius) {
        p.state = 'flee';
        p.fleeT = 3;
      }
    }
  }

  update(dt, time) {
    for (const p of this.list) {
      const m = p.mesh;
      if (p.state === 'flee') {
        p.fleeT -= dt;
        p.speed = 4.2;
        if (p.fleeT <= 0) p.state = 'walk';
      } else {
        p.speed = 1.4;
        p.walkT -= dt;
        if (p.walkT <= 0) {
          p.walkT = this.rng.range(3, 9);
          p.heading += this.rng.range(-1.2, 1.2);
        }
      }
      m.position.x += Math.sin(p.heading) * p.speed * dt;
      m.position.z += Math.cos(p.heading) * p.speed * dt;
      // Stay inside the city and out of the sea.
      if (m.position.x > 172 || m.position.x < -172) p.heading = -p.heading;
      if (m.position.z > 172) { p.heading = Math.PI; m.position.z = 172; }
      if (m.position.z < -172) { p.heading = 0; m.position.z = -172; }
      m.rotation.y = p.heading;
      p.bob += dt * (p.state === 'flee' ? 11 : 6);
      const swing = Math.sin(p.bob) * 0.45;
      const legL = m.getObjectByName('legL');
      const legR = m.getObjectByName('legR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    }
  }
}

export class Thugs {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(x, z, opts = {}) {
    const isBoss = !!opts.boss;
    const mesh = makePersonMesh(
      isBoss ? 0x1a1a1a : 0x3a3a4a,
      { scale: isBoss ? 1.25 : 1.05, skin: 0xc89878, pants: 0x1a1a22 },
    );
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const thug = {
      mesh,
      hp: isBoss ? 300 : 100,
      maxHp: isBoss ? 300 : 100,
      boss: isBoss,
      name: opts.name || (isBoss ? 'Vic Marino' : 'Thug'),
      state: 'idle',
      attackCd: 0,
      down: false,
      bob: 0,
    };
    this.list.push(thug);
    return thug;
  }

  clear() {
    for (const t of this.list) this.scene.remove(t.mesh);
    this.list = [];
  }

  alive() {
    return this.list.filter((t) => !t.down);
  }

  // Chase and punch the hero when close; return damage dealt this frame.
  update(dt, heroPos, onHitHero) {
    for (const t of this.list) {
      if (t.down) continue;
      const m = t.mesh;
      const dx = heroPos.x - m.position.x;
      const dz = heroPos.z - m.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      t.attackCd -= dt;
      if (dist < 22) {
        t.state = 'chase';
        const speed = t.boss ? 5.0 : 4.4;
        if (dist > 2.1) {
          m.position.x += (dx / dist) * speed * dt;
          m.position.z += (dz / dist) * speed * dt;
          m.rotation.y = Math.atan2(dx, dz);
          t.bob += dt * 9;
          const swing = Math.sin(t.bob) * 0.5;
          const legL = m.getObjectByName('legL');
          const legR = m.getObjectByName('legR');
          if (legL) legL.rotation.x = swing;
          if (legR) legR.rotation.x = -swing;
        } else if (t.attackCd <= 0) {
          t.attackCd = 0.95;
          const armR = m.getObjectByName('armR');
          if (armR) armR.rotation.x = -1.4;
          setTimeout(() => { if (armR) armR.rotation.x = 0; }, 180);
          onHitHero(t.boss ? 14 : 8, t);
        }
      } else {
        t.state = 'idle';
      }
    }
  }

  // Hero punch: damage every living thug within range and in front.
  punchFrom(pos, heading, range, damage) {
    let hits = 0;
    for (const t of this.list) {
      if (t.down) continue;
      const dx = t.mesh.position.x - pos.x;
      const dz = t.mesh.position.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range) continue;
      const ang = Math.atan2(dx, dz);
      let da = ang - heading;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > 1.1 && dist > 1.2) continue;
      t.hp -= damage;
      hits += 1;
      t.mesh.position.x += (dx / (dist || 1)) * 0.6;
      t.mesh.position.z += (dz / (dist || 1)) * 0.6;
      if (t.hp <= 0) {
        t.down = true;
        t.mesh.rotation.x = -Math.PI / 2;
        t.mesh.position.y = 0.4;
      }
    }
    return hits;
  }
}
