// People for Solmar Bay: pedestrians who wander the sidewalks and flee
// from danger, the hero figure, thugs who fight back, and the boss Vic
// Marino. Meshes are simple box-built figures, cheap under the software
// renderer.
import { Rng } from './rng.js';
import { ROAD_LINES } from './city.js';

const THREE = window.THREE;

const SHIRT_COLORS = [0xd8b040, 0x4a80c0, 0xc05050, 0x50a060, 0xd8d8d8, 0x8a5aa0, 0x40a0a0];

function buildFigure(shirt, pants, scale) {
  const g = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), legMat);
  legL.position.set(-0.14, 0.4, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), legMat);
  legR.position.set(0.14, 0.4, 0);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.75, 0.34),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  torso.position.y = 1.2;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8a077 }),
  );
  head.position.y = 1.82;
  const armMat = new THREE.MeshLambertMaterial({ color: shirt });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), armMat);
  armL.position.set(-0.42, 1.2, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), armMat);
  armR.position.set(0.42, 1.2, 0);
  g.add(legL, legR, torso, head, armL, armR);
  g.scale.setScalar(scale || 1);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class People {
  constructor(city) {
    this.city = city;
    this.rng = new Rng(7777);
    this.group = new THREE.Group();
    this.peds = [];
    this.thugs = [];
    this.boss = null;
    this.heroMesh = buildFigure(0x2a9a8a, 0x222831, 1);
    this.group.add(this.heroMesh);
    this._buildPeds();
  }

  _buildPeds() {
    for (let i = 0; i < 22; i += 1) {
      const mesh = buildFigure(this.rng.pick(SHIRT_COLORS), 0x333a44, 0.95 + this.rng.range(-0.05, 0.08));
      const line = this.rng.pick(ROAD_LINES);
      const along = this.rng.range(-170, 170);
      const vertical = this.rng.chance(0.5);
      const x = vertical ? line + (this.rng.chance(0.5) ? 8.5 : -8.5) : along;
      const z = vertical ? along : line + (this.rng.chance(0.5) ? 8.5 : -8.5);
      mesh.position.set(x, 0, z);
      this.group.add(mesh);
      this.peds.push({
        mesh, x, z,
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.2, 2.2),
        state: 'walk',
        tx: x, tz: z,
        walkPhase: this.rng.range(0, 6),
      });
    }
  }

  // Pedestrians wander the sidewalks; they flee when the hero or a car
  // gets close, and calm down once it is far away.
  updatePeds(dt, heroX, heroZ, threat) {
    for (const p of this.peds) {
      const dx = p.x - heroX;
      const dz = p.z - heroZ;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 9 && threat) {
        p.state = 'flee';
        p.tx = p.x + (dx / (d || 1)) * 30;
        p.tz = p.z + (dz / (d || 1)) * 30;
      } else if (p.state === 'flee' && d > 25) {
        p.state = 'walk';
      }
      const speed = p.state === 'flee' ? 5.5 : p.speed;
      const tdx = p.tx - p.x;
      const tdz = p.tz - p.z;
      const td = Math.sqrt(tdx * tdx + tdz * tdz);
      if (td < 2) {
        // New waypoint on a nearby sidewalk.
        const line = this.rng.pick(ROAD_LINES);
        const along = this.rng.range(-170, 170);
        const vertical = this.rng.chance(0.5);
        p.tx = vertical ? line + 8.5 : along;
        p.tz = vertical ? along : line + 8.5;
        continue;
      }
      const wantH = Math.atan2(tdx, tdz);
      let dh = wantH - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      const hit = this.city.collide(p.x, p.z, 0.5);
      if (hit) { p.x += hit.x; p.z += hit.z; }
      p.x = Math.max(-180, Math.min(180, p.x));
      p.z = Math.max(-180, Math.min(194, p.z));
      p.walkPhase += speed * dt * 3;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
    }
  }

  spawnThugs(x, z, n) {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const mesh = buildFigure(0x3a3a3a, 0x1a1a1a, 1.08);
      const tx = x + this.rng.range(-6, 6);
      const tz = z + this.rng.range(-6, 6);
      mesh.position.set(tx, 0, tz);
      this.group.add(mesh);
      const thug = { mesh, x: tx, z: tz, heading: 0, hp: 60, attackCooldown: 0, speed: 3.4, walkPhase: 0, alive: true };
      this.thugs.push(thug);
      out.push(thug);
    }
    return out;
  }

  spawnBoss(x, z) {
    const mesh = buildFigure(0x8a1a1a, 0x141414, 1.35);
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    this.boss = { mesh, x, z, heading: 0, hp: 300, attackCooldown: 0, speed: 3.0, walkPhase: 0, alive: true, isBoss: true };
    return this.boss;
  }

  // Thugs chase the hero and punch in range. onHit(dmg, fromBoss) applies
  // the damage. Dead thugs fall over and stop.
  updateThugs(dt, hero, onHit) {
    const all = this.boss && this.boss.alive ? this.thugs.concat([this.boss]) : this.thugs;
    for (const t of all) {
      if (!t.alive) continue;
      t.attackCooldown = Math.max(0, t.attackCooldown - dt);
      const dx = hero.x - t.x;
      const dz = hero.z - t.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 30) continue;
      const wantH = Math.atan2(dx, dz);
      let dh = wantH - t.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      t.heading += Math.max(-3.5 * dt, Math.min(3.5 * dt, dh));
      if (d > 2.1) {
        t.x += Math.sin(t.heading) * t.speed * dt;
        t.z += Math.cos(t.heading) * t.speed * dt;
        const hit = this.city.collide(t.x, t.z, 0.5);
        if (hit) { t.x += hit.x; t.z += hit.z; }
        t.walkPhase += t.speed * dt * 3;
      } else if (t.attackCooldown <= 0) {
        t.attackCooldown = 1.15;
        if (onHit) onHit(t.isBoss ? 10 : 6, t.isBoss);
      }
      const swing = Math.sin(t.walkPhase) * 0.45;
      t.mesh.userData.legL.rotation.x = swing;
      t.mesh.userData.legR.rotation.x = -swing;
      t.mesh.position.set(t.x, 0, t.z);
      t.mesh.rotation.y = t.heading;
    }
  }

  killThug(t) {
    t.alive = false;
    t.mesh.rotation.x = -Math.PI / 2;
    t.mesh.position.y = 0.3;
  }
}
