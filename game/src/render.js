// three.js scene for Solmar Bay: ground, buildings, props, vehicles, people,
// camera follow, and the 2D minimap. No external assets — textures are canvas-made.
// Rebuild r2: three camera modes (follow / shoulder / high), a dusk sky that
// shifts with play time, traffic lights, neon billboards, a boardwalk,
// a helipad on Kingfish Tower, spinning coin pickups and damage smoke.
(function () {
  'use strict';
  window.SB = window.SB || {};
  const CFG = SB.CFG;

  const CAMERA_MODES = ['FOLLOW', 'SHOULDER', 'HIGH'];

  const Render = {
    scene: null, camera: null, renderer: null, canvas: null,
    city: null, facadeCache: {},
    playerMesh: null, carMeshes: new Map(), pedMeshes: new Map(),
    markerMesh: null, markerRing: null, beaconLight: null,
    camYaw: 0, camPitch: 0.30, camDist: 22, camZoom: 0, camOrbit: 0,
    cameraMode: 0,
    tracer: null, muzzle: null,
    trafficLights: [], coinMeshes: [], smokePuffs: [],
    sunLight: null, hemiLight: null,

    init: function (canvas, city) {
      this.canvas = canvas;
      this.city = city;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(SB.PALETTE.sky);
      this.scene.fog = new THREE.Fog(SB.PALETTE.fog, 180, 620);
      this.camera = new THREE.PerspectiveCamera(58, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.5, 1200);
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.resize();

      // Lighting: warm afternoon sun + sky bounce (dusk shifts these per frame).
      this.hemiLight = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.95);
      this.scene.add(this.hemiLight);
      this.sunLight = new THREE.DirectionalLight(0xffe6b0, 1.5);
      this.sunLight.position.set(180, 260, 120);
      this.scene.add(this.sunLight);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.18));

      this.buildGround(city);
      this.buildBuildings(city);
      this.buildProps(city);
      this.buildTrafficLights(city);
      this.buildBillboards(city);
      this.buildPier(city);
      this.buildMarker();
      this.buildPlayer();
      this.tracer = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 1),
        new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9 }));
      this.tracer.visible = false;
      this.scene.add(this.tracer);
      window.addEventListener('resize', () => this.resize());
    },
    resize: function () {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    },
    buildGround: function (city) {
      const tex = SB.makeGroundTexture(city);
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(800, 800),
        new THREE.MeshLambertMaterial({ map: tex }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, 0, 0);
      this.scene.add(ground);
      // Water plane south of the beach.
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(800, 120),
        new THREE.MeshLambertMaterial({ color: SB.PALETTE.water }));
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, 0.05, city.beachZ + 34 + 60);
      this.scene.add(water);
      // Boardwalk planks along the sand.
      const walk = new THREE.Mesh(
        new THREE.BoxGeometry(700, 0.4, 8),
        new THREE.MeshLambertMaterial({ color: 0x7a5a38 }));
      walk.position.set(0, 0.2, city.beachZ - 2);
      this.scene.add(walk);
    },
    facade: function (color) {
      if (!this.facadeCache[color]) this.facadeCache[color] = SB.makeFacadeTexture(color, 0.35);
      return this.facadeCache[color];
    },
    buildBuildings: function (city) {
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      for (const b of city.buildings) {
        const mat = new THREE.MeshLambertMaterial({ map: this.facade(b.color) });
        const m = new THREE.Mesh(boxGeo, mat);
        m.scale.set(b.w, b.h, b.d);
        m.position.set(b.x, b.h / 2, b.z);
        this.scene.add(m);
        // roof slab
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: b.roof }));
        roof.scale.set(b.w + 0.6, 0.5, b.d + 0.6);
        roof.position.set(b.x, b.h + 0.25, b.z);
        this.scene.add(roof);
        if (b.name) {
          // rooftop sign: a small glowing box so landmarks read from afar
          const sign = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffe14d }));
          sign.scale.set(Math.min(b.w * 0.7, 18), 1.6, 0.4);
          sign.position.set(b.x, b.h + 2.2, b.z - b.d / 2 - 0.4);
          this.scene.add(sign);
        }
        if (b.heli) {
          // helipad: dark disc + H marker on the tower roof
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.4, 20),
            new THREE.MeshLambertMaterial({ color: 0x222831 }));
          pad.position.set(b.x, b.h + 0.7, b.z);
          this.scene.add(pad);
          const bar1 = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffe14d }));
          bar1.scale.set(0.8, 0.2, 5);
          bar1.position.set(b.x, b.h + 1, b.z);
          const bar2 = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffe14d }));
          bar2.scale.set(3.4, 0.2, 0.8);
          bar2.position.set(b.x, b.h + 1, b.z);
          this.scene.add(bar1, bar2);
        }
      }
    },
    buildProps: function (city) {
      // trees: trunk + two foliage spheres
      const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
      const leafGeo = new THREE.SphereGeometry(2.2, 8, 6);
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7a2e });
      for (const t of city.trees) {
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(t.x, 1.2, t.z);
        trunk.scale.setScalar(t.s);
        this.scene.add(trunk);
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(t.x, 3.6 * t.s, t.z);
        leaf.scale.setScalar(t.s);
        this.scene.add(leaf);
      }
      // street lamps: pole + glowing head
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x333a44 });
      const headGeo = new THREE.SphereGeometry(0.5, 8, 6);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      for (const l of city.lamps) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(l.x, 3, l.z);
        this.scene.add(pole);
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(l.x, 6.2, l.z);
        this.scene.add(head);
      }
    },
    buildTrafficLights: function (city) {
      const poleGeo = new THREE.CylinderGeometry(0.14, 0.14, 7, 6);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
      const boxGeo = new THREE.BoxGeometry(1.1, 2.6, 0.7);
      const boxMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
      for (let i = 0; i < city.lights.length; i++) {
        const l = city.lights[i];
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(l.x + 9, 3.5, l.z + 9);
        this.scene.add(pole);
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set(l.x + 9, 7.4, l.z + 9);
        this.scene.add(box);
        const lamps = {};
        const defs = [
          ['red', 0xff2d2d, 0.85], ['amber', 0xffb02d, 0], ['green', 0x37d67a, -0.85],
        ];
        for (const [name, color, dy] of defs) {
          const mat = new THREE.MeshBasicMaterial({ color: color });
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat);
          dot.position.set(l.x + 9, 7.4 + dy, l.z + 9.4);
          this.scene.add(dot);
          lamps[name] = mat;
        }
        this.trafficLights.push({ mats: lamps, offset: i * 1.7 });
      }
    },
    buildBillboards: function (city) {
      const postGeo = new THREE.BoxGeometry(0.5, 9, 0.5);
      const postMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      for (const b of city.billboards) {
        const g = new THREE.Group();
        for (const sx of [-3, 3]) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(sx, 4.5, 0);
          g.add(post);
        }
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(9, 4, 0.4),
          new THREE.MeshBasicMaterial({ color: b.hue }));
        panel.position.set(0, 10, 0);
        g.add(panel);
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(9, 0.7, 0.45),
          new THREE.MeshBasicMaterial({ color: 0xffffff }));
        stripe.position.set(0, 8.4, 0);
        g.add(stripe);
        g.position.set(b.x, 0, b.z);
        g.rotation.y = b.angle;
        this.scene.add(g);
      }
    },
    buildPier: function (city) {
      // Wooden pier jutting into the water at the south edge.
      const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
      const pier = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 46), pierMat);
      pier.position.set(city.places.pier.x, 0.6, city.beachZ + 34 + 18);
      this.scene.add(pier);
      for (let i = 0; i < 5; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 6), pierMat);
        post.position.set(city.places.pier.x - 10 + i * 5, 1, city.beachZ + 34 + 38);
        this.scene.add(post);
      }
      // Ferris wheel silhouette on the pier (landmark, slowly turns)
      const wheel = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.7, 8, 24), new THREE.MeshLambertMaterial({ color: 0xff2d78 }));
      wheel.add(rim);
      for (let i = 0; i < 8; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 22, 0.5), new THREE.MeshLambertMaterial({ color: 0xffe14d }));
        spoke.rotation.z = (i / 8) * Math.PI;
        wheel.add(spoke);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.5, 10), new THREE.MeshLambertMaterial({ color: 0x333333 }));
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);
      wheel.position.set(city.places.pier.x + 16, 15, city.beachZ + 34 + 30);
      this.scene.add(wheel);
      this.ferrisWheel = wheel;
      const legMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 16, 0.8), legMat);
        leg.position.set(city.places.pier.x + 16 + sx * 5, 7, city.beachZ + 34 + 30);
        leg.rotation.z = -sx * 0.3;
        this.scene.add(leg);
      }
    },
    buildMarker: function () {
      // Mission beacon: tall translucent column + pulsing ring on the ground.
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
      col.position.y = 30;
      this.scene.add(col);
      this.markerMesh = col;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3, 4.4, 32),
        new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.15;
      this.scene.add(ring);
      this.markerRing = ring;
      this.setMarker(null);
    },
    setMarker: function (pos) {
      const vis = !!pos;
      this.markerMesh.visible = vis;
      this.markerRing.visible = vis;
      if (pos) {
        this.markerMesh.position.set(pos.x, 30, pos.z);
        this.markerRing.position.set(pos.x, 0.15, pos.z);
      }
    },
    buildPlayer: function () {
      const g = new THREE.Group();
      const skin = new THREE.MeshLambertMaterial({ color: SB.PALETTE.playerSkin });
      const shirt = new THREE.MeshLambertMaterial({ color: SB.PALETTE.playerShirt });
      const pants = new THREE.MeshLambertMaterial({ color: SB.PALETTE.playerPants });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), skin);
      head.position.y = 1.62;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.18, 10), new THREE.MeshLambertMaterial({ color: 0xd23c2e }));
      cap.position.y = 1.95;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.5), shirt);
      body.position.y = 0.95;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 0.34), pants);
      legL.position.set(-0.22, 0.28, 0);
      const legR = legL.clone();
      legR.position.x = 0.22;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), shirt);
      armL.position.set(-0.58, 1.0, 0);
      const armR = armL.clone();
      armR.position.x = 0.58;
      g.add(head, cap, body, legL, legR, armL, armR);
      g.userData = { legL: legL, legR: legR, armL: armL, armR: armR };
      this.scene.add(g);
      this.playerMesh = g;
    },
    makePerson: function (shirtColor, skinColor) {
      const g = new THREE.Group();
      const skin = new THREE.MeshLambertMaterial({ color: skinColor || 0xc98a5a });
      const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
      const pants = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), skin);
      head.position.y = 1.55;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.46), shirt);
      body.position.y = 0.9;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.32), pants);
      legL.position.set(-0.2, 0.25, 0);
      const legR = legL.clone(); legR.position.x = 0.2;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), shirt);
      armL.position.set(-0.55, 0.95, 0);
      const armR = armL.clone(); armR.position.x = 0.55;
      g.add(head, body, legL, legR, armL, armR);
      g.userData = { legL: legL, legR: legR, armL: armL, armR: armR };
      this.scene.add(g);
      return g;
    },
    // Foot cop: dark uniform, police cap, badge dot.
    makeFootCop: function () {
      const g = this.makePerson(0x1a2a4a);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.16, 10),
        new THREE.MeshLambertMaterial({ color: 0x101828 }));
      cap.position.y = 1.88;
      g.add(cap);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xffe14d }));
      badge.position.set(0.2, 1.15, 0.26);
      g.add(badge);
      return g;
    },
    makeCoin: function (x, z) {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.28, 8, 16),
        new THREE.MeshBasicMaterial({ color: SB.PALETTE.coin }));
      m.position.set(x, 1.1, z);
      m.rotation.x = Math.PI / 2.4;
      this.scene.add(m);
      this.coinMeshes.push(m);
      return m;
    },
    spawnSmoke: function (x, y, z) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.55 }));
      m.position.set(x, y, z);
      this.scene.add(m);
      this.smokePuffs.push({ mesh: m, life: 0.9 });
    },
    makeCar: function (color, isPolice) {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({ color: color });
      const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
      body.position.y = 0.62;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), glassMat);
      cabin.position.set(0, 1.25, -0.2);
      g.add(body, cabin);
      const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      for (const [wx, wz] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.42, wz);
        g.add(w);
      }
      if (isPolice) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.28, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        bar.position.set(0, 1.72, -0.2);
        g.add(bar);
        const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
        l1.position.set(-0.32, 1.78, -0.2);
        const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0x2d6dff }));
        l2.position.set(0.32, 1.78, -0.2);
        g.add(l1, l2);
        g.userData.light1 = l1; g.userData.light2 = l2;
      }
      // headlights + taillights
      const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
      for (const sx of [-0.7, 0.7]) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), hl);
        h.position.set(sx, 0.65, 2.32);
        g.add(h);
      }
      const tl = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
      for (const sx of [-0.7, 0.7]) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tl);
        h.position.set(sx, 0.65, -2.32);
        g.add(h);
      }
      this.scene.add(g);
      return g;
    },
    removeMesh: function (m) { if (m) this.scene.remove(m); },

    // ---- per-frame sync ----
    syncPlayer: function (p, t) {
      const m = this.playerMesh;
      m.position.set(p.x, 0, p.z);
      m.rotation.y = p.angle;
      const moving = p.moving ? 1 : 0;
      const s = Math.sin(t * 11) * 0.55 * moving;
      m.userData.legL.rotation.x = s;
      m.userData.legR.rotation.x = -s;
      m.userData.armL.rotation.x = -s * 0.7;
      m.userData.armR.rotation.x = s * 0.7;
      m.visible = !p.inCar;
    },
    syncCar: function (mesh, car, t) {
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.angle;
      if (car.isPolice && car.active) {
        const on = Math.floor(t * 6) % 2 === 0;
        if (mesh.userData.light1) {
          mesh.userData.light1.material.color.setHex(on ? 0xff2d2d : 0x551111);
          mesh.userData.light2.material.color.setHex(on ? 0x111155 : 0x2d6dff);
        }
      }
    },
    syncPerson: function (mesh, ped, t) {
      mesh.position.set(ped.x, 0, ped.z);
      mesh.rotation.y = ped.angle;
      const s = Math.sin(t * 9 + ped.phase) * 0.5 * (ped.moving ? 1 : 0);
      mesh.userData.legL.rotation.x = s;
      mesh.userData.legR.rotation.x = -s;
      mesh.userData.armL.rotation.x = -s * 0.7;
      mesh.userData.armR.rotation.x = s * 0.7;
    },
    // Camera: three modes. FOLLOW is the v1 chase cam; SHOULDER is a close
    // over-the-shoulder view; HIGH is a high chase cam. Wheel zooms.
    setCameraMode: function (mode) {
      this.cameraMode = ((mode % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
      return CAMERA_MODES[this.cameraMode];
    },
    cameraModeName: function () { return CAMERA_MODES[this.cameraMode]; },
    updateCamera: function (focus, yaw, dt) {
      this.camOrbit = (this.camOrbit || 0) + SB.Input.dragDX * 0.004;
      if (SB.Input.wheel) this.camZoom = Math.max(-6, Math.min(10, this.camZoom + SB.Input.wheel * 0.01));
      const targetYaw = yaw + this.camOrbit;
      this.camYaw += (targetYaw - this.camYaw) * Math.min(1, dt * 6);
      this.camPitch = Math.max(0.18, Math.min(0.9, this.camPitch - SB.Input.dragDY * 0.002));
      let dist, height, pitch;
      if (this.cameraMode === 1) { // shoulder
        dist = 7 + this.camZoom * 0.3;
        pitch = 0.12;
        height = 2.6;
      } else if (this.cameraMode === 2) { // high
        dist = 30 + this.camZoom;
        pitch = 0.55;
        height = 6;
      } else { // follow
        dist = (focus.inCar ? 22 : 18) + this.camZoom;
        pitch = this.camPitch;
        height = 4;
      }
      const cx = focus.x - Math.sin(this.camYaw) * Math.cos(pitch) * dist;
      const cz = focus.z - Math.cos(this.camYaw) * Math.cos(pitch) * dist;
      const cy = height + Math.sin(pitch) * dist;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(focus.x, 2.5, focus.z);
    },
    // Overhead vista used by the title screen.
    vistaCamera: function (t) {
      const a = t * 0.05;
      this.camera.position.set(Math.sin(a) * 260, 150, Math.cos(a) * 260);
      this.camera.lookAt(0, 0, 40);
    },
    showTracer: function (from, to) {
      const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 0.1) { this.tracer.visible = false; return; }
      this.tracer.visible = true;
      this.tracer.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      this.tracer.scale.set(1, 1, len);
      this.tracer.lookAt(to.x, to.y, to.z);
      this.tracer.material.opacity = 0.9;
      this._tracerT = 0.09;
    },
    tickTracer: function (dt) {
      if (this.tracer.visible) {
        this._tracerT -= dt;
        if (this._tracerT <= 0) this.tracer.visible = false;
      }
    },
    // Dusk sweep: sky, fog and sun drift from afternoon gold to dusk orange
    // across CFG.duskCycle seconds of play, then hold at dusk.
    updateSky: function (t) {
      const k = Math.min(1, (t % CFG.duskCycle) / CFG.duskCycle);
      const lerp = (a, b) => Math.round(a + (b - a) * k);
      const sky = new THREE.Color(SB.PALETTE.sky);
      const dusk = new THREE.Color(SB.PALETTE.skyDusk);
      sky.r = lerp(sky.r * 255, dusk.r * 255) / 255;
      sky.g = lerp(sky.g * 255, dusk.g * 255) / 255;
      sky.b = lerp(sky.b * 255, dusk.b * 255) / 255;
      this.scene.background = sky;
      this.scene.fog.color.copy(sky);
      if (this.sunLight) {
        this.sunLight.color.setHex(k < 0.5 ? 0xffe6b0 : 0xff9a5a);
        this.sunLight.intensity = 1.5 - k * 0.45;
      }
      if (this.hemiLight) this.hemiLight.intensity = 0.95 - k * 0.25;
    },
    render: function (t) {
      const now = (t === undefined ? 0 : t);
      if (this.ferrisWheel) this.ferrisWheel.rotation.z += 0.0015;
      if (this.markerRing && this.markerRing.visible) {
        const s = 1 + Math.sin(performance.now() / 300) * 0.12;
        this.markerRing.scale.set(s, s, 1);
      }
      // traffic lights cycle: green 6s, amber 1.5s, red 6s, offset per light
      for (const tl of this.trafficLights) {
        const ph = ((now + tl.offset) % 13.5);
        const on = (c, v) => tl.mats[c].color.setHex(v ? (c === 'red' ? 0xff2d2d : c === 'amber' ? 0xffb02d : 0x37d67a) : 0x331111);
        on('green', ph < 6);
        on('amber', ph >= 6 && ph < 7.5);
        on('red', ph >= 7.5);
      }
      // coins spin; smoke puffs rise and fade
      for (const c of this.coinMeshes) { c.rotation.z += 0.03; c.position.y = 1.1 + Math.sin(now * 2 + c.position.x) * 0.15; }
      for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
        const p = this.smokePuffs[i];
        p.life -= 0.016;
        p.mesh.position.y += 0.03;
        p.mesh.scale.multiplyScalar(1.02);
        p.mesh.material.opacity = Math.max(0, p.life * 0.6);
        if (p.life <= 0) { this.scene.remove(p.mesh); this.smokePuffs.splice(i, 1); }
      }
      this.updateSky(now);
      this.renderer.render(this.scene, this.camera);
    },
    // ---- minimap (2D canvas, north-up, player-centred arrow) ----
    drawMinimap: function (mm, world) {
      const g = mm.getContext('2d');
      const S = mm.width, H = SB.CFG.cityHalf + 60;
      const toX = (x) => (x + H) / (2 * H) * S;
      const toY = (z) => (z + H) / (2 * H) * S;
      g.clearRect(0, 0, S, S);
      g.fillStyle = '#12203a'; g.fillRect(0, 0, S, S);
      // water + beach
      g.fillStyle = '#1e6f9e'; g.fillRect(0, toY(world.city.beachZ + 34), S, S);
      g.fillStyle = '#e0c98f'; g.fillRect(0, toY(world.city.beachZ), S, toY(world.city.beachZ + 34) - toY(world.city.beachZ));
      // parks + plazas
      g.fillStyle = '#4f8f3a';
      for (const p of world.city.parks) g.fillRect(toX(p.x - p.w / 2), toY(p.z - p.d / 2), p.w / (2 * H) * S, p.d / (2 * H) * S);
      g.fillStyle = '#b9b3a4';
      for (const p of world.city.plazas) g.fillRect(toX(p.x - p.w / 2), toY(p.z - p.d / 2), p.w / (2 * H) * S, p.d / (2 * H) * S);
      // roads
      g.strokeStyle = '#5a6068'; g.lineWidth = 5;
      for (const r of world.city.roadLines) {
        g.beginPath(); g.moveTo(toX(r.x1), toY(r.z1)); g.lineTo(toX(r.x2), toY(r.z2)); g.stroke();
      }
      // buildings
      g.fillStyle = '#8d9299';
      for (const b of world.city.buildings) g.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), Math.max(2, b.w / (2 * H) * S), Math.max(2, b.d / (2 * H) * S));
      // coins (gold dots)
      g.fillStyle = '#ffe14d';
      for (const c of world.coins) {
        if (!c.taken) { g.beginPath(); g.arc(toX(c.x), toY(c.z), 2.5, 0, Math.PI * 2); g.fill(); }
      }
      // mission marker
      if (world.missionTarget) {
        g.fillStyle = '#ffe14d';
        g.beginPath(); g.arc(toX(world.missionTarget.x), toY(world.missionTarget.z), 6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
      }
      // police cars (red), foot cops (blue), thugs (orange)
      for (const c of world.cars) {
        if (c.isPolice) { g.fillStyle = '#ff2d2d'; g.beginPath(); g.arc(toX(c.x), toY(c.z), 3.5, 0, Math.PI * 2); g.fill(); }
      }
      for (const f of world.footCops) {
        if (f.hp > 0) { g.fillStyle = '#2d6dff'; g.beginPath(); g.arc(toX(f.x), toY(f.z), 3, 0, Math.PI * 2); g.fill(); }
      }
      for (const t of world.thugs) {
        if (t.hp > 0) { g.fillStyle = '#ff7b2e'; g.beginPath(); g.arc(toX(t.x), toY(t.z), 3, 0, Math.PI * 2); g.fill(); }
      }
      // player arrow
      const p = world.player;
      g.save();
      g.translate(toX(p.x), toY(p.z));
      g.rotate(Math.PI - p.angle);
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
      g.restore();
    },
  };
  SB.Render = Render;
})();
