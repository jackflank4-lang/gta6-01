// Solmar Bay — rules and state: player, cars, traffic + ped AI, police + wanted,
// combat, the 5-mission story, economy, and save/load. No drawing here.
(function () {
  'use strict';
  window.SB = window.SB || {};
  const CFG = SB.CFG;
  const H = SB.CityHelpers;

  const MISSIONS = [
    {
      name: '1 · HOT WHEELS',
      intro: 'Mama Lou: "Dax, baby — I need wheels. Steal any car and bring it to the Chop Shop."',
      objective: 'Steal any car, then deliver it to the Chop Shop',
    },
    {
      name: '2 · PAYBACK',
      intro: 'Mama Lou: "Kingfish boys are leaning on my dock workers. Go sort them out."',
      objective: 'Deal with the Kingfish thugs at the Solmar Docks',
    },
    {
      name: '3 · HEAT RUN',
      intro: 'Mama Lou: "The PD is on you, Dax. Lose them — get to the Hideout and lay low."',
      objective: 'Lose the cops and reach the Hideout',
    },
    {
      name: '4 · THE DROP',
      intro: 'Mama Lou: "Package at the Diner. Pier by sunset — 90 seconds, no excuses."',
      objective: 'Pick up the package at the Diner, deliver it to the Pier',
    },
    {
      name: '5 · KINGFISH FALLS',
      intro: 'Mama Lou: "Time to end this. Kingfish is at his Tower. Take the crew, take the vault."',
      objective: 'Take down the Kingfish crew at the Tower (6)',
    },
  ];

  const World = {
    city: null, rng: null,
    screen: 'menu',
    time: 0,
    player: null,
    cars: [], peds: [], thugs: [], pickups: [],
    wanted: 0, wantedTimer: 0, bustTimer: 0, hideTimer: 0,
    missionIndex: 0, mission: null, missionTarget: null,
    camYaw: 0,
    events: [], // {kind, text, sub} consumed by main for toasts
    saveKey: 'solmarbay.save.v1',
    shootCooldown: 0, punchCooldown: 0, saveTimer: 0, lastHurt: -99,
    won: false, freeRoam: false,

    create: function (city, seed) {
      this.city = city;
      this.rng = SB.RNG.make(seed || CFG.seed);
      this.reset();
      return this;
    },
    reset: function () {
      // clear old meshes
      for (const c of this.cars) SB.Render.removeMesh(c.mesh);
      for (const p of this.peds) SB.Render.removeMesh(p.mesh);
      for (const t of this.thugs) SB.Render.removeMesh(t.mesh);
      this.cars = []; this.peds = []; this.thugs = []; this.pickups = [];
      const sp = this.city.places.spawn;
      this.player = {
        x: sp.x, z: sp.z, angle: Math.PI, health: CFG.playerHealth, money: CFG.startMoney,
        ammo: CFG.gunAmmoStart, inCar: false, carId: null, moving: false, speed: 0,
        invuln: 0,
      };
      this.wanted = 0; this.wantedTimer = 0; this.bustTimer = 0; this.hideTimer = 0;
      this.missionIndex = 0; this.mission = null; this.missionTarget = null;
      this.camYaw = Math.PI;
      this.time = 0; this.won = false; this.freeRoam = false;
      this.events = [];
      this.spawnTraffic();
      this.spawnPeds();
      this.spawnParkedCars();
      this.spawnPickups();
      this.startMission(0);
    },
    // ---------- spawning ----------
    spawnTraffic: function () {
      for (let i = 0; i < CFG.trafficCars; i++) {
        const car = this.makeCar(false, false);
        const node = this.randomRoadNode();
        car.x = node.x; car.z = node.z;
        car.target = this.randomNeighbour(node);
        car.speed = this.rng.range(8, CFG.trafficSpeed);
        car.angle = Math.atan2(car.target.x - car.x, car.target.z - car.z);
        car.driver = 'traffic';
        this.cars.push(car);
      }
    },
    spawnParkedCars: function () {
      const spots = this.city.parkedSpots;
      for (let i = 0; i < Math.min(12, spots.length); i++) {
        const s = spots[i];
        const car = this.makeCar(false, false);
        car.x = s.x; car.z = s.z; car.angle = s.angle; car.speed = 0;
        car.driver = 'parked'; car.parked = true;
        this.cars.push(car);
      }
    },
    spawnPeds: function () {
      for (let i = 0; i < CFG.peds; i++) {
        const p = this.makePed(false);
        const n = this.randomRoadNode();
        p.x = n.x + this.rng.range(-30, 30);
        p.z = n.z + this.rng.range(-30, 30);
        const c = H.collideCircle(this.city, p.x, p.z, 1);
        p.x = c.x; p.z = c.z;
        p.target = this.randomSidewalkPoint(p.x, p.z);
        this.peds.push(p);
      }
    },
    spawnPickups: function () {
      const places = this.city.places;
      this.pickups.push({ kind: 'health', x: places.hospital.x + 14, z: places.hospital.z, taken: false });
      this.pickups.push({ kind: 'health', x: places.diner.x - 14, z: places.diner.z, taken: false });
      this.pickups.push({ kind: 'ammo', x: places.hideout.x + 12, z: places.hideout.z, taken: false });
      this.pickups.push({ kind: 'ammo', x: places.chopshop.x + 14, z: places.chopshop.z, taken: false });
    },
    makeCar: function (isPolice, isPlayerCar) {
      const color = isPolice ? SB.PALETTE.police : this.rng.pick(SB.PALETTE.car);
      const mesh = SB.Render.makeCar(color, isPolice);
      const car = {
        id: 'c' + Math.floor(this.rng.next() * 1e9).toString(36),
        x: 0, z: 0, angle: 0, speed: 0, color: color,
        isPolice: !!isPolice, active: true, driver: null, parked: false,
        mesh: mesh, target: null, steer: 0,
      };
      return car;
    },
    makePed: function (isThug) {
      const shirt = isThug ? 0x8a1a1a : this.rng.pick(SB.PALETTE.pedShirt);
      const mesh = SB.Render.makePerson(shirt);
      return {
        x: 0, z: 0, angle: this.rng.range(0, Math.PI * 2), hp: isThug ? 60 : 30,
        speed: 0, moving: false, phase: this.rng.range(0, 6), target: null,
        flee: 0, mesh: mesh, isThug: !!isThug, attackCd: 0, dead: false, flash: 0,
      };
    },
    randomRoadNode: function () {
      const P = CFG.pitch, HB = CFG.halfBlocks;
      return { x: this.rng.int(-HB, HB) * P, z: this.rng.int(-HB, HB) * P };
    },
    randomNeighbour: function (node) {
      const P = CFG.pitch, HB = CFG.halfBlocks;
      const opts = [];
      if (node.x > -HB * P) opts.push({ x: node.x - P, z: node.z });
      if (node.x < HB * P) opts.push({ x: node.x + P, z: node.z });
      if (node.z > -HB * P) opts.push({ x: node.x, z: node.z - P });
      if (node.z < HB * P) opts.push({ x: node.x, z: node.z + P });
      return this.rng.pick(opts);
    },
    randomSidewalkPoint: function (x, z) {
      const s = H.snapToRoad(x, z);
      const off = this.rng.chance(0.5) ? 10 : -10;
      if (s.horiz) return { x: x + this.rng.range(-60, 60), z: s.z + off };
      return { x: s.x + off, z: z + this.rng.range(-60, 60) };
    },
    // ---------- missions ----------
    startMission: function (i) {
      this.missionIndex = i;
      if (i >= MISSIONS.length) {
        this.freeRoam = true;
        this.mission = null; this.missionTarget = null;
        SB.Render.setMarker(null);
        return;
      }
      const m = MISSIONS[i];
      this.mission = { def: m, stage: 0, timer: 0, kills: 0, need: 0, package: false };
      this.events.push({ kind: 'mission', text: m.name, sub: m.intro });
      SB.Audio.mission();
      if (i === 1) this.spawnThugs(3, this.city.places.docks, false);
      if (i === 2) this.addWanted(2, true);
      if (i === 3) this.missionTarget = { x: this.city.places.diner.x, z: this.city.places.diner.z };
      if (i === 4) this.spawnThugs(6, this.city.places.tower, true);
      this.updateMarker();
    },
    spawnThugs: function (n, at, boss) {
      for (let i = 0; i < n; i++) {
        const t = this.makePed(true);
        const a = (i / n) * Math.PI * 2;
        t.x = at.x + Math.cos(a) * this.rng.range(4, 12);
        t.z = at.z + Math.sin(a) * this.rng.range(4, 12);
        const c = H.collideCircle(this.city, t.x, t.z, 1);
        t.x = c.x; t.z = c.z;
        t.hp = boss && i === 0 ? 200 : 60;
        t.isBoss = boss && i === 0;
        this.thugs.push(t);
      }
      this.mission.need = n;
      this.mission.kills = 0;
    },
    updateMarker: function () {
      SB.Render.setMarker(this.missionTarget);
    },
    completeMission: function () {
      const reward = CFG.missionRewards[this.missionIndex];
      this.player.money += reward;
      this.player.ammo += 24;
      this.events.push({ kind: 'reward', text: 'MISSION COMPLETE', sub: '+' + '$' + reward + '  ·  +24 ammo' });
      SB.Audio.cash();
      this.save();
      const next = this.missionIndex + 1;
      if (next >= MISSIONS.length) {
        this.won = true;
        this.events.push({ kind: 'win', text: 'SOLMAR BAY IS YOURS', sub: 'Kingfish is finished. Free roam — the city is yours, Dax.' });
        this.mission = null; this.missionTarget = null;
        SB.Render.setMarker(null);
        this.freeRoam = true;
        this.screen = 'win';
      } else {
        this.startMission(next);
      }
    },
    failMission: function (reason) {
      this.events.push({ kind: 'fail', text: 'MISSION FAILED', sub: reason });
      SB.Audio.fail();
      // restart the same mission
      this.mission = null; this.missionTarget = null;
      this.thugs.forEach((t) => SB.Render.removeMesh(t.mesh));
      this.thugs = [];
      if (this.missionIndex === 2) this.wanted = 0; // reset heat
      this.startMission(this.missionIndex);
    },
    // ---------- wanted ----------
    addWanted: function (n, silent) {
      const before = this.wanted;
      this.wanted = Math.min(5, this.wanted + n);
      this.wantedTimer = 0;
      if (this.wanted > before && !silent) this.events.push({ kind: 'wanted', text: 'WANTED LEVEL ' + this.wanted, sub: 'The Solmar PD is on you.' });
      SB.Audio.sirenSet(this.wanted > 0);
      this.syncPolice();
    },
    syncPolice: function () {
      const want = this.wanted === 0 ? 0 : Math.min(6, this.wanted + 1);
      const have = this.cars.filter((c) => c.isPolice && c.active).length;
      for (let i = have; i < want; i++) {
        const car = this.makeCar(true, false);
        const a = this.rng.range(0, Math.PI * 2);
        const d = this.rng.range(70, 110);
        let x = this.player.x + Math.sin(a) * d;
        let z = this.player.z + Math.cos(a) * d;
        const s = H.snapToRoad(x, z);
        x = s.x; z = s.z;
        const c = H.clampCity(x, z, 0);
        car.x = c.x; car.z = c.z;
        car.speed = CFG.trafficSpeed + 6;
        car.angle = Math.atan2(this.player.x - car.x, this.player.z - car.z);
        car.driver = 'police';
        this.cars.push(car);
      }
      if (want === 0) {
        for (const c of this.cars) if (c.isPolice) { c.active = false; SB.Render.removeMesh(c.mesh); }
        this.cars = this.cars.filter((c) => c.active);
        SB.Audio.sirenSet(false);
      }
    },
    // ---------- combat ----------
    aimPoint: function () {
      // Ground point under the mouse cursor, via the render camera.
      const cam = SB.Render.camera;
      const canvas = SB.Render.canvas;
      const nx = (SB.Input.mouseX / canvas.clientWidth) * 2 - 1;
      const ny = -(SB.Input.mouseY / canvas.clientHeight) * 2 + 1;
      const v = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
      const dir = v.sub(cam.position).normalize();
      if (Math.abs(dir.y) < 0.0001) return { x: this.player.x, z: this.player.z };
      const t = -cam.position.y / dir.y;
      return { x: cam.position.x + dir.x * t, z: cam.position.z + dir.z * t };
    },
    shoot: function () {
      const p = this.player;
      if (p.ammo <= 0) {
        this.shootCooldown = 0.6;
        this.events.push({ kind: 'info', text: 'OUT OF AMMO', sub: 'Find an ammo crate — yellow boxes at the Hideout and Chop Shop.' });
        return;
      }
      p.ammo--;
      this.shootCooldown = 0.28;
      SB.Audio.shoot();
      const aim = this.aimPoint();
      const from = { x: p.x, y: 1.4, z: p.z };
      const to = { x: aim.x, y: 0.4, z: aim.z };
      SB.Render.showTracer(from, to);
      p.angle = Math.atan2(aim.x - p.x, aim.z - p.z);
      // nearest enemy near the aim point takes the hit
      let best = null, bd = 5;
      const consider = (e) => {
        if (e.dead || e.hp <= 0) return;
        const d = H.dist(aim.x, aim.z, e.x, e.z);
        if (d < bd) { bd = d; best = e; }
      };
      for (const t of this.thugs) consider(t);
      for (const pd of this.peds) consider(pd);
      if (best) {
        this.damageEnemy(best, CFG.gunDamage, true);
      } else {
        // did we hit a cop car? scare peds either way
        this.scarePeds(p.x, p.z, 40);
        if (this.wanted === 0 && this.nearPolice(60)) this.addWanted(1);
      }
    },
    punch: function () {
      const p = this.player;
      this.punchCooldown = 0.45;
      SB.Audio.punch();
      const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
      let best = null, bd = CFG.punchRange;
      const consider = (e) => {
        if (e.dead || e.hp <= 0) return;
        const dx = e.x - p.x, dz = e.z - p.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const dot = (dx * fx + dz * fz) / Math.max(0.001, d);
        if (d < bd && dot > 0.3) { bd = d; best = e; }
      };
      for (const t of this.thugs) consider(t);
      for (const pd of this.peds) consider(pd);
      if (best) this.damageEnemy(best, CFG.punchDamage, false);
    },
    damageEnemy: function (e, dmg, wasShot) {
      e.hp -= dmg;
      e.flash = 0.15;
      if (e.isThug && wasShot) this.scarePeds(e.x, e.z, 30);
      if (e.hp <= 0) {
        e.dead = true;
        SB.Render.removeMesh(e.mesh);
        if (e.isThug) {
          this.player.money += 40;
          this.events.push({ kind: 'info', text: '+$40', sub: 'Took his cash.' });
          SB.Audio.cash();
          if (this.mission) {
            this.mission.kills++;
            if (this.mission.kills >= this.mission.need && (this.missionIndex === 1 || this.missionIndex === 4)) {
              this.completeMission();
            }
          }
        } else {
          this.addWanted(1);
        }
        this.thugs = this.thugs.filter((t) => !t.dead);
        this.peds = this.peds.filter((pd) => !pd.dead);
      }
    },
    hurtPlayer: function (dmg) {
      const p = this.player;
      if (p.invuln > 0) return;
      p.health -= dmg;
      p.invuln = 0.4;
      this.lastHurt = this.time;
      if (p.health <= 0) {
        p.health = 0;
        this.wasted();
      }
    },
    scarePeds: function (x, z, r) {
      for (const pd of this.peds) {
        if (H.dist(x, z, pd.x, pd.z) < r) pd.flee = 3;
      }
    },
    nearPolice: function (r) {
      for (const c of this.cars) {
        if (c.isPolice && c.active && H.dist(this.player.x, this.player.z, c.x, c.z) < r) return true;
      }
      return false;
    },
    // ---------- busted / wasted ----------
    busted: function () {
      const fine = Math.min(this.player.money, CFG.bustFine);
      this.player.money -= fine;
      this.wanted = 0;
      SB.Audio.sirenSet(false);
      this.events.push({ kind: 'end', title: 'BUSTED', sub: 'The Solmar PD took $' + fine + ' off you. Mama Lou bailed you out.' });
      this.screen = 'busted';
      this.respawn(this.city.places.hideout, true);
    },
    wasted: function () {
      const fine = Math.min(this.player.money, CFG.wastedFine);
      this.player.money -= fine;
      this.wanted = 0;
      SB.Audio.sirenSet(false);
      this.events.push({ kind: 'end', title: 'WASTED', sub: 'You woke up at St. Maria Hospital, $' + fine + ' lighter.' });
      this.screen = 'wasted';
      this.respawn(this.city.places.hospital, true);
    },
    respawn: function (at, clearCar) {
      const p = this.player;
      if (clearCar && p.inCar) {
        const car = this.cars.find((c) => c.id === p.carId);
        if (car) { car.driver = 'parked'; car.parked = true; }
        p.inCar = false; p.carId = null;
      }
      p.x = at.x; p.z = at.z; p.health = CFG.playerHealth; p.invuln = 2;
      this.bustTimer = 0;
      this.syncPolice();
      this.save();
    },
    // ---------- car enter / exit ----------
    nearestCar: function (maxD) {
      let best = null, bd = maxD;
      for (const c of this.cars) {
        if (!c.active) continue;
        const d = H.dist(this.player.x, this.player.z, c.x, c.z);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
    enterCar: function (car) {
      const p = this.player;
      if (car.driver === 'traffic') {
        // steal it: driver bails out as a fleeing ped
        const ped = this.makePed(false);
        ped.x = car.x + 3; ped.z = car.z + 2;
        ped.flee = 4;
        this.peds.push(ped);
        car.driver = 'player';
        this.addWanted(1);
        this.events.push({ kind: 'info', text: 'CAR JACKED', sub: 'That one had a driver. The PD noticed.' });
      } else {
        car.driver = 'player';
      }
      car.parked = false;
      p.inCar = true; p.carId = car.id;
      SB.Audio.engineStart();
    },
    exitCar: function () {
      const p = this.player;
      const car = this.cars.find((c) => c.id === p.carId);
      if (!car) { p.inCar = false; p.carId = null; return; }
      car.driver = 'parked'; car.parked = true;
      p.inCar = false; p.carId = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 3;
      p.z = car.z + Math.sin(car.angle + Math.PI / 2) * 3;
      const c = H.collideCircle(this.city, p.x, p.z, CFG.playerRadius);
      p.x = c.x; p.z = c.z;
    },
    // ---------- per-frame update ----------
    update: function (dt, input) {
      this.time += dt;
      const p = this.player;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.punchCooldown > 0) this.punchCooldown -= dt;
      if (p.invuln > 0) p.invuln -= dt;
      // health regen when calm
      if (this.wanted === 0 && this.time - this.lastHurt > 6 && p.health > 0 && p.health < CFG.playerHealth) {
        p.health = Math.min(CFG.playerHealth, p.health + 1.5 * dt);
      }
      // camera yaw follows player heading when not dragging
      const axis = input.axis();
      if (p.inCar) this.updateCar(dt, input, axis);
      else this.updateOnFoot(dt, input, axis);
      this.updateTraffic(dt);
      this.updatePeds(dt);
      this.updateThugs(dt);
      this.updatePolice(dt);
      this.updateWanted(dt);
      this.updatePickups(dt);
      this.updateMission(dt);
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) { this.saveTimer = 20; this.save(); }
      SB.Render.tickTracer(dt);
    },
    updateOnFoot: function (dt, input, axis) {
      const p = this.player;
      const speed = input.down('ShiftLeft') || input.down('ShiftRight') ? CFG.runSpeed : CFG.walkSpeed;
      const moving = axis.x !== 0 || axis.y !== 0;
      p.moving = moving;
      if (moving) {
        // camera-relative movement
        const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
        const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
        let mx = fx * axis.y + rx * axis.x;
        let mz = fz * axis.y + rz * axis.x;
        const len = Math.sqrt(mx * mx + mz * mz);
        mx /= len; mz /= len;
        p.x += mx * speed * dt;
        p.z += mz * speed * dt;
        p.angle = Math.atan2(mx, mz);
        const c = H.collideCircle(this.city, p.x, p.z, CFG.playerRadius);
        p.x = c.x; p.z = c.z;
        const cl = H.clampCity(p.x, p.z, 0);
        p.x = cl.x; p.z = cl.z;
        this.camYaw = p.angle; // camera trails behind the run direction
      }
      // enter car
      if (input.wasPressed('KeyE')) {
        const car = this.nearestCar(4.5);
        if (car) this.enterCar(car);
        else this.events.push({ kind: 'info', text: 'NO CAR NEARBY', sub: 'Walk up to a car and press E.' });
      }
      // punch
      if (input.wasPressed('KeyF') && this.punchCooldown <= 0) this.punch();
      // shoot (mouse held)
      if (input.mouseDown && this.shootCooldown <= 0) this.shoot();
      // aim: face the mouse when shooting is held
      if (input.mouseDown) {
        const aim = this.aimPoint();
        p.angle = Math.atan2(aim.x - p.x, aim.z - p.z);
      }
      SB.Audio.engineSet(0, false);
    },
    updateCar: function (dt, input, axis) {
      const p = this.player;
      const car = this.cars.find((c) => c.id === p.carId);
      if (!car) { p.inCar = false; p.carId = null; return; }
      const fwd = axis.y, steer = axis.x;
      if (fwd > 0) car.speed += CFG.carAccel * dt;
      else if (fwd < 0) {
        if (car.speed > 0.5) car.speed -= CFG.carBrake * dt;
        else car.speed -= CFG.carAccel * 0.5 * dt;
      } else {
        car.speed -= Math.sign(car.speed) * 12 * dt;
        if (Math.abs(car.speed) < 0.5) car.speed = 0;
      }
      if (input.down('Space')) car.speed -= Math.sign(car.speed) * 30 * dt;
      car.speed = Math.max(-CFG.carMaxReverse, Math.min(CFG.carMaxSpeed, car.speed));
      const turn = steer * CFG.carTurn * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed || 1);
      car.angle += turn;
      const nx = car.x + Math.sin(car.angle) * car.speed * dt;
      const nz = car.z + Math.cos(car.angle) * car.speed * dt;
      const c = H.collideCircle(this.city, nx, nz, CFG.carRadius);
      if (c.x !== nx || c.z !== nz) {
        if (Math.abs(car.speed) > 12) SB.Audio.crash();
        car.speed *= 0.4;
      }
      car.x = c.x; car.z = c.z;
      const cl = H.clampCity(car.x, car.z, 0);
      car.x = cl.x; car.z = cl.z;
      // car-vs-car + car-vs-ped
      for (const o of this.cars) {
        if (o === car || !o.active) continue;
        const d = H.dist(car.x, car.z, o.x, o.z);
        if (d < 4.4 && d > 0.01) {
          const push = (4.4 - d) / 2;
          const dx = (car.x - o.x) / d, dz = (car.z - o.z) / d;
          car.x += dx * push; car.z += dz * push;
          if (!o.isPolice && o.driver !== 'player') { o.x -= dx * push; o.z -= dz * push; }
          if (Math.abs(car.speed) > 10) { SB.Audio.crash(); car.speed *= 0.7; }
        }
      }
      for (const pd of this.peds) {
        if (pd.dead) continue;
        const d = H.dist(car.x, car.z, pd.x, pd.z);
        if (d < 2.6) {
          pd.dead = true;
          SB.Render.removeMesh(pd.mesh);
          this.addWanted(1);
          this.events.push({ kind: 'info', text: 'PEDESTRIAN DOWN', sub: 'The PD saw that. Wanted level up.' });
          car.speed *= 0.8;
        }
      }
      this.peds = this.peds.filter((pd) => !pd.dead);
      // sync player to car
      p.x = car.x; p.z = car.z; p.angle = car.angle; p.speed = car.speed;
      p.moving = Math.abs(car.speed) > 0.5;
      this.camYaw = car.angle;
      SB.Audio.engineSet(Math.abs(car.speed) / CFG.carMaxSpeed, true);
      if (input.wasPressed('KeyE')) this.exitCar();
      // shooting from the car is drive-by: allowed, same button
      if (input.mouseDown && this.shootCooldown <= 0) this.shoot();
    },
    updateTraffic: function (dt) {
      for (const car of this.cars) {
        if (!car.active || car.driver !== 'traffic') continue;
        const t = car.target;
        const dx = t.x - car.x, dz = t.z - car.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 4) {
          const node = { x: t.x, z: t.z };
          car.target = this.randomNeighbour(node);
          continue;
        }
        const wantAngle = Math.atan2(dx, dz);
        let da = wantAngle - car.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, da));
        // slow for a car ahead
        let slow = false;
        for (const o of this.cars) {
          if (o === car || !o.active) continue;
          const odx = o.x - car.x, odz = o.z - car.z;
          const od = Math.sqrt(odx * odx + odz * odz);
          const ahead = (odx * Math.sin(car.angle) + odz * Math.cos(car.angle)) / Math.max(0.001, od);
          if (od < 10 && ahead > 0.7) { slow = true; break; }
        }
        const targetSpeed = slow ? 0 : CFG.trafficSpeed;
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
        car.x += Math.sin(car.angle) * car.speed * dt;
        car.z += Math.cos(car.angle) * car.speed * dt;
      }
    },
    updatePeds: function (dt) {
      for (const pd of this.peds) {
        if (pd.dead) continue;
        if (pd.flee > 0) {
          pd.flee -= dt;
          // run away from the player
          const dx = pd.x - this.player.x, dz = pd.z - this.player.z;
          const d = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
          pd.angle = Math.atan2(dx / d, dz / d);
          pd.x += (dx / d) * 7 * dt;
          pd.z += (dz / d) * 7 * dt;
          pd.moving = true;
        } else {
          const t = pd.target;
          if (!t) { pd.target = this.randomSidewalkPoint(pd.x, pd.z); continue; }
          const dx = t.x - pd.x, dz = t.z - pd.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < 2) { pd.target = this.randomSidewalkPoint(pd.x, pd.z); pd.moving = false; continue; }
          pd.angle = Math.atan2(dx / d, dz / d);
          pd.x += (dx / d) * CFG.pedSpeed * dt;
          pd.z += (dz / d) * CFG.pedSpeed * dt;
          pd.moving = true;
        }
        const c = H.collideCircle(this.city, pd.x, pd.z, 0.8);
        pd.x = c.x; pd.z = c.z;
        const cl = H.clampCity(pd.x, pd.z, 0);
        pd.x = cl.x; pd.z = cl.z;
      }
    },
    updateThugs: function (dt) {
      const p = this.player;
      for (const t of this.thugs) {
        if (t.hp <= 0) continue;
        if (t.flash > 0) t.flash -= dt;
        const d = H.dist(p.x, p.z, t.x, t.z);
        if (d < 40) {
          // chase + punch the player
          const dx = p.x - t.x, dz = p.z - t.z;
          const dd = Math.max(0.001, d);
          t.angle = Math.atan2(dx / dd, dz / dd);
          if (d > 2.2) {
            const sp = t.isBoss ? 6.5 : 5.2;
            t.x += (dx / dd) * sp * dt;
            t.z += (dz / dd) * sp * dt;
            t.moving = true;
          } else {
            t.moving = false;
            if (t.attackCd <= 0) {
              t.attackCd = 1.1;
              this.hurtPlayer(t.isBoss ? 16 : 9);
              SB.Audio.punch();
            }
          }
        } else {
          t.moving = false;
          // idle patrol near their spot
          if (!t.target || H.dist(t.x, t.z, t.target.x, t.target.z) < 2) {
            t.target = { x: t.x + this.rng.range(-8, 8), z: t.z + this.rng.range(-8, 8) };
          }
          const dx = t.target.x - t.x, dz = t.target.z - t.z;
          const dd = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
          t.angle = Math.atan2(dx / dd, dz / dd);
          t.x += (dx / dd) * 2 * dt;
          t.z += (dz / dd) * 2 * dt;
          t.moving = true;
        }
        if (t.attackCd > 0) t.attackCd -= dt;
        const c = H.collideCircle(this.city, t.x, t.z, 0.9);
        t.x = c.x; t.z = c.z;
      }
    },
    updatePolice: function (dt) {
      const p = this.player;
      for (const car of this.cars) {
        if (!car.active || !car.isPolice) continue;
        const d = H.dist(p.x, p.z, car.x, car.z);
        if (d > 160) {
          // teleport closer on a road: the PD never gives up that easily
          const a = this.rng.range(0, Math.PI * 2);
          const s = H.snapToRoad(p.x + Math.sin(a) * 90, p.z + Math.cos(a) * 90);
          car.x = s.x; car.z = s.z;
          car.speed = CFG.trafficSpeed + 8;
          continue;
        }
        // pursuit steering
        const wantAngle = Math.atan2(p.x - car.x, p.z - car.z);
        let da = wantAngle - car.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const maxTurn = 2.4 * dt;
        car.angle += Math.max(-maxTurn, Math.min(maxTurn, da));
        const targetSpeed = d > 12 ? CFG.carMaxSpeed * 0.92 : CFG.carMaxSpeed * 0.55;
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
        const nx = car.x + Math.sin(car.angle) * car.speed * dt;
        const nz = car.z + Math.cos(car.angle) * car.speed * dt;
        const c = H.collideCircle(this.city, nx, nz, CFG.carRadius);
        if (c.x !== nx || c.z !== nz) { car.speed *= 0.5; car.angle += 0.6 * dt * (this.rng.next() < 0.5 ? 1 : -1); }
        car.x = c.x; car.z = c.z;
        // ram the player car
        if (p.inCar) {
          const pc = this.cars.find((cc) => cc.id === p.carId);
          if (pc && H.dist(car.x, car.z, pc.x, pc.z) < 4.2) {
            pc.speed *= 0.92;
            SB.Audio.crash();
            this.hurtPlayer(2);
          }
        } else if (d < CFG.bustDist) {
          // on foot: cornered
          this.bustTimer += dt;
          if (this.bustTimer >= CFG.bustTime) this.busted();
        }
      }
      if (this.wanted === 0) this.bustTimer = 0;
    },
    updateWanted: function (dt) {
      if (this.wanted === 0) return;
      // hideout clears heat
      const hd = H.dist(this.player.x, this.player.z, this.city.places.hideout.x, this.city.places.hideout.z);
      if (hd < 14) {
        this.hideTimer += dt;
        if (this.hideTimer > 2) {
          this.wanted = 0;
          this.hideTimer = 0;
          this.events.push({ kind: 'info', text: 'HEAT LOST', sub: 'You laid low at the Hideout. The PD moved on.' });
          this.syncPolice();
          return;
        }
      } else this.hideTimer = 0;
      // decay when no cop is near
      if (!this.nearPolice(CFG.wantedDecayDist)) {
        this.wantedTimer += dt;
        if (this.wantedTimer >= CFG.wantedDecayTime) {
          this.wanted--;
          this.wantedTimer = 0;
          if (this.wanted === 0) {
            this.events.push({ kind: 'info', text: 'HEAT LOST', sub: 'You lost the cops.' });
            this.syncPolice();
          } else {
            this.syncPolice();
          }
        }
      } else this.wantedTimer = 0;
    },
    updatePickups: function (dt) {
      const p = this.player;
      for (const pk of this.pickups) {
        if (pk.taken) continue;
        if (H.dist(p.x, p.z, pk.x, pk.z) < 3) {
          pk.taken = true;
          if (pk.kind === 'health') { p.health = Math.min(CFG.playerHealth, p.health + 50); this.events.push({ kind: 'info', text: '+50 HEALTH', sub: 'Patched up.' }); }
          else { p.ammo += 24; this.events.push({ kind: 'info', text: '+24 AMMO', sub: 'Locked and loaded.' }); }
          SB.Audio.pickup();
        }
      }
    },
    updateMission: function (dt) {
      if (!this.mission) return;
      const m = this.mission;
      const p = this.player;
      const places = this.city.places;
      const near = (place, r) => H.dist(p.x, p.z, place.x, place.z) < r;
      if (this.missionIndex === 0) {
        if (m.stage === 0 && p.inCar) {
          m.stage = 1;
          this.missionTarget = { x: places.chopshop.x, z: places.chopshop.z };
          this.updateMarker();
          this.events.push({ kind: 'info', text: 'NICE WHEELS', sub: 'Now take it to the Chop Shop.' });
        } else if (m.stage === 1 && near(places.chopshop, 10)) {
          this.completeMission();
        }
      } else if (this.missionIndex === 1) {
        this.missionTarget = { x: places.docks.x, z: places.docks.z };
        this.updateMarker();
        // completion happens in damageEnemy via kills
      } else if (this.missionIndex === 2) {
        this.missionTarget = { x: places.hideout.x, z: places.hideout.z };
        this.updateMarker();
        if (this.wanted === 0) this.completeMission();
      } else if (this.missionIndex === 3) {
        if (m.stage === 0) {
          this.missionTarget = { x: places.diner.x, z: places.diner.z };
          this.updateMarker();
          if (near(places.diner, 8)) {
            m.stage = 1; m.package = true; m.timer = 90;
            this.events.push({ kind: 'info', text: 'PACKAGE SECURED', sub: '90 seconds to the Pier. Go!' });
            SB.Audio.pickup();
          }
        } else {
          this.missionTarget = { x: places.pier.x, z: places.pier.z };
          this.updateMarker();
          m.timer -= dt;
          if (near(places.pier, 10)) this.completeMission();
          else if (m.timer <= 0) this.failMission('The package went stale. Mama Lou is not happy.');
        }
      } else if (this.missionIndex === 4) {
        this.missionTarget = { x: places.tower.x, z: places.tower.z };
        this.updateMarker();
        // completion happens in damageEnemy via kills
      }
    },
    // ---------- save / load ----------
    save: function () {
      try {
        const p = this.player;
        const data = {
          money: Math.round(p.money), health: Math.round(p.health), ammo: p.ammo,
          missionIndex: this.missionIndex, x: Math.round(p.x), z: Math.round(p.z),
          won: this.won, savedAt: Date.now(),
        };
        localStorage.setItem(this.saveKey, JSON.stringify(data));
      } catch (e) { /* storage unavailable (file:// in some builds) */ }
    },
    load: function () {
      try {
        const raw = localStorage.getItem(this.saveKey);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    },
    applySave: function (data) {
      const p = this.player;
      p.money = data.money; p.health = data.health; p.ammo = data.ammo;
      p.x = data.x; p.z = data.z;
      this.won = !!data.won;
      // jump missions forward to the saved one
      this.thugs.forEach((t) => SB.Render.removeMesh(t.mesh));
      this.thugs = [];
      this.mission = null; this.missionTarget = null;
      this.wanted = 0;
      this.startMission(Math.min(data.missionIndex, MISSIONS.length - 1));
      if (data.missionIndex >= MISSIONS.length) {
        this.freeRoam = true; this.mission = null; this.missionTarget = null;
        SB.Render.setMarker(null);
      }
      this.events.push({ kind: 'info', text: 'SAVE LOADED', sub: '$' + p.money + ' · mission ' + Math.min(data.missionIndex + 1, 5) + '/5' });
    },
  };
  SB.World = World;
  SB.MISSIONS = MISSIONS;
})();
