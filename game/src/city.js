// Solmar Bay city: an 8x8 block grid on a 44 m pitch (30 m blocks, 14 m
// roads), dusk lighting, a beach and marina to the south. Seeded (777), so
// the city is identical on every run. Builds one THREE.Group plus the data
// the engine needs: collision boxes, landmark positions, road lines, traffic
// lights and coin spots.
import { Rng } from './rng.js';

const THREE = window.THREE;

export const ROAD_LINES = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
export const BLOCK_CENTERS = [-154, -110, -66, -22, 22, 66, 110, 154];
export const CITY_BOUND = 183;

export class City {
  constructor() {
    this.rng = new Rng(777);
    this.group = new THREE.Group();
    this.colliders = [];
    this.trafficLights = [];
    this.coinSpots = [];
    this.garage = { x: 0, z: 0 };
    this.diner = { x: 0, z: 0 };
    this.tower = { x: 0, z: 0 };
    this.plaza = { x: 0, z: 0 };
    this.park = { x: 0, z: 0 };
    this.hideout = { x: 0, z: 0 };
    this.casino = { x: 0, z: 0 };
    this.beaconMat = null;
    this._buildGround();
    this._buildBlocks();
    this._buildBeach();
    this._buildLights();
    this._placeCoins();
  }

  // --- ground: one 1024 canvas texture for the whole city ---
  _buildGround() {
    const S = 1024;
    const W = 420; // world span mapped to the canvas (-210..210)
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const g = cv.getContext('2d');
    const toPx = (v) => ((v + W / 2) / W) * S;

    g.fillStyle = '#3d4a2e';
    g.fillRect(0, 0, S, S);
    // Sidewalk base over the city area.
    g.fillStyle = '#5a5f6b';
    g.fillRect(toPx(-183), toPx(-183), toPx(183) - toPx(-183), toPx(183) - toPx(-183));
    // Blocks: slightly lighter slabs.
    g.fillStyle = '#6d7280';
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        g.fillRect(toPx(bx - 15), toPx(bz - 15), toPx(15) - toPx(-15), toPx(15) - toPx(-15));
      }
    }
    // Park and plaza get their own ground.
    g.fillStyle = '#2f6b34';
    g.fillRect(toPx(-154 - 15), toPx(-154 - 15), toPx(15) - toPx(-15), toPx(15) - toPx(-15));
    g.fillStyle = '#8f8578';
    g.fillRect(toPx(154 - 15), toPx(154 - 15), toPx(15) - toPx(-15), toPx(15) - toPx(-15));
    // Roads: dark asphalt strips.
    g.fillStyle = '#262932';
    for (const c of ROAD_LINES) {
      g.fillRect(toPx(c - 7), toPx(-183), toPx(7) - toPx(-7), toPx(183) - toPx(-183));
      g.fillRect(toPx(-183), toPx(c - 7), toPx(183) - toPx(-183), toPx(7) - toPx(-7));
    }
    // Centre dashes.
    g.fillStyle = '#c9a227';
    for (const c of ROAD_LINES) {
      for (let d = -175; d < 175; d += 16) {
        g.fillRect(toPx(c - 0.4), toPx(d), toPx(0.4) - toPx(-0.4), toPx(5) - toPx(0));
        g.fillRect(toPx(d), toPx(c - 0.4), toPx(5) - toPx(0), toPx(0.4) - toPx(-0.4));
      }
    }
    // Beach sand and water to the south.
    g.fillStyle = '#c2a878';
    g.fillRect(0, toPx(183), S, toPx(196) - toPx(183));
    const grad = g.createLinearGradient(0, toPx(196), 0, S);
    grad.addColorStop(0, '#1d5f7a');
    grad.addColorStop(1, '#0d3247');
    g.fillStyle = grad;
    g.fillRect(0, toPx(196), S, S - toPx(196));

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W, W),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.group.add(ground);
  }

  _windowTexture() {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#20242e';
    g.fillRect(0, 0, 64, 128);
    const rng = new Rng(99);
    for (let y = 6; y < 122; y += 12) {
      for (let x = 6; x < 58; x += 12) {
        const lit = rng.next();
        g.fillStyle = lit < 0.45 ? '#ffd27a' : lit < 0.6 ? '#9fd8ff' : '#10131a';
        g.fillRect(x, y, 7, 8);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _box(w, h, d, color, x, y, z, opts) {
    const mat = new THREE.MeshLambertMaterial({
      color,
      emissive: (opts && opts.emissive) || 0x000000,
      emissiveIntensity: (opts && opts.emissiveIntensity) || 1,
      map: (opts && opts.map) || null,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts && opts.ry) m.rotation.y = opts.ry;
    this.group.add(m);
    return m;
  }

  _addCollider(x, z, hw, hd) {
    this.colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
  }

  // --- blocks: landmarks on fixed blocks, buildings elsewhere ---
  _buildBlocks() {
    const winTex = this._windowTexture();
    const specials = {
      '-154,-154': 'park',
      '154,154': 'plaza',
      '-22,-22': 'tower',
      '110,-110': 'casino',
      '-110,66': 'garage',
      '66,110': 'diner',
      '-154,110': 'hideout',
    };
    const palette = [0x8a7f8d, 0x7d8aa0, 0xa08a7d, 0x6d7f8a, 0x9a8a6d, 0x84748a];
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        const kind = specials[`${bx},${bz}`];
        if (kind === 'park') {
          this.park = { x: bx, z: bz };
          this._box(26, 1, 26, 0x2f6b34, bx, 0.5, bz);
          for (let i = 0; i < 6; i += 1) {
            const tx = bx + this.rng.range(-11, 11);
            const tz = bz + this.rng.range(-11, 11);
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.4, 0.5, 3, 6),
              new THREE.MeshLambertMaterial({ color: 0x5a4028 }),
            );
            trunk.position.set(tx, 1.5, tz);
            const top = new THREE.Mesh(
              new THREE.SphereGeometry(2.2, 8, 6),
              new THREE.MeshLambertMaterial({ color: 0x2a5a2e }),
            );
            top.position.set(tx, 4.2, tz);
            this.group.add(trunk, top);
          }
          continue;
        }
        if (kind === 'plaza') {
          this.plaza = { x: bx, z: bz };
          this._box(28, 0.6, 28, 0x8f8578, bx, 0.3, bz);
          const fountain = new THREE.Mesh(
            new THREE.CylinderGeometry(4, 4.5, 1.2, 12),
            new THREE.MeshLambertMaterial({ color: 0x9aa5b5 }),
          );
          fountain.position.set(bx, 0.6, bz);
          this.group.add(fountain);
          const water = new THREE.Mesh(
            new THREE.CylinderGeometry(3.4, 3.4, 0.3, 12),
            new THREE.MeshLambertMaterial({ color: 0x2f7fa8, emissive: 0x0d3247 }),
          );
          water.position.set(bx, 1.3, bz);
          this.group.add(water);
          this._addCollider(bx, bz, 4.5, 4.5);
          continue;
        }
        if (kind === 'tower') {
          this.tower = { x: bx, z: bz };
          const tower = this._box(16, 92, 16, 0x3a3f4d, bx, 46, bz, { map: winTex });
          tower.material = new THREE.MeshLambertMaterial({ color: 0x9aa5c0, map: winTex });
          this.beaconMat = new THREE.MeshLambertMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2 });
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), this.beaconMat);
          beacon.position.set(bx, 93.5, bz);
          this.group.add(beacon);
          this._addCollider(bx, bz, 8.5, 8.5);
          continue;
        }
        if (kind === 'casino') {
          this.casino = { x: bx, z: bz };
          this._box(24, 18, 20, 0x5a2a4a, bx, 9, bz, { map: winTex });
          this._box(26, 2, 22, 0x2a0a22, bx, 19, bz, { emissive: 0xff2fb3, emissiveIntensity: 0.9 });
          this._addCollider(bx, bz, 12.5, 11);
          continue;
        }
        if (kind === 'garage') {
          this.garage = { x: bx, z: bz };
          this._box(22, 8, 16, 0x4a3a28, bx, 4, bz);
          this._box(23, 1.5, 17, 0x2a2016, bx, 8.5, bz, { emissive: 0xffaa22, emissiveIntensity: 0.7 });
          this._addCollider(bx, bz, 11.5, 8.5);
          continue;
        }
        if (kind === 'diner') {
          this.diner = { x: bx, z: bz };
          this._box(20, 7, 14, 0x7a4a3a, bx, 3.5, bz);
          this._box(21, 1.2, 15, 0x3a1a12, bx, 7.5, bz, { emissive: 0xff5533, emissiveIntensity: 0.8 });
          this._addCollider(bx, bz, 10.5, 7.5);
          continue;
        }
        if (kind === 'hideout') {
          this.hideout = { x: bx, z: bz };
          this._box(18, 6, 14, 0x2e4a3a, bx, 3, bz);
          this._addCollider(bx, bz, 9.5, 7.5);
          continue;
        }
        // Ordinary block: 1-3 buildings.
        const n = this.rng.int(1, 3);
        for (let i = 0; i < n; i += 1) {
          const w = this.rng.range(8, 14);
          const d = this.rng.range(8, 14);
          const h = this.rng.range(8, 34);
          const ox = this.rng.range(-7, 7);
          const oz = this.rng.range(-7, 7);
          const color = this.rng.pick(palette);
          this._box(w, h, d, color, bx + ox, h / 2, bz + oz, { map: winTex });
          this._addCollider(bx + ox, bz + oz, w / 2 + 0.3, d / 2 + 0.3);
        }
      }
    }
  }

  // --- beach, marina and boats to the south ---
  _buildBeach() {
    const rng = new Rng(31);
    for (let i = 0; i < 5; i += 1) {
      const x = -140 + i * 70 + rng.range(-8, 8);
      const z = 200 + rng.range(-3, 6);
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(7, 1.6, 2.6),
        new THREE.MeshLambertMaterial({ color: 0xe8e4da }),
      );
      hull.position.set(x, 0.4, z);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
      );
      mast.position.set(x, 3.4, z);
      const sail = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 4),
        new THREE.MeshLambertMaterial({ color: 0xf2ead8, side: THREE.DoubleSide }),
      );
      sail.position.set(x + 1.2, 3.6, z);
      this.group.add(hull, mast, sail);
    }
    // Boardwalk along the sand.
    this._box(340, 0.8, 4, 0x7a5a38, 0, 0.4, 186);
  }

  // --- streetlights and traffic lights ---
  _buildLights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d34 });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x333300, emissive: 0xffd27a, emissiveIntensity: 1.6 });
    for (const x of [-88, 0, 88]) {
      for (const z of [-88, 0, 88]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
        pole.position.set(x + 8, 3.5, z + 8);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
        lamp.position.set(x + 8, 7.2, z + 8);
        this.group.add(pole, lamp);
      }
    }
    // Traffic lights at four central intersections; the engine cycles them.
    for (const [x, z] of [[-44, -44], [44, -44], [-44, 44], [44, 44]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), poleMat);
      pole.position.set(x + 7.5, 2.5, z + 7.5);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), poleMat);
      housing.position.set(x + 7.5, 5.6, z + 7.5);
      const redMat = new THREE.MeshLambertMaterial({ color: 0x220000, emissive: 0xff2222, emissiveIntensity: 1.5 });
      const greenMat = new THREE.MeshLambertMaterial({ color: 0x002200, emissive: 0x22ff44, emissiveIntensity: 0.4 });
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), redMat);
      red.position.set(x + 7.5, 6.2, z + 8.0);
      const green = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), greenMat);
      green.position.set(x + 7.5, 5.2, z + 8.0);
      this.group.add(pole, housing, red, green);
      this.trafficLights.push({ x, z, redMat, greenMat, nsGreen: true });
    }
  }

  _placeCoins() {
    const rng = new Rng(4242);
    const spots = [
      { x: this.plaza.x, z: this.plaza.z + 10 },
      { x: this.plaza.x - 10, z: this.plaza.z },
      { x: this.park.x, z: this.park.z },
      { x: 0, z: -88 },
      { x: 44, z: 0 },
      { x: -88, z: 44 },
      { x: 88, z: -44 },
      { x: -44, z: -132 },
      { x: 132, z: 88 },
      { x: -132, z: 132 },
      { x: 22, z: 176 },
      { x: -176, z: 22 },
    ];
    for (const s of spots) {
      this.coinSpots.push({ x: s.x + rng.range(-2, 2), z: s.z + rng.range(-2, 2) });
    }
  }

  // Circle (x, z, radius r) vs building boxes. Returns the push-out vector
  // or null when free. Used by the hero and by cars.
  collide(x, z, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        return { x: (dx / d) * (r - d), z: (dz / d) * (r - d) };
      }
    }
    return null;
  }

  inside(x, z) {
    return x > -CITY_BOUND && x < CITY_BOUND && z > -CITY_BOUND && z < 196;
  }
}
