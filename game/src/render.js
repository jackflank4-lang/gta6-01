// three.js scene for Solmar Bay: ground, buildings, props, vehicles, people,
// camera follow, and the 2D minimap. No external assets — textures are canvas-made.
(function () {
  'use strict';
  window.SB = window.SB || {};
  const CFG = SB.CFG;

  const Render = {
    scene: null, camera: null, renderer: null, canvas: null,
    city: null, facadeCache: {},
    playerMesh: null, carMeshes: new Map(), pedMeshes: new Map(),
    markerMesh: null, markerRing: null, beaconLight: null,
    camYaw: 0, camPitch: 0.42, camDist: 26,
    tracer: null, muzzle: null,

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

      // Lighting: warm afternoon sun + sky bounce.
      const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.95);
      this.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffe6b0, 1.5);
      sun.position.set(180, 260, 120);
      this.scene.add(sun);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.18));

      this.buildGround(city);
      this.buildBuildings(city);
      this.buildProps(city);
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
      // headlights
      const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
      for (const sx of [-0.7, 0.7]) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), hl);
        h.position.set(sx, 0.65, 2.32);
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
    // Camera: third-person follow behind the player / car, mouse drag orbits.
    updateCamera: function (focus, yaw, dt) {
      this.camOrbit = (this.camOrbit || 0) + SB.Input.dragDX * 0.004;
      const targetYaw = yaw + this.camOrbit;
      this.camYaw += (targetYaw - this.camYaw) * Math.min(1, dt * 6);
      this.camPitch = Math.max(0.18, Math.min(0.9, this.camPitch - SB.Input.dragDY * 0.002));
      const dist = focus.inCar ? 30 : 24;
      const cx = focus.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
      const cz = focus.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
      const cy = 4 + Math.sin(this.camPitch) * dist;
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
    render: function () {
      if (this.ferrisWheel) this.ferrisWheel.rotation.z += 0.0015;
      if (this.markerRing && this.markerRing.visible) {
        const s = 1 + Math.sin(performance.now() / 300) * 0.12;
        this.markerRing.scale.set(s, s, 1);
      }
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
      // parks
      g.fillStyle = '#4f8f3a';
      for (const p of world.city.parks) g.fillRect(toX(p.x - p.w / 2), toY(p.z - p.d / 2), p.w / (2 * H) * S, p.d / (2 * H) * S);
      // roads
      g.strokeStyle = '#5a6068'; g.lineWidth = 5;
      for (const r of world.city.roadLines) {
        g.beginPath(); g.moveTo(toX(r.x1), toY(r.z1)); g.lineTo(toX(r.x2), toY(r.z2)); g.stroke();
      }
      // buildings
      g.fillStyle = '#8d9299';
      for (const b of world.city.buildings) g.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), Math.max(2, b.w / (2 * H) * S), Math.max(2, b.d / (2 * H) * S));
      // mission marker
      if (world.missionTarget) {
        g.fillStyle = '#ffe14d';
        g.beginPath(); g.arc(toX(world.missionTarget.x), toY(world.missionTarget.z), 6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
      }
      // police (red), thugs (orange)
      for (const c of world.cars) {
        if (c.isPolice) { g.fillStyle = '#ff2d2d'; g.beginPath(); g.arc(toX(c.x), toY(c.z), 3.5, 0, Math.PI * 2); g.fill(); }
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
