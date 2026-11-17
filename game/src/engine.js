// Engine for Solmar Bay: renderer, game loop, hero, wanted system, combat,
// coins, save/load, camera, traffic-light cycle and the debug hooks the
// test driver uses (window.__game). State machine: menu -> playing ->
// paused. Everything else (city, vehicles, people, missions, hud, audio)
// is a module this class wires together.
import { City, CITY_BOUND } from './city.js';
import { Vehicles, makeCar } from './vehicles.js';
import { People } from './people.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;
const SAVE_KEY = 'solmar-bay-save-v1';

export class Engine {
  constructor(canvas, params) {
    this.params = params || {};
    this.lowFx = !!params.lowFx;
    this.time = 0;
    this.state = 'menu';
    this.cash = 200;
    this.wanted = 0;
    this.decayTimer = 0;
    this.autosaveTimer = 0;
    this.camMode = 0;
    this.camYaw = 0;
    this.shotMode = params.shot || null;
    this.shotFrames = 0;
    this.shotCruise = false;
    this.lightTimer = 0;
    this.nsGreen = true;
    this.footCops = [];
    this.bustedTimer = 0;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.lowFx });
    this.renderer.setPixelRatio(this.lowFx ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1e3a);
    this.scene.fog = new THREE.Fog(0x2a1e3a, 60, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 60, 140);

    const hemi = new THREE.HemisphereLight(0x8a7ab5, 0x1a1420, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xff9a4a, 1.4);
    sun.position.set(-120, 90, -60);
    this.scene.add(sun);

    this.city = new City();
    this.scene.add(this.city.group);
    this.vehicles = new Vehicles(this.city);
    this.traffic = this.vehicles; // alias: the test driver reads __game.traffic
    this.scene.add(this.vehicles.group);
    this.people = new People(this.city);
    this.scene.add(this.people.group);

    // Coins: gold spinning discs.
    this.coins = [];
    const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 12);
    const coinMat = new THREE.MeshLambertMaterial({ color: 0xd8a020, emissive: 0xaa7700, emissiveIntensity: 1 });
    for (const s of this.city.coinSpots) {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.position.set(s.x, 1, s.z);
      this.scene.add(mesh);
      this.coins.push({ x: s.x, z: s.z, mesh, taken: false });
    }

    // Mission marker beacon: a glowing pillar at the objective.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffdd33, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.beacon.position.y = 30;
    this.scene.add(this.beacon);

    // Hero.
    this.hero = {
      x: this.city.hideout.x, z: this.city.hideout.z + 12, y: 0,
      heading: Math.PI, vy: 0, onGround: true, hp: 100,
      punchCooldown: 0, walkPhase: 0, inCar: false, car: null,
    };
    this.hero.pos = this.hero;
    this.people.heroMesh.position.set(this.hero.x, 0, this.hero.z);

    this.missions = new Missions({
      hero: this.hero,
      city: this.city,
      people: this.people,
    });

    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.hud = new Hud({
      onStart: () => this.startGame(false),
      onContinue: () => this.startGame(true),
      onResume: () => this.togglePause(),
      onQuit: () => this.toMenu(),
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.hud.showMenu(this.hasSave());
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.hero.hp);
    this.hud.setStars(0);
    this.hud.setObjective('Press Start — Lena Cruz is waiting at the hideout');
    if (this.shotMode) {
      stageShot(this, this.shotMode);
      this.state = 'playing';
      this.hud.hideMenu();
    }
    this._last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  startGame(fromSave) {
    this.audio.init();
    if (fromSave) {
      try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (s) {
          this.cash = s.cash ?? 200;
          this.hero.hp = s.hp ?? 100;
          this.hero.x = s.x ?? this.city.hideout.x;
          this.hero.z = s.z ?? this.city.hideout.z;
          this.hero.heading = s.heading ?? Math.PI;
          this.missions.start(s.mission ?? 0);
          if (Array.isArray(s.coins)) {
            for (const i of s.coins) {
              if (this.coins[i]) { this.coins[i].taken = true; this.coins[i].mesh.visible = false; }
            }
          }
        }
      } catch (e) { /* corrupted save: start fresh */ }
    }
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.setObjective(this.missions.objective);
    this.hud.toast(this.missions.name + ': ' + this.missions.objective);
  }

  toMenu() {
    this.state = 'menu';
    this.hud.hidePause();
    this.hud.showMenu(this.hasSave());
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.save();
      this.hud.showPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.hidePause();
    }
  }

  save() {
    try {
      const taken = [];
      this.coins.forEach((c, i) => { if (c.taken) taken.push(i); });
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        hp: this.hero.hp,
        mission: this.missions.index,
        x: this.hero.x, z: this.hero.z, heading: this.hero.heading,
        coins: taken, time: this.time,
      }));
    } catch (e) { /* storage unavailable */ }
  }

  teleport(x, z) {
    this.hero.x = x;
    this.hero.z = z;
    this.hero.y = 0;
    this.hero.vy = 0;
    this.people.heroMesh.position.set(x, 0, z);
  }

  // Debug hook for the play-test: put the hero in a fresh car at (x, z).
  giveCar(type, x, z, heading) {
    const car = makeCar(0x3060b0, false);
    car.x = x;
    car.z = z;
    car.heading = heading || 0;
    car.sync();
    this.vehicles.group.add(car.mesh);
    this.vehicles.parked.push(car);
    this.enterCar(car);
    return car;
  }

  enterCar(car) {
    const list = this.vehicles.traffic;
    const ti = list.indexOf(car);
    if (ti >= 0) list.splice(ti, 1);
    const pi = this.vehicles.parked.indexOf(car);
    if (pi >= 0) this.vehicles.parked.splice(pi, 1);
    if (!car.owned) {
      car.owned = true;
      this.addWanted(1);
      this.hud.toast('Car stolen — wanted level up!');
    }
    this.hero.inCar = true;
    this.hero.car = car;
    this.people.heroMesh.visible = false;
  }

  exitCar() {
    const car = this.hero.car;
    if (!car) return;
    const side = 3.2;
    this.hero.x = car.x + Math.cos(car.heading) * side;
    this.hero.z = car.z - Math.sin(car.heading) * side;
    this.hero.y = 0;
    this.hero.inCar = false;
    this.hero.car = null;
    this.vehicles.parked.push(car);
    this.people.heroMesh.visible = true;
    this.people.heroMesh.position.set(this.hero.x, 0, this.hero.z);
  }

  addWanted(n) {
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    this.decayTimer = 0;
    this._syncPolice();
    this.hud.setStars(this.wanted);
  }

  _syncPolice() {
    const wantCruisers = Math.min(this.wanted, 4);
    while (this.vehicles.cruisers.length < wantCruisers) {
      const a = Math.random() * Math.PI * 2;
      const r = 90 + Math.random() * 40;
      this.vehicles.spawnCruiser(
        Math.max(-175, Math.min(175, this.hero.x + Math.sin(a) * r)),
        Math.max(-175, Math.min(175, this.hero.z + Math.cos(a) * r)),
      );
    }
    const wantCops = this.wanted >= 2 ? 2 : 0;
    while (this.footCops.length < wantCops) {
      const c = this.vehicles.cruisers[0];
      const x = c ? c.x + 4 : this.hero.x + 10;
      const z = c ? c.z + 4 : this.hero.z + 10;
      this.footCops.push(this._makeCop(x, z));
    }
    while (this.footCops.length > wantCops) {
      const cop = this.footCops.pop();
      this.scene.remove(cop.mesh);
    }
  }

  _makeCop(x, z) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), new THREE.MeshLambertMaterial({ color: 0x1a2a6a }));
    torso.position.y = 1.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a077 }));
    head.position.y = 1.82;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.24), new THREE.MeshLambertMaterial({ color: 0x141414 }));
    legs.position.y = 0.4;
    g.add(torso, head, legs);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return { mesh: g, x, z, heading: 0, hp: 40, attackCooldown: 0, bustedTimer: 0, alive: true };
  }

  punch() {
    if (this.hero.punchCooldown > 0) return;
    this.hero.punchCooldown = 0.45;
    this.audio.punch();
    const hx = this.hero.x;
    const hz = this.hero.z;
    const fx = Math.sin(this.hero.heading);
    const fz = Math.cos(this.hero.heading);
    const tryHit = (t, isBoss) => {
      if (!t.alive) return;
      const dx = t.x - hx;
      const dz = t.z - hz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 2.4) return;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.3) return;
      t.hp -= 34;
      this.audio.thud();
      if (t.hp <= 0) {
        this.people.killThug(t);
        this.cash += isBoss ? 0 : 50;
        this.hud.setCash(this.cash);
        if (!isBoss) this.hud.toast('Thug down — $50');
      }
    };
    for (const t of this.people.thugs) tryHit(t, false);
    if (this.people.boss) tryHit(this.people.boss, true);
    for (const cop of this.footCops) {
      if (!cop.alive) continue;
      const dx = cop.x - hx;
      const dz = cop.z - hz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 2.4) {
        cop.hp -= 34;
        if (cop.hp <= 0) {
          cop.alive = false;
          this.scene.remove(cop.mesh);
          this.cash += 25;
          this.hud.setCash(this.cash);
          this.hud.toast('Cop down — $25');
        }
      }
    }
  }

  _respawn(reason) {
    this.hero.x = this.city.hideout.x;
    this.hero.z = this.city.hideout.z + 12;
    this.hero.y = 0;
    this.hero.vy = 0;
    this.hero.hp = 100;
    this.hero.inCar = false;
    this.hero.car = null;
    this.people.heroMesh.visible = true;
    this.people.heroMesh.position.set(this.hero.x, 0, this.hero.z);
    this.wanted = 0;
    this.hud.setStars(0);
    for (const c of this.vehicles.cruisers.slice()) this.vehicles.removeCruiser(c);
    for (const cop of this.footCops) this.scene.remove(cop.mesh);
    this.footCops = [];
    this.hud.toast(reason);
  }

  debugState() {
    return {
      state: this.state,
      cash: Math.floor(this.cash),
      mission: this.missions.index,
      missionName: this.missions.name,
      wanted: this.wanted,
      hp: Math.round(this.hero.hp),
      speed: this.hero.inCar && this.hero.car ? Math.round(Math.abs(this.hero.car.speed) * 2.237) : 0,
      x: Math.round(this.hero.x * 10) / 10,
      z: Math.round(this.hero.z * 10) / 10,
      inCar: this.hero.inCar,
      time: Math.round(this.time * 10) / 10,
      coins: this.coins.filter((c) => c.taken).length,
    };
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    const rawDt = Math.min(0.25, (now - this._last) / 1000);
    this._last = now;
    const dt = Math.min(0.1, rawDt);
    this.input.beginFrame();
    if (this.state === 'playing') {
      this.time += dt;
      this._update(dt);
    } else if (this.state === 'menu') {
      this.time += dt * 0.2;
      const a = this.time * 0.05;
      this.camera.position.set(Math.sin(a) * 130, 70, Math.cos(a) * 130);
      this.camera.lookAt(this.city.tower.x, 40, this.city.tower.z);
      this._pulseBeacon(dt);
    }
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    if (this.shotMode) {
      this.shotFrames += 1;
      if (this.shotFrames >= 12 && !window.__shotReady) window.__shotReady = true;
    }
  }

  _pulseBeacon(dt) {
    if (this.city.beaconMat) {
      this.city.beaconMat.emissiveIntensity = 1.6 + Math.sin(this.time * 2.2) * 1.1;
    }
  }

  _update(dt) {
    const input = this.input;
    const hero = this.hero;

    // Pause (P or Escape) — edge-triggered, works from the paused state too.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      this.togglePause();
      return;
    }

    // Traffic lights cycle every 8 s.
    this.lightTimer += dt;
    if (this.lightTimer >= 8) {
      this.lightTimer = 0;
      this.nsGreen = !this.nsGreen;
      for (const tl of this.city.trafficLights) {
        tl.nsGreen = this.nsGreen;
        tl.redMat.emissiveIntensity = this.nsGreen ? 0.2 : 1.6;
        tl.greenMat.emissiveIntensity = this.nsGreen ? 1.6 : 0.2;
      }
    }
    this._pulseBeacon(dt);

    // Camera mode / horn / headlights / radio (edge-triggered).
    if (input.wasPressed('KeyC')) this.camMode = (this.camMode + 1) % 3;
    if (input.wasPressed('KeyH')) this.audio.horn();
    if (input.wasPressed('KeyN')) {
      const on = this.audio.toggleRadio();
      if (on) this.audio.setStation(this.audio.station + 1);
      this.hud.toast(on ? 'Radio: station ' + (this.audio.station + 1) : 'Radio off');
    }

    const axis = input.axis();
    hero.punchCooldown = Math.max(0, hero.punchCooldown - dt);

    if (hero.inCar && hero.car) {
      this._driveCar(dt, axis);
    } else {
      this._walkHero(dt, axis);
    }

    // Enter / exit car.
    if (input.wasPressed('KeyE')) {
      if (hero.inCar) {
        this.exitCar();
      } else {
        const car = this.vehicles.nearestCar(hero.x, hero.z, 4.5, true);
        if (car && !car.wrecked) this.enterCar(car);
      }
    }
    // Punch.
    if (input.wasPressed('KeyF') || input.wasPressed('Mouse0')) {
      if (!hero.inCar) this.punch();
    }

    // Mouse drag orbits the camera.
    this.camYaw += input.mouseDX * 0.004;

    // Traffic, peds, thugs, cops.
    this.vehicles.updateTraffic(dt, true);
    this.people.updatePeds(dt, hero.x, hero.z, hero.inCar || hero.punchCooldown > 0);
    this.people.updateThugs(dt, hero, (dmg) => this._damageHero(dmg));
    this._updateCops(dt);
    this.vehicles.updateCruisers(dt, { x: hero.x, z: hero.z, inCar: hero.inCar }, (cruiser) => {
      if (hero.car) {
        hero.car.damage += 8;
        this.audio.crash();
        if (hero.car.damage >= 100) {
          hero.car.wrecked = true;
          hero.car.speed = 0;
          this.hud.toast('Your car is wrecked!');
        }
      }
    }, this.time);

    // Coins.
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      const dx = c.x - hero.x;
      const dz = c.z - hero.z;
      if (dx * dx + dz * dz < 6.25) {
        c.taken = true;
        c.mesh.visible = false;
        this.cash += 40;
        this.audio.coin();
        this.hud.setCash(this.cash);
      }
    }

    // Missions.
    const ev = this.missions.update(dt);
    if (ev) {
      if (ev.done) {
        this.cash += ev.payout;
        this.audio.missionDone();
        this.hud.setCash(this.cash);
        this.hud.toast(`Mission complete: ${this.missions.name} — $${ev.payout}. ${ev.message || ''}`);
        this.hud.setObjective(this.missions.done ? 'Solmar Bay is yours, Lena.' : this.missions.objective);
        this.save();
      } else if (ev.failed) {
        this.hud.toast(ev.message);
      } else if (ev.progress) {
        if (ev.payout) { this.cash += ev.payout; this.hud.setCash(this.cash); }
        this.hud.toast(ev.message);
        this.hud.setObjective(this.missions.objective);
      }
    }

    // Wanted decay: 15 s with no police close.
    if (this.wanted > 0) {
      let near = false;
      for (const c of this.vehicles.cruisers) {
        const dx = c.x - hero.x;
        const dz = c.z - hero.z;
        if (dx * dx + dz * dz < 45 * 45) { near = true; break; }
      }
      if (!near) {
        for (const cop of this.footCops) {
          const dx = cop.x - hero.x;
          const dz = cop.z - hero.z;
          if (dx * dx + dz * dz < 20 * 20) { near = true; break; }
        }
      }
      if (!near) {
        this.decayTimer += dt;
        if (this.decayTimer > 15) {
          this.decayTimer = 0;
          this.addWanted(-1);
        }
      } else {
        this.decayTimer = 0;
      }
    }
    // Despawn far cruisers once the heat is off.
    if (this.wanted === 0) {
      for (const c of this.vehicles.cruisers.slice()) {
        const dx = c.x - hero.x;
        const dz = c.z - hero.z;
        if (dx * dx + dz * dz > 90 * 90) this.vehicles.removeCruiser(c);
      }
    }

    // Autosave every 30 s.
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 30) {
      this.autosaveTimer = 0;
      this.save();
    }

    // HUD + audio.
    this.hud.setCash(this.cash);
    this.hud.setHealth(hero.hp);
    this.hud.setStars(this.wanted);
    this.hud.setClock(this.time);
    this.hud.setSpeed(hero.inCar && hero.car ? Math.abs(hero.car.speed) * 2.237 : 0, hero.inCar);
    this.hud.setObjective(this.missions.done ? 'Solmar Bay is yours, Lena.' : this.missions.objective + (this.missions.index === 1 ? ` — ${Math.ceil(this.missions.timer)}s left` : ''));
    this.hud.drawMinimap({
      hero,
      traffic: this.vehicles.traffic,
      cruisers: this.vehicles.cruisers,
      coins: this.coins,
      marker: this.missions.marker,
    });
    const m = this.missions.marker;
    if (m) {
      this.beacon.visible = true;
      this.beacon.position.set(m.x, 30, m.z);
    } else {
      this.beacon.visible = false;
    }
    this.audio.update(dt, hero.inCar && hero.car ? Math.abs(hero.car.speed) / 26 : 0, hero.inCar, this.wanted);

    this._updateCamera(dt);
    this._syncHeroMesh(dt);
  }

  _walkHero(dt, axis) {
    const hero = this.hero;
    const speed = (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight')) ? 7 : 4;
    const mx = axis.x;
    const mz = axis.y;
    if (mx !== 0 || mz !== 0) {
      // Camera-relative movement: forward is away from the camera.
      const camH = Math.atan2(this.camera.position.x - hero.x, this.camera.position.z - hero.z);
      const moveH = camH + Math.PI + Math.atan2(mx, mz);
      const tx = Math.sin(moveH);
      const tz = Math.cos(moveH);
      hero.x += tx * speed * dt;
      hero.z += tz * speed * dt;
      let dh = moveH - hero.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      hero.heading += Math.max(-10 * dt, Math.min(10 * dt, dh));
      hero.walkPhase += speed * dt * 2.2;
    }
    // Jump. Exact kinematic update (y += vy*dt - 0.5*g*dt^2) so the peak
    // height is the same at any frame rate, even with the dt clamp.
    if (this.input.wasPressed('Space') && hero.onGround) {
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
    const hit = this.city.collide(hero.x, hero.z, 0.6);
    if (hit) { hero.x += hit.x; hero.z += hit.z; }
    hero.x = Math.max(-182, Math.min(182, hero.x));
    hero.z = Math.max(-182, Math.min(195, hero.z));
  }

  _driveCar(dt, axis) {
    const car = this.hero.car;
    const hero = this.hero;
    if (this.shotCruise) {
      // Staged screenshots: cruise straight along the road at a fixed speed.
      car.speed = Math.min(14, car.speed + 8 * dt);
    } else if (axis.y > 0) {
      car.speed = Math.min(26, car.speed + 14 * dt);
    } else if (axis.y < 0) {
      car.speed = Math.max(-8, car.speed - 18 * dt);
    } else {
      car.speed *= Math.max(0, 1 - 1.5 * dt);
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    const steer = axis.x * (car.speed >= 0 ? 1 : -1);
    const turnRate = 1.9 * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
    car.heading += steer * turnRate * dt * Math.sign(car.speed || 1);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const hit = this.city.collide(car.x, car.z, 2.2);
    if (hit) {
      car.x += hit.x;
      car.z += hit.z;
      if (Math.abs(car.speed) > 10) {
        car.damage += 2;
        this.audio.crash();
      }
      car.speed *= 0.6;
    }
    car.x = Math.max(-182, Math.min(182, car.x));
    car.z = Math.max(-182, Math.min(195, car.z));
    car.sync();
    hero.x = car.x;
    hero.z = car.z;
    hero.heading = car.heading;
  }

  _updateCops(dt) {
    const hero = this.hero;
    for (const cop of this.footCops) {
      if (!cop.alive) continue;
      cop.attackCooldown = Math.max(0, cop.attackCooldown - dt);
      const dx = hero.x - cop.x;
      const dz = hero.z - cop.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (hero.inCar) {
        // Cops cannot catch a car: fall back towards the nearest cruiser.
        const c = this.vehicles.cruisers[0];
        if (c) {
          const cdx = c.x - cop.x;
          const cdz = c.z - cop.z;
          const cd = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
          cop.x += (cdx / cd) * 4 * dt;
          cop.z += (cdz / cd) * 4 * dt;
        }
      } else if (d > 2.1) {
        const wantH = Math.atan2(dx, dz);
        let dh = wantH - cop.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        cop.heading += Math.max(-3.5 * dt, Math.min(3.5 * dt, dh));
        cop.x += Math.sin(cop.heading) * 4.2 * dt;
        cop.z += Math.cos(cop.heading) * 4.2 * dt;
      } else {
        if (cop.attackCooldown <= 0) {
          cop.attackCooldown = 1.15;
          this._damageHero(6);
        }
        cop.bustedTimer += dt;
        if (cop.bustedTimer > 1.5) {
          this.cash = Math.max(0, this.cash - 100);
          this.hud.setCash(this.cash);
          this._respawn('Busted! You lost $100.');
          return;
        }
      }
      if (d > 2.5) cop.bustedTimer = 0;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    }
  }

  _damageHero(dmg) {
    this.hero.hp -= dmg;
    this.audio.thud();
    this.hud.setHealth(this.hero.hp);
    if (this.hero.hp <= 0) {
      this.cash = Math.max(0, this.cash - 200);
      this.hud.setCash(this.cash);
      this._respawn('Wasted! Hospital bill: $200.');
    }
  }

  _updateCamera(dt) {
    const hero = this.hero;
    const mode = this.camMode;
    const dist = mode === 0 ? 9 : mode === 1 ? 15 : 7;
    const height = mode === 0 ? 4 : mode === 1 ? 7.5 : 15;
    const back = hero.heading + Math.PI + this.camYaw;
    const tx = hero.x + Math.sin(back) * dist;
    const tz = hero.z + Math.cos(back) * dist;
    const k = 1 - Math.exp(-6 * dt);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    const lookX = hero.x + Math.sin(hero.heading) * 4;
    const lookZ = hero.z + Math.cos(hero.heading) * 4;
    this.camera.lookAt(lookX, 1.5, lookZ);
  }

  _syncHeroMesh(dt) {
    const hero = this.hero;
    const mesh = this.people.heroMesh;
    if (hero.inCar) return;
    mesh.position.set(hero.x, hero.y, hero.z);
    mesh.rotation.y = hero.heading;
    const swing = Math.sin(hero.walkPhase) * 0.5;
    mesh.userData.legL.rotation.x = swing;
    mesh.userData.legR.rotation.x = -swing;
    mesh.userData.armL.rotation.x = -swing * 0.8;
    mesh.userData.armR.rotation.x = swing * 0.8;
  }
}
