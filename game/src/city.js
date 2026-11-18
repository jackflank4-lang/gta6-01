// city.js — Solmar Bay: an 8x8-block dusk city on the bay.
// Grid: 30 m blocks, 14 m roads, 44 m pitch. Roads are centred on
// multiples of 44; block centres sit at -154, -110, -66, -22, 22, 66,
// 110, 154. Landmarks sit on fixed blocks so missions can point at
// them: Rosa's Garage (-110,-110), Luna Casino (110,-110), the plaza
// (22,22), Meridian Tower (22,-22), Pelican Diner (-66,66), the
// Barracuda hideout (66,154) and the beach / marina south of z=176.
import { makeRng } from './rng.js';

export const PITCH = 44;
export const WORLD_MIN = -200;
export const WORLD_MAX = 240;

const BLOCK_CENTERS = [-154, -110, -66, -22, 22, 66, 110, 154];
const ROAD_CENTERS = [-176, -132, -88, -44, 0, 44, 88, 132, 176];

function makeSignTexture(text, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fg;
  g.shadowBlur = 22;
  g.fillStyle = fg;
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWindowTexture(litRatio) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#101018';
  g.fillRect(0, 0, 64, 128);
  const rng = makeRng(1234);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? (rng.next() < 0.7 ? '#ffd27a' : '#9ad7ff') : '#1c1c28';
      g.fillRect(x, y, 7, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(777);
    this.colliders = []; // {minX,maxX,minZ,maxZ}
    this.coins = []; // {pos: Vector3, mesh, taken}
    this.landmarks = {};
    this._buildLights();
    this._buildGround();
    this._buildBlocks();
    this._buildMarina();
    this._buildCoins();
    this._buildStars();
  }

  _buildLights() {
    const s = this.scene;
    s.background = new THREE.Color(0x241533);
    s.fog = new THREE.Fog(0x241533, 120, 420);
    const hemi = new THREE.HemisphereLight(0x8a6fd6, 0x1a1420, 0.75);
    s.add(hemi);
    const sun = new THREE.DirectionalLight(0xff9a5c, 1.1);
    sun.position.set(-120, 180, 120);
    s.add(sun);
    const amb = new THREE.AmbientLight(0x403060, 0.5);
    s.add(amb);
    // A few warm point lights at the hot spots; SwiftShader hates dozens.
    for (const [x, z, color] of [[22, 22, 0xffd27a], [110, -110, 0xff4fd8], [-110, -110, 0x7ae0ff], [22, -22, 0x9ad7ff]]) {
      const p = new THREE.PointLight(color, 900, 90, 1.8);
      p.position.set(x, 14, z);
      s.add(p);
    }
  }

  _buildGround() {
    const s = this.scene;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshLambertMaterial({ color: 0x23202e }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 20);
    s.add(ground);
    // Sidewalk slabs on every block footprint.
    const slabMat = new THREE.MeshLambertMaterial({ color: 0x3a3444 });
    const slabGeo = new THREE.BoxGeometry(30, 0.3, 30);
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(bx, 0.1, bz);
        s.add(slab);
      }
    }
    // Road centre dashes (yellow) along every road.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xc9a227 });
    const dashGeo = new THREE.BoxGeometry(0.6, 0.06, 4);
    for (const r of ROAD_CENTERS) {
      for (let t = -176; t <= 176; t += 12) {
        const d1 = new THREE.Mesh(dashGeo, dashMat);
        d1.position.set(r, 0.05, t);
        s.add(d1);
        const d2 = new THREE.Mesh(dashGeo, dashMat);
        d2.rotation.y = Math.PI / 2;
        d2.position.set(t, 0.05, r);
        s.add(d2);
      }
    }
    // Crosswalk stripes at the four central intersections.
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
    for (const [cx, cz] of [[0, 0], [44, 0], [0, 44], [44, 44], [-44, 0], [0, -44]]) {
      for (let i = -2; i <= 2; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 6), crossMat);
        stripe.position.set(cx + i * 2.6, 0.05, cz + 8.5);
        s.add(stripe);
      }
    }
  }

  _addBox(x, z, w, h, d, mat, y0 = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y0 + h / 2, z);
    this.scene.add(m);
    return m;
  }

  _addCollider(x, z, w, d) {
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  _palm(x, z, scale = 1) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * scale, 0.4 * scale, 7 * scale, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    );
    trunk.position.set(x, 3.5 * scale, z);
    this.scene.add(trunk);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 3.4 * scale, 4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.2 * scale, 7.2 * scale, z + Math.sin(a) * 1.2 * scale);
      leaf.rotation.z = Math.cos(a) * 0.9;
      leaf.rotation.x = -Math.sin(a) * 0.9;
      this.scene.add(leaf);
    }
  }

  _sign(x, y, z, text, fg, bg, w = 22) {
    const tex = makeSignTexture(text, fg, bg);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    m.position.set(x, y, z);
    this.scene.add(m);
    return m;
  }

  _buildBlocks() {
    const s = this.scene;
    const rng = this.rng;
    const winA = makeWindowTexture(0.45);
    const winB = makeWindowTexture(0.3);
    const winC = makeWindowTexture(0.6);
    const winTex = [winA, winB, winC];
    const palette = [0x2b3a5c, 0x4a2b3a, 0x2e4a3a, 0x5c4a2b, 0x3a2b5c, 0x37424e];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    const landmarkAt = (bx, bz) => {
      if (bx === -110 && bz === -110) return 'garage';
      if (bx === 110 && bz === -110) return 'casino';
      if (bx === 22 && bz === 22) return 'plaza';
      if (bx === 22 && bz === -22) return 'tower';
      if (bx === -66 && bz === 66) return 'diner';
      if (bx === 66 && bz === 154) return 'hideout';
      if (bx === -22 && bz === -66) return 'park';
      return null;
    };

    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        const kind = landmarkAt(bx, bz);
        if (kind === 'garage') { this._buildGarage(bx, bz); continue; }
        if (kind === 'casino') { this._buildCasino(bx, bz); continue; }
        if (kind === 'plaza') { this._buildPlaza(bx, bz); continue; }
        if (kind === 'tower') { this._buildTower(bx, bz); continue; }
        if (kind === 'diner') { this._buildDiner(bx, bz); continue; }
        if (kind === 'hideout') { this._buildHideout(bx, bz); continue; }
        if (kind === 'park') { this._buildPark(bx, bz); continue; }
        // Ordinary block: 1-3 buildings or a parking lot.
        if (rng.chance(0.22)) {
          // Parking lot: flat, a couple of palms, no colliders.
          this._palm(bx - 10, bz - 10);
          this._palm(bx + 11, bz + 10);
          continue;
        }
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          const w = rng.range(9, 15);
          const d = rng.range(9, 15);
          const h = rng.range(8, 42);
          const ox = (i % 2 === 0 ? -1 : 1) * rng.range(2, 6);
          const oz = (i === 0 ? -1 : 1) * rng.range(2, 6);
          const x = bx + ox;
          const z = bz + oz;
          const mat = new THREE.MeshLambertMaterial({
            color: rng.pick(palette),
            map: winTex[rng.int(0, 2)],
            emissive: 0x222233,
          });
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d);
          b.position.set(x, h / 2, z);
          s.add(b);
          // Neon roof trim.
          const trim = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4),
            new THREE.MeshBasicMaterial({ color: rng.pick([0xff4fd8, 0x35e0ff, 0xffd27a, 0x7aff9a]) }),
          );
          trim.position.set(x, h + 0.2, z);
          s.add(trim);
          this._addCollider(x, z, w, d);
        }
        if (rng.chance(0.5)) this._palm(bx + rng.range(-12, 12), bz + rng.range(-12, 12), rng.range(0.8, 1.2));
      }
    }
  }

  _buildGarage(bx, bz) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e, emissive: 0x1a0f05 });
    this._addBox(bx, bz - 6, 26, 9, 14, mat);
    this._addCollider(bx, bz - 6, 26, 14);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(16, 6, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2a2a33 }),
    );
    door.position.set(bx, 3, bz + 1.2);
    this.scene.add(door);
    const sign = this._sign(bx, 11.5, bz + 1.4, "ROSA'S GARAGE", '#7ae0ff', '#141020', 26);
    sign.position.z = bz + 1.4;
    this.landmarks.garage = { x: bx, z: bz, radius: 20 };
    this._palm(bx - 13, bz + 10);
    this._palm(bx + 13, bz + 10);
  }

  _buildCasino(bx, bz) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a1e4a, map: makeWindowTexture(0.6), emissive: 0x2a1030 });
    this._addBox(bx, bz, 28, 16, 24, mat);
    this._addCollider(bx, bz, 28, 24);
    const sign = this._sign(bx, 19, bz + 12.4, 'LUNA CASINO', '#ff4fd8', '#1a0a20', 28);
    sign.position.z = bz + 12.4;
    // Neon forecourt ring.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(10, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xff4fd8 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bx, 0.4, bz + 20);
    this.scene.add(ring);
    this.landmarks.casino = { x: bx, z: bz, radius: 25 };
  }

  _buildPlaza(bx, bz) {
    // Open plaza: fountain, benches, palms. No colliders except fountain.
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5.5, 1, 20),
      new THREE.MeshLambertMaterial({ color: 0x8a8a9a }),
    );
    basin.position.set(bx, 0.5, bz);
    this.scene.add(basin);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.4, 0.4, 20),
      new THREE.MeshLambertMaterial({ color: 0x35b8e0, emissive: 0x0a4a66 }),
    );
    water.position.set(bx, 1.1, bz);
    this.scene.add(water);
    this._addCollider(bx, bz, 10, 10);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      this._palm(bx + Math.cos(a) * 12, bz + Math.sin(a) * 12, 1.1);
      const bench = this._addBox(bx + Math.cos(a) * 9, bz + Math.sin(a) * 9, 3, 0.6, 1,
        new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
      bench.rotation.y = -a;
    }
    this.landmarks.plaza = { x: bx, z: bz, radius: 14 };
  }

  _buildTower(bx, bz) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x1e2a4a, map: makeWindowTexture(0.55), emissive: 0x111122 });
    this._addBox(bx, bz, 20, 92, 20, mat);
    this._addCollider(bx, bz, 20, 20);
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(22, 2, 22),
      new THREE.MeshBasicMaterial({ color: 0x35e0ff }),
    );
    crown.position.set(bx, 93, bz);
    this.scene.add(crown);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4040 }),
    );
    beacon.position.set(bx, 96, bz);
    this.scene.add(beacon);
    this._beacon = beacon;
    const sign = this._sign(bx, 60, bz + 10.4, 'MERIDIAN', '#9ad7ff', '#0a1020', 20);
    sign.position.z = bz + 10.4;
    this.landmarks.tower = { x: bx, z: bz, radius: 18 };
    this.landmarks.bossArena = { x: 22, z: 0, radius: 16 };
  }

  _buildDiner(bx, bz) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x7a2e2e, emissive: 0x220505 });
    this._addBox(bx, bz, 18, 7, 12, mat);
    this._addCollider(bx, bz, 18, 12);
    this._sign(bx, 9.5, bz + 6.4, 'PELICAN DINER', '#ffd27a', '#200a0a', 18);
    this._palm(bx - 11, bz + 8);
    this.landmarks.diner = { x: bx, z: bz, radius: 12 };
  }

  _buildHideout(bx, bz) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a3a2a, emissive: 0x0a1a0a });
    this._addBox(bx, bz, 14, 6, 10, mat);
    this._addCollider(bx, bz, 14, 10);
    this._sign(bx, 8, bz + 5.4, 'BARRACUDA', '#7aff9a', '#061206', 14);
    this.landmarks.hideout = { x: bx, z: bz, radius: 12 };
  }

  _buildPark(bx, bz) {
    const grass = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.4, 28),
      new THREE.MeshLambertMaterial({ color: 0x1e5c2e }),
    );
    grass.position.set(bx, 0.2, bz);
    this.scene.add(grass);
    const rng = makeRng(42);
    for (let i = 0; i < 8; i++) {
      this._palm(bx + rng.range(-12, 12), bz + rng.range(-12, 12), rng.range(0.9, 1.3));
    }
    const pond = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 0.5, 16),
      new THREE.MeshLambertMaterial({ color: 0x2a7ab8, emissive: 0x0a2a4a }),
    );
    pond.position.set(bx + 6, 0.5, bz - 4);
    this.scene.add(pond);
    this.landmarks.park = { x: bx, z: bz, radius: 14 };
  }

  _buildMarina() {
    const s = this.scene;
    // Sand strip, then the bay.
    const sand = new THREE.Mesh(
      new THREE.BoxGeometry(440, 0.4, 16),
      new THREE.MeshLambertMaterial({ color: 0xc9b27a }),
    );
    sand.position.set(0, 0.15, 184);
    s.add(sand);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 220),
      new THREE.MeshLambertMaterial({ color: 0x144a7a, emissive: 0x061a33 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0, 300);
    s.add(water);
    // Boardwalk + a few boats.
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(120, 0.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    );
    walk.position.set(120, 0.4, 196);
    s.add(walk);
    const rng = makeRng(99);
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 32;
      const z = 215 + rng.range(-4, 4);
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(10, 2, 4),
        new THREE.MeshLambertMaterial({ color: rng.pick([0xe8e8e8, 0xff6b4a, 0x35e0ff]) }),
      );
      hull.position.set(x, 1, z);
      hull.rotation.y = rng.range(-0.2, 0.2);
      s.add(hull);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x8a8a8a }),
      );
      mast.position.set(x, 5, z);
      s.add(mast);
    }
    // Street lamps along the main boulevards.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const r of [-88, 0, 88]) {
      for (let t = -176; t <= 176; t += 44) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), poleMat);
        pole.position.set(r + 6.5, 4, t);
        s.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
        lamp.position.set(r + 6.5, 8.2, t);
        s.add(lamp);
      }
    }
  }

  _buildCoins() {
    const spots = [
      [0, 66], [44, -44], [-44, 44], [88, 0], [-88, -44], [132, 44],
      [-132, 88], [44, 132], [-44, -132], [176, -88], [-176, 22], [22, -88],
    ];
    const geo = new THREE.TorusGeometry(0.9, 0.32, 8, 18);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
    for (const [x, z] of spots) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 1.6, z);
      this.scene.add(mesh);
      this.coins.push({ pos: new THREE.Vector3(x, 1.6, z), mesh, taken: false });
    }
  }

  _buildStars() {
    const rng = makeRng(7);
    const pts = [];
    for (let i = 0; i < 400; i++) {
      const a = rng.range(0, Math.PI * 2);
      const e = rng.range(0.15, 1.2);
      const r = 500;
      pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6 }));
    this.scene.add(stars);
  }

  // Circle (x,z,r) vs every building AABB. Returns the first hit or null.
  collideCircle(x, z, r) {
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return c;
    }
    return null;
  }

  // Push a circle out of any collider it overlaps (single pass, good
  // enough for walking and low-speed driving).
  resolveCircle(pos, r) {
    const c = this.collideCircle(pos.x, pos.z, r);
    if (!c) return false;
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    let dx = pos.x - cx;
    let dz = pos.z - cz;
    let d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.001) {
      // Centre inside the box: push out along the smallest penetration.
      const pl = pos.x - c.minX, pr = c.maxX - pos.x;
      const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) pos.x = c.minX - r;
      else if (m === pr) pos.x = c.maxX + r;
      else if (m === pt) pos.z = c.minZ - r;
      else pos.z = c.maxZ + r;
      return true;
    }
    dx /= d; dz /= d;
    pos.x = cx + dx * r;
    pos.z = cz + dz * r;
    return true;
  }

  update(dt, time) {
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2.4;
      c.mesh.position.y = 1.6 + Math.sin(time * 2 + c.pos.x) * 0.25;
    }
    if (this._beacon) {
      this._beacon.material.color.setHex(Math.sin(time * 4) > 0 ? 0xff4040 : 0x661111);
    }
  }
}
