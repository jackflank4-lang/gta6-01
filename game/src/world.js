// Solmar Bay — rules and state: player, cars, traffic + ped AI, foot cops,
// police + wanted, car damage, combat, the 5-mission story, neon coins,
// economy, and save/load. No drawing here — rendering lives in render.js.
// Rebuild r2: same story spine as v1, new systems (foot cops, damage +
// repair, honking/overtaking traffic, coins, boss reinforcements).
(function () {
  'use strict';
  window.SB = window.SB || {};
  const CFG = SB.CFG;
  const H = SB.CityHelpers;

  const MISSIONS = [
    {
      name: '1 · HOT WHEELS',
      intro: 'Mama Lou: "Dax, baby — I need wheels. Steal any car, bring it to the Chop Shop in one piece and there is a bonus in it."',
      objective: 'Steal any car, deliver it to the Chop Shop (undamaged: +$100)',
    },
    {
      name: '2 · PAYBACK',
      intro: 'Mama Lou: "Kingfish boys are leaning on my dock workers. Go sort them out — all three."',
      objective: 'Deal with the Kingfish thugs at the Solmar Docks (3)',
    },
    {
      name: '3 · HEAT RUN',
      intro: 'Mama Lou: "The PD is on you, Dax. Lose them — get to the Hideout and lay low till it blows over."',
      objective: 'Lose the cops and reach the Hideout',
    },
    {
      name: '4 · THE DROP',
      intro: 'Mama Lou: "Package at the Diner. Pier by sunset — 90 seconds, no excuses, no dents."',
      objective: 'Pick up the package at the Diner, deliver it to the Pier',
    },
    {
      name: '5 · KINGFISH FALLS',
      intro: 'Mama Lou: "Time to end this. Kingfish is at his Tower with his crew. Take them all, take the vault."',
      objective: 'Take down the Kingfish crew at the Tower (6)',
    },
  ];

  const World = {
    city: null, rng: null,
    screen: 'menu',
    time: 0,
    player: null,
    cars: [], peds: [], thugs: [], footCops: [], pickups: [], coins: [],
    wanted: 0, wantedTimer: 0, bustTimer: 0, hideTimer: 0,
    missionIndex: 0, mission: null, missionTarget: null,
    camYaw: 0, cameraMode: 0,
    events: [], // {kind, text, sub} consumed by main for toasts
    saveKey: 'solmarbay.save.v1',
    shootCooldown: 0, punchCooldown: 0, saveTimer: 0, lastHurt: -99,
    won: false, freeRoam: false, bossReinforced: false,
    coinsGot: 0,

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
      for (const f of this.footCops) SB.Render.removeMesh(f.mesh);
      for (const c of this.coins) SB.Render.removeMesh(c.mesh);
      SB.Render.coinMeshes = [];
      this.cars = []; this.peds = []; this.thugs = []; this.footCops = [];
      this.pickups = []; this.coins = [];
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
      this.bossReinforced = false; this.coinsGot = 0;
      this.saveTimer = 20; // first auto-save after 20s of play, not on frame 1
      this.events = [];
      this.spawnTraffic();
      this.spawnPeds();
      this.spawnParkedCars();
      this.spawnPickups();
      this.spawnCoins();
      this.startMission(0);
    },
    // ---------- spawning ----------
    spawnTraffic: function () {
      for (let i = 0; i < CFG.trafficCars; i++) {
        const car = this.makeCar(false);
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
        const car = this.makeCar(false);
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
    spawnCoins: function () {
      for (const spot of this.city.coins) {
        const mesh = SB.Render.makeCoin(spot.x, spot.z);
        this.coins.push({ x: spot.x, z: spot.z, taken: false, mesh: mesh });
      }
    },
    makeCar: function (isPolice) {
      const color = isPolice ? SB.PALETTE.police : this.rng.pick(SB.PALETTE.car);
      const mesh = SB.Render.makeCar(color, isPolice);
      return {
        id: 'c' + Math.floor(this.rng.next() * 1e9).toString(36),
        x: 0, z: 0, angle: 0, speed: 0, color: color,
        isPolice: !!isPolice, active: true, driver: null, parked: false,
        mesh: mesh, target: null, steer: 0,
        damage: 0, smokeCd: 0, honkCd: 0, laneOff: 0,
      };
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
    makeFootCop: function () {
      const mesh = SB.Render.makeFootCop();
      return {
        x: 0, z: 0, angle: 0, hp: 80, speed: 0, moving: false,
        phase: this.rng.range(0, 6), target: null, attackCd: 0, dead: false,
        flash: 0, mesh: mesh, isCop: true,
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
      // clear any leftover mission enemies before staging the new mission
      this.thugs.forEach((t) => SB.Render.removeMesh(t.mesh));
      this.thugs = [];
      this.bossReinforced = false;
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
        t.hp = boss && i === 0 ? CFG.bossHp : 60;
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
      let reward = CFG.missionRewards[this.missionIndex];
      let bonusText = '';
      if (this.missionIndex === 0) {
        // undamaged delivery bonus: the car you are sitting in
        const car = this.cars.find((c) => c.id === this.player.carId);
        if (car && car.damage < 10) {
          reward += CFG.undamagedBonus;
          bonusText = '  ·  +$' + CFG.undamagedBonus + ' undamaged bonus';
        }
      }
      this.player.money += reward;
      this.player.ammo += 24;
      this.events.push({ kind: 'reward', text: 'MISSION COMPLETE', sub: '+' + '$' + reward + '  ·  +24 ammo' + bonusText });
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
    // ---------- wanted + police ----------
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
        const car = this.makeCar(true);
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
      // foot cops: one per wanted star (max 4), only while the player is on foot
      const wantFoot = (this.wanted > 0 && !this.player.inCar) ? Math.min(4, this.wanted) : 0;
      const haveFoot = this.footCops.filter((f) => !f.dead).length;
      for (let i = haveFoot; i < wantFoot; i++) {
        const f = this.makeFootCop();
        const a = this.rng.range(0, Math.PI * 2);
        const d = this.rng.range(20, 40);
        const s = H.snapToRoad(this.player.x + Math.sin(a) * d, this.player.z + Math.cos(a) * d);
        const c = H.collideCircle(this.city, s.x, s.z, 1);
        f.x = c.x; f.z = c.z;
        f.angle = Math.atan2(this.player.x - f.x, this.player.z - f.z);
        this.footCops.push(f);
      }
      if (wantFoot === 0) {
        for (const f of this.footCops) SB.Render.removeMesh(f.mesh);
        this.footCops = [];
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
        this.events.push({ kind: 'info', text: 'OUT OF AMMO', sub: 'Find an ammo crate — at the Hideout and Chop Shop.' });
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
      for (const f of this.footCops) consider(f);
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
      for (const f of this.footCops) consider(f);
      for (const pd of this.peds) consider(pd);
      if (best) this.damageEnemy(best, CFG.punchDamage, false);
    },
    damageEnemy: function (e, dmg, wasShot) {
      e.hp -= dmg;
      e.flash = 0.15;
      if (e.isThug && wasShot) this.scarePeds(e.x, e.z, 30);
      // the boss calls reinforcements at half health, once
      if (e.isBoss && !this.bossReinforced && e.hp > 0 && e.hp <= CFG.bossHp / 2) {
        this.bossReinforced = true;
        this.events.push({ kind: 'info', text: 'KINGFISH CALLS BACKUP', sub: 'Two more crew just ran in!' });
        SB.Audio.radio();
        const at = this.city.places.tower;
        for (let i = 0; i < 2; i++) {
          const t = this.makePed(true);
          t.x = at.x + this.rng.range(-14, 14);
          t.z = at.z + this.rng.range(-14, 14);
          const c = H.collideCircle(this.city, t.x, t.z, 1);
          t.x = c.x; t.z = c.z;
          this.thugs.push(t);
        }
        if (this.mission) this.mission.need += 2;
      }
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
        } else if (e.isCop) {
          this.addWanted(1);
          this.events.push({ kind: 'info', text: 'COP DOWN', sub: 'That will not help your case.' });
        } else {
          this.addWanted(1);
        }
        this.thugs = this.thugs.filter((t) => !t.dead);
        this.footCops = this.footCops.filter((f) => !f.dead);
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
    // ---------- car enter / exit / damage ----------
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
      SB.Audio.door();
      SB.Audio.engineStart();
      // foot cops give up once you are in a car
      for (const f of this.footCops) SB.Render.removeMesh(f.mesh);
      this.footCops = [];
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
      SB.Audio.door();
      this.syncPolice(); // foot cops may join the chase now
    },
    damageCar: function (car, amount) {
      if (!car || car.isPolice) return;
      car.damage = Math.min(CFG.carMaxDamage, car.damage + amount);
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
      this.updateFootCops(dt);
      this.updatePolice(dt);
      this.updateWanted(dt);
      this.updatePickups(dt);
      this.updateCoins(dt);
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
      p.speed = moving ? speed : 0;
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
      // damage caps the top speed: smoking cars limp
      const cap = car.damage >= 85 ? 14 : car.damage >= 60 ? 30 : CFG.carMaxSpeed;
      if (fwd > 0) car.speed += CFG.carAccel * dt;
      else if (fwd < 0) {
        if (car.speed > 0.5) car.speed -= CFG.carBrake * dt;
        else car.speed -= CFG.carAccel * 0.5 * dt;
      } else {
        car.speed -= Math.sign(car.speed) * 12 * dt;
        if (Math.abs(car.speed) < 0.5) car.speed = 0;
      }
      if (input.down('Space')) {
        car.speed -= Math.sign(car.speed) * 30 * dt;
        if (Math.abs(car.speed) > 14 && Math.random() < 0.3) SB.Audio.skid();
      }
      car.speed = Math.max(-CFG.carMaxReverse, Math.min(cap, car.speed));
      const turn = steer * CFG.carTurn * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed || 1);
      car.angle += turn;
      const nx = car.x + Math.sin(car.angle) * car.speed * dt;
      const nz = car.z + Math.cos(car.angle) * car.speed * dt;
      const c = H.collideCircle(this.city, nx, nz, CFG.carRadius);
      if (c.x !== nx || c.z !== nz) {
        if (Math.abs(car.speed) > 12) {
          SB.Audio.crash();
          this.damageCar(car, Math.abs(car.speed) * 0.4);
        }
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
          if (Math.abs(car.speed) > 10) {
            SB.Audio.crash();
            car.speed *= 0.7;
            this.damageCar(car, 5);
          }
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
      // damage smoke
      if (car.damage >= 60) {
        car.smokeCd -= dt;
        if (car.smokeCd <= 0) {
          car.smokeCd = 0.12;
          SB.Render.spawnSmoke(car.x, 1.2, car.z);
        }
      }
      // Chop Shop repair: hold H near the shop, $1.50 per damage point
      const chop = this.city.places.chopshop;
      if (car.damage > 0 && H.dist(car.x, car.z, chop.x, chop.z) < 14) {
        if (input.down('KeyH') && p.money > 0) {
          const fix = Math.min(25 * dt, car.damage, p.money / 1.5);
          car.damage -= fix;
          p.money -= fix * 1.5;
          if (Math.random() < 0.1) SB.Audio.repair();
          if (car.damage <= 0) {
            car.damage = 0;
            this.events.push({ kind: 'info', text: 'CAR REPAIRED', sub: 'Fresh paint, fresh start.' });
          }
        }
      }
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
        if (car.honkCd > 0) car.honkCd -= dt;
        const t = car.target;
        const dx = t.x - car.x, dz = t.z - car.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 4) {
          const node = { x: t.x, z: t.z };
          car.target = this.randomNeighbour(node);
          car.laneOff = 0;
          continue;
        }
        const wantAngle = Math.atan2(dx, dz);
        const da = H.angleDiff(car.angle, wantAngle);
        car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, da));
        // slow for a car ahead; honk and overtake if it stays slow
        let slow = false, blockedBy = null;
        for (const o of this.cars) {
          if (o === car || !o.active) continue;
          const odx = o.x - car.x, odz = o.z - car.z;
          const od = Math.sqrt(odx * odx + odz * odz);
          const ahead = (odx * Math.sin(car.angle) + odz * Math.cos(car.angle)) / Math.max(0.001, od);
          if (od < CFG.honkDist && ahead > 0.7) { slow = true; blockedBy = o; break; }
        }
        if (slow) {
          if (car.honkCd <= 0) {
            car.honkCd = 3;
            SB.Audio.tone(370, 0.16, 'square', 0.1);
            setTimeout(() => SB.Audio.tone(370, 0.16, 'square', 0.1), 200);
          }
          // overtake: swing to the side lane while blocked
          if (car.laneOff === 0) car.laneOff = this.rng.chance(0.5) ? 5 : -5;
        } else if (car.laneOff !== 0) {
          car.laneOff *= Math.max(0, 1 - dt * 2);
          if (Math.abs(car.laneOff) < 0.2) car.laneOff = 0;
        }
        const targetSpeed = slow ? 0 : CFG.trafficSpeed;
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
        // lane offset is perpendicular to the heading
        const px = Math.cos(car.angle) * car.laneOff, pz = -Math.sin(car.angle) * car.laneOff;
        car.x += Math.sin(car.angle) * car.speed * dt + px * dt * 0.5;
        car.z += Math.cos(car.angle) * car.speed * dt + pz * dt * 0.5;
        if (blockedBy && H.dist(car.x, car.z, blockedBy.x, blockedBy.z) < 4.4) {
          // never overlap the car ahead: hold position
          car.x -= Math.sin(car.angle) * car.speed * dt;
          car.z -= Math.cos(car.angle) * car.speed * dt;
        }
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
    updateFootCops: function (dt) {
      const p = this.player;
      let cornered = false;
      for (const f of this.footCops) {
        if (f.dead || f.hp <= 0) continue;
        if (f.flash > 0) f.flash -= dt;
        const d = H.dist(p.x, p.z, f.x, f.z);
        // foot cops only hunt on foot; if the player drives off they hold position
        if (p.inCar) { f.moving = false; continue; }
        if (d > 2.2) {
          const dx = p.x - f.x, dz = p.z - f.z;
          const dd = Math.max(0.001, d);
          f.angle = Math.atan2(dx / dd, dz / dd);
          f.x += (dx / dd) * CFG.footCopSpeed * dt;
          f.z += (dz / dd) * CFG.footCopSpeed * dt;
          f.moving = true;
        } else {
          f.moving = false;
          if (f.attackCd <= 0) {
            f.attackCd = 1.0;
            this.hurtPlayer(CFG.footCopPunch);
            SB.Audio.punch();
          }
          // cornered on foot: bust timer runs (once per frame, not per cop)
          cornered = true;
        }
        if (f.attackCd > 0) f.attackCd -= dt;
        const c = H.collideCircle(this.city, f.x, f.z, 0.9);
        f.x = c.x; f.z = c.z;
        const cl = H.clampCity(f.x, f.z, 0);
        f.x = cl.x; f.z = cl.z;
      }
      if (cornered) {
        this.bustTimer += dt;
        if (this.bustTimer >= CFG.bustTime) this.busted();
      }
      this.footCops = this.footCops.filter((f) => !f.dead);
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
        const da = H.angleDiff(car.angle, wantAngle);
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
            this.damageCar(pc, 3);
            this.hurtPlayer(2);
          }
        } else if (d < CFG.bustDist) {
          // on foot: cornered by a car
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
      if (!this.nearPolice(CFG.wantedDecayDist) && this.footCops.length === 0) {
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
    updateCoins: function (dt) {
      const p = this.player;
      for (const c of this.coins) {
        if (c.taken) continue;
        if (H.dist(p.x, p.z, c.x, c.z) < 2.5) {
          c.taken = true;
          SB.Render.removeMesh(c.mesh);
          this.coinsGot++;
          p.money += CFG.coinValue;
          this.events.push({ kind: 'info', text: '+$' + CFG.coinValue + ' NEON COIN', sub: this.coinsGot + ' of ' + CFG.coinsTotal + ' found.' });
          SB.Audio.coin();
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
          this.events.push({ kind: 'info', text: 'NICE WHEELS', sub: 'Now take it to the Chop Shop — in one piece for the bonus.' });
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
          won: this.won, coinsGot: this.coinsGot,
          coinsTaken: this.coins.map((c, i) => (c.taken ? i : -1)).filter((i) => i >= 0),
          cameraMode: this.cameraMode, savedAt: Date.now(),
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
      this.coinsGot = data.coinsGot || 0;
      if (data.coinsTaken) {
        for (const i of data.coinsTaken) {
          const c = this.coins[i];
          if (c && !c.taken) { c.taken = true; SB.Render.removeMesh(c.mesh); }
        }
      }
      if (typeof data.cameraMode === 'number') {
        this.cameraMode = data.cameraMode;
        SB.Render.setCameraMode(data.cameraMode);
      }
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
