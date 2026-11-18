// Engine for Solmar Bay — Neon Heat.
// Owns the renderer, the fixed-timestep loop, the wanted system, coins,
// the camera, save/load, and the debug API the test driver uses.
// Substepping keeps game time close to real time even when the software
// renderer only manages a few frames a second.
const THREE = window.THREE;
import { Rng } from './rng.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { buildCity } from './city.js';
import { TrafficSystem } from './vehicles.js';
import { PeopleSystem } from './people.js';
import { MissionSystem } from './missions.js';
import { Hud } from './hud.js';

const FIXED_DT = 1 / 60;
const MAX_SUBSTEPS = 40;

export class Engine {
  constructor(container, opts) {
    this.opts = opts || {};
    this.seed = this.opts.seed || 777;
    this.rng = new Rng(this.seed);
    this.container = container;
    this.state = 'menu'; // menu | playing | paused | busted | wasted
    this.time = 0;
    this.clockMinutes = 18 * 60 + 30; // 18:30, dusk
    this.cash = 200;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.lastCrimeAt = -100;
    this.camMode = 0; // 0 chase, 1 high, 2 close
    this.camYaw = Math.PI;
    this.camPos = new THREE.Vector3(-110, 4, 88);
    this.frameCount = 0;
    this.autosaveTimer = 0;
    this.headlights = false;
    this.headlight = null;
    this.coinMeshes = [];
    this.markerBeacon = null;
    this.pausedAt = 0;

    // --- renderer -----------------------------------------------------
    const fxLow = !!this.opts.fxLow;
    this.renderer = new THREE.WebGLRenderer({ antialias: !fxLow, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (!fxLow) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x241640);
    this.scene.fog = new THREE.FogExp2(0x2a1a44, 0.0028);
    this.camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 1200);

    // --- lights -------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0x8a6fd8, 0x1a1a2e, 0.75);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xff8a5c, 1.7);
    sun.position.set(140, 90, -70);
    sun.castShadow = !fxLow;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    sun.shadow.camera.far = 500;
    this.scene.add(sun);
    this.sun = sun;

    // --- systems ------------------------------------------------------
    this.input = new Input(window);
    this.sound = new SoundBank();
    this.city = buildCity(this.scene, this.seed);
    this.traffic = new TrafficSystem(this.scene, this.city, this.rng, {
      onCrash: (car) => {
        if (car === this.traffic.playerCar) {
          car.damage = Math.min(100, car.damage + 8);
          this.sound.crash();
        }
      },
      onRam: (cruiser) => {
        if (this.traffic.playerCar) {
          this.traffic.playerCar.damage = Math.min(100, this.traffic.playerCar.damage + 2);
          const pc = this.traffic.playerCar;
          pc.pos.x += Math.sin(pc.heading) * 0.4;
          pc.pos.z += Math.cos(pc.heading) * 0.4;
        } else if (this.people.hero.onFoot) {
          this.people.hurtHero(4);
        }
      },
    });
    this.traffic.spawnInitial();
    this.people = new PeopleSystem(this.scene, this.city, this.rng, {
      onHeroHurt: (hp) => {
        this.hud.setHealth(hp);
        if (hp <= 0) this.wasted();
      },
      onBusted: () => this.busted(),
      onCopDown: () => this.addWanted(2),
      onThugKilled: () => {
        this.cash += 50;
        this.hud.setCash(this.cash);
        this.hud.toast('Thug down. +$50');
        this.missions.onThugKilled();
      },
      onBossKilled: () => {
        this.missions.onBossKilled();
      },
    });
    this.people.heroMesh();
    this.missions = new MissionSystem({
      city: this.city,
      people: this.people,
      traffic: this.traffic,
      onComplete: (idx, payout, bonus) => {
        this.cash += payout + bonus;
        this.hud.setCash(this.cash);
        this.hud.toast('Mission complete! +$' + (payout + bonus));
        this.sound.missionDone();
        this.saveGame();
      },
      onToast: (msg) => this.hud.toast(msg),
      onObjective: (text) => this.hud.setObjective(text),
    });
    this.hud = new Hud(document);

    // --- coins --------------------------------------------------------
    const coinGeo = new THREE.TorusGeometry(0.55, 0.2, 10, 18);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd23a, emissive: 0xa87800, metalness: 0.9, roughness: 0.25,
    });
    this.city.coins.forEach((coin) => {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.position.set(coin.x, 1.2, coin.z);
      m.rotation.y = Math.PI / 2;
      this.scene.add(m);
      coin.mesh = m;
      this.coinMeshes.push(m);
    });

    // --- mission beacon ----------------------------------------------
    const beaconGeo = new THREE.CylinderGeometry(1.4, 1.4, 46, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd23a, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
    });
    this.markerBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.markerBeacon.position.y = 23;
    this.markerBeacon.visible = false;
    this.scene.add(this.markerBeacon);

    // --- menus --------------------------------------------------------
    this.bindMenus();
    this.hud.showMenu('start');
    this.hud.setCash(this.cash);
    this.hud.setHealth(100);
    this.hud.setStars(0);
    this.hud.setClock(this.clockMinutes);
    this.hud.setObjective('Press Start to begin.');
    this.hud.setStation(this.sound.currentStation());

    window.addEventListener('resize', () => this.onResize());
    this.lastT = performance.now();
    this.running = false;
  }

  bindMenus() {
    const $ = (id) => document.getElementById(id);
    const startBtn = $('btn-start');
    if (startBtn) startBtn.addEventListener('click', () => this.newGame());
    const contBtn = $('btn-continue');
    if (contBtn) contBtn.addEventListener('click', () => this.continueGame());
    const resumeBtn = $('btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.resume());
    const restartBtn = $('btn-restart');
    if (restartBtn) restartBtn.addEventListener('click', () => this.newGame());
    const retryBtn = $('btn-retry');
    if (retryBtn) retryBtn.addEventListener('click', () => this.resume());
    if (contBtn) contBtn.style.display = Hud.hasSave() ? 'inline-block' : 'none';
  }

  onResize() {
    const w = this.container.clientWidth || 1280;
    const h = this.container.clientHeight || 720;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // --- game flow ------------------------------------------------------
  newGame() {
    this.sound.ensure();
    this.cash = 200;
    this.people.hero.hp = 100;
    this.people.hero.pos.set(-110, 0, 96);
    this.people.hero.heading = Math.PI;
    this.people.hero.onFoot = true;
    this.people.clearEnemies();
    this.traffic.despawnCruisers();
    if (this.traffic.playerCar) this.traffic.exitCar();
    this.wanted = 0;
    this.wantedTimer = 0;
    this.clockMinutes = 18 * 60 + 30;
    this.time = 0;
    this.city.coins.forEach((c) => { c.taken = false; if (c.mesh) c.mesh.visible = true; });
    this.hud.setCash(this.cash);
    this.hud.setHealth(100);
    this.hud.setStars(0);
    this.hud.setClock(this.clockMinutes);
    this.missions.start(0);
    this.state = 'playing';
    this.hud.showMenu(null);
    this.hud.toast('Welcome to Solmar Bay, Lena. Steal a car.');
    this.snapCamera();
    if (this.sound.ready()) this.sound.startRadio();
  }

  continueGame() {
    const save = Hud.load();
    if (!save) {
      this.newGame();
      return;
    }
    this.sound.ensure();
    this.cash = save.cash || 200;
    this.people.hero.hp = save.hp || 100;
    this.people.hero.pos.set(save.pos ? save.pos.x : -110, 0, save.pos ? save.pos.z : 96);
    this.people.hero.onFoot = true;
    this.clockMinutes = save.clock || 1110;
    this.time = save.time || 0;
    if (Array.isArray(save.coins)) {
      save.coins.forEach((i) => {
        const c = this.city.coins[i];
        if (c) { c.taken = true; if (c.mesh) c.mesh.visible = false; }
      });
    }
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.people.hero.hp);
    this.hud.setClock(this.clockMinutes);
    this.missions.start(save.mission || 0);
    this.state = 'playing';
    this.hud.showMenu(null);
    this.hud.toast('Welcome back, Lena.');
    this.snapCamera();
    if (this.sound.ready()) this.sound.startRadio();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showMenu('pause');
    this.saveGame();
  }

  resume() {
    if (this.state !== 'playing') {
      this.state = 'playing';
      this.hud.showMenu(null);
    }
  }

  busted() {
    if (this.state !== 'playing') return;
    this.cash = Math.max(0, this.cash - 100);
    this.wanted = 0;
    this.wantedTimer = 0;
    this.traffic.despawnCruisers();
    this.people.clearEnemies();
    if (this.traffic.playerCar) this.traffic.exitCar();
    this.people.hero.pos.set(this.city.hideout.x, 0, this.city.hideout.z + 8);
    this.people.hero.hp = 100;
    this.people.hero.onFoot = true;
    this.hud.setCash(this.cash);
    this.hud.setHealth(100);
    this.hud.setStars(0);
    this.hud.setEnd('BUSTED', 'The cops dragged you out of the car. Fine: $100. The crew is waiting at the Hideout.');
    this.state = 'busted';
    this.hud.showMenu('end');
    this.sound.busted();
    this.sound.siren(false);
    this.saveGame();
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.cash = Math.max(0, this.cash - 200);
    this.wanted = 0;
    this.wantedTimer = 0;
    this.traffic.despawnCruisers();
    this.people.clearEnemies();
    if (this.traffic.playerCar) this.traffic.exitCar();
    this.people.hero.pos.set(this.city.hideout.x, 0, this.city.hideout.z + 8);
    this.people.hero.hp = 100;
    this.people.hero.onFoot = true;
    this.hud.setCash(this.cash);
    this.hud.setHealth(100);
    this.hud.setStars(0);
    this.hud.setEnd('WASTED', 'You blacked out on the street. Hospital bill: $200. Back on your feet at the Hideout.');
    this.state = 'wasted';
    this.hud.showMenu('end');
    this.sound.busted();
    this.sound.siren(false);
    this.saveGame();
  }

  addWanted(n) {
    if (this.state !== 'playing') return;
    const before = this.wanted;
    this.wanted = Math.min(5, this.wanted + n);
    this.lastCrimeAt = this.time;
    this.wantedTimer = 25;
    this.hud.setStars(this.wanted);
    if (this.wanted > before) {
      const need = Math.min(this.wanted, 4) - this.traffic.cruisers.length;
      for (let i = 0; i < need; i++) {
        this.traffic.spawnCruiser(this.people.hero.pos);
      }
      if (this.wanted >= 2 && this.people.hero.onFoot && this.people.cops.length < 2) {
        const p = this.city.randomRoadPoint(this.rng);
        this.people.spawnFootCop({ x: p.x, z: p.z });
      }
      if (this.wanted >= 3) this.hud.toast('The whole bay is looking for you.');
    }
  }

  saveGame() {
    const taken = [];
    this.city.coins.forEach((c, i) => { if (c.taken) taken.push(i); });
    Hud.save({
      cash: this.cash,
      hp: this.people.hero.hp,
      mission: Math.max(0, this.missions.index),
      pos: { x: this.people.hero.pos.x, z: this.people.hero.pos.z },
      time: this.time,
      clock: this.clockMinutes,
      coins: taken,
    });
  }

  // --- car enter / exit ----------------------------------------------
  tryEnterExitCar() {
    const hero = this.people.hero;
    if (this.traffic.playerCar) {
      // Exit: step out to the left of the car.
      const car = this.traffic.playerCar;
      this.traffic.exitCar();
      hero.onFoot = true;
      hero.pos.set(car.pos.x - Math.cos(car.heading) * 2.2, 0, car.pos.z + Math.sin(car.heading) * 2.2);
      hero.heading = car.heading;
      this.hud.toast('Out of the car.');
      if (this.headlight) { this.headlight.visible = false; }
      return;
    }
    const car = this.traffic.nearestCar(hero.pos, 4.5, true);
    if (!car) return;
    const wasParked = car.parked;
    this.traffic.enterCar(car);
    hero.onFoot = false;
    hero.pos.copy(car.pos);
    if (car.damage === 0 && !car.stolenBefore) {
      car.stolenBefore = true;
      this.addWanted(1);
      this.hud.toast('You stole the car! The cops noticed.');
    }
    if (!this.headlight) {
      this.headlight = new THREE.SpotLight(0xfff2c0, 0, 60, 0.5, 0.5, 1.2);
      this.headlight.position.set(0, 1, 2);
      const target = new THREE.Object3D();
      target.position.set(0, 0, 30);
      car.mesh.add(target);
      this.headlight.target = target;
      car.mesh.add(this.headlight);
    } else {
      car.mesh.add(this.headlight);
    }
    this.headlight.visible = this.headlights;
    this.missions.onCarStolen(car);
  }

  // --- camera ---------------------------------------------------------
  snapCamera() {
    const target = this.currentTarget();
    this.camYaw = target.heading;
    this.positionCamera(target, true);
  }

  currentTarget() {
    const car = this.traffic.playerCar;
    if (car) return { pos: car.pos, heading: car.heading, speed: Math.abs(car.speed) };
    const h = this.people.hero;
    return { pos: h.pos, heading: h.heading, speed: h.speed };
  }

  positionCamera(target, snap) {
    const fx = Math.sin(target.heading);
    const fz = Math.cos(target.heading);
    // Smooth the yaw toward the target heading.
    let dy = target.heading - this.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.camYaw += snap ? dy : Math.max(-1.6 * (1 / 60), Math.min(1.6 * (1 / 60), dy));
    const cy = this.camYaw;
    const cx = Math.sin(cy);
    const cz = Math.cos(cy);
    let dist = 8;
    let height = 3.6;
    let lookY = 1.6;
    if (this.camMode === 1) { dist = 0.1; height = 62; lookY = 0; }
    if (this.camMode === 2) { dist = 4.2; height = 2.1; lookY = 1.4; }
    const wantX = target.pos.x - cx * dist;
    const wantZ = target.pos.z - cz * dist;
    const wantY = target.pos.y + height;
    if (snap) {
      this.camPos.set(wantX, wantY, wantZ);
    } else {
      const k = this.camMode === 1 ? 0.08 : 0.18;
      this.camPos.x += (wantX - this.camPos.x) * k;
      this.camPos.y += (wantY - this.camPos.y) * k;
      this.camPos.z += (wantZ - this.camPos.z) * k;
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target.pos.x + fx * 2, target.pos.y + lookY, target.pos.z + fz * 2);
  }

  // --- per-frame ------------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const frameDt = Math.min(0.6, (now - this.lastT) / 1000);
      this.lastT = now;
      this.input.beginFrame();
      if (this.state === 'playing') {
        const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(frameDt / FIXED_DT)));
        for (let s = 0; s < steps; s++) this.update(FIXED_DT);
        this.time += steps * FIXED_DT;
        this.clockMinutes += (steps * FIXED_DT) * 0.5;
      }
      this.frameCount++;
      this.updateFrame(frameDt);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    const input = this.input;
    // Global keys.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) this.pause();
    if (input.wasPressed('KeyC')) {
      this.camMode = (this.camMode + 1) % 3;
      this.hud.toast(['Chase camera', 'High camera', 'Close camera'][this.camMode]);
      this.snapCamera();
    }
    if (input.wasPressed('KeyN')) {
      if (this.sound.ensure()) this.sound.startRadio();
      this.hud.setStation(this.sound.nextStation());
      this.hud.toast('Radio: ' + this.sound.currentStation());
    }
    if (input.wasPressed('KeyH') && this.traffic.playerCar) this.sound.horn();
    if (input.wasPressed('KeyL')) {
      this.headlights = !this.headlights;
      if (this.headlight) this.headlight.visible = this.headlights;
      this.hud.toast(this.headlights ? 'Headlights on' : 'Headlights off');
    }
    if (input.wasPressed('KeyE')) this.tryEnterExitCar();
    if (input.wasPressed('KeyF') || input.clicked) {
      const res = this.people.heroPunch();
      if (res && res.hit) this.sound.punch();
    }

    const driving = !!this.traffic.playerCar;
    const hero = this.people.hero;
    // Driving physics.
    let carSpeed = 0;
    if (driving) {
      carSpeed = this.traffic.updatePlayer(dt, input, this.camYaw);
      hero.pos.copy(this.traffic.playerCar.pos);
      hero.heading = this.traffic.playerCar.heading;
    }
    this.people.update(dt, input, driving, this.camYaw);
    this.traffic.update(dt, hero.pos);
    this.missions.update(dt, hero, driving);

    // Coins.
    const pickPos = driving ? this.traffic.playerCar.pos : hero.pos;
    this.city.coins.forEach((coin, i) => {
      if (coin.taken) return;
      const dx = coin.x - pickPos.x;
      const dz = coin.z - pickPos.z;
      if (dx * dx + dz * dz < 4) {
        coin.taken = true;
        if (coin.mesh) coin.mesh.visible = false;
        this.cash += 40;
        this.hud.setCash(this.cash);
        this.hud.toast('Neon coin! +$40');
        this.sound.coin();
      }
    });

    // Wanted decay: one star per 25 quiet seconds, no cop nearby.
    if (this.wanted > 0) {
      this.wantedTimer -= dt;
      if (this.wantedTimer <= 0) {
        let copNear = false;
        for (const c of this.people.cops) {
          const dx = c.pos.x - hero.pos.x;
          const dz = c.pos.z - hero.pos.z;
          if (dx * dx + dz * dz < 400) { copNear = true; break; }
        }
        if (!copNear && this.traffic.cruisers.length === 0) {
          this.wanted = Math.max(0, this.wanted - 1);
          this.hud.setStars(this.wanted);
          this.wantedTimer = 25;
        } else {
          this.wantedTimer = 8;
        }
      }
    }

    // Coin spin + beacon.
    for (const m of this.coinMeshes) {
      if (m.visible) m.rotation.y += dt * 2;
    }
    if (this.missions.marker) {
      this.markerBeacon.visible = true;
      this.markerBeacon.position.x = this.missions.marker.x;
      this.markerBeacon.position.z = this.missions.marker.z;
      this.markerBeacon.material.opacity = 0.1 + Math.sin(this.time * 3) * 0.05;
    } else {
      this.markerBeacon.visible = false;
    }

    // Audio.
    this.sound.engine(driving ? Math.abs(carSpeed) / 30 : 0);
    this.sound.siren(this.wanted > 0, dt);

    // Autosave every 30 s.
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 30) {
      this.autosaveTimer = 0;
      this.saveGame();
    }

    // One-shot inputs (E, C, N, H, L, F, Space, click) are edges: they must
    // fire exactly once per frame. update() runs once per substep, so clear
    // them here — after the first substep has consumed them — or a single
    // key press would toggle enter/exit twice in one frame.
    this.input.pressed.clear();
    this.input.clicked = false;
  }

  updateFrame(frameDt) {
    if (this.state === 'playing' || this.state === 'paused') {
      const target = this.currentTarget();
      this.positionCamera(target, false);
      this.hud.setSpeed(this.traffic.playerCar ? Math.abs(this.traffic.playerCar.speed) * 2.237 : this.people.hero.speed * 2.237);
      this.hud.setClock(this.clockMinutes);
      if (this.frameCount % 3 === 0) {
        this.hud.drawMinimap({
          colliders: this.city.colliders,
          marker: this.missions.marker,
          cars: this.traffic.cars,
          cops: this.people.cops,
          thugs: this.people.thugs,
          boss: this.people.boss,
          hero: { x: this.people.hero.pos.x, z: this.people.hero.pos.z, heading: this.camYaw },
        });
      }
    }
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (err) {
      if (window.__errors) window.__errors.push(String(err && err.message ? err.message : err));
    }
  }

  // --- debug API (used by the test driver) ---------------------------
  debugState() {
    const hero = this.people.hero;
    const car = this.traffic.playerCar;
    return {
      state: this.state,
      cash: this.cash,
      hp: Math.round(hero.hp),
      wanted: this.wanted,
      mission: this.missions.index,
      objective: this.missions.objective,
      pos: { x: +hero.pos.x.toFixed(2), y: +hero.pos.y.toFixed(2), z: +hero.pos.z.toFixed(2) },
      heading: +hero.heading.toFixed(3),
      speed: car ? +Math.abs(car.speed).toFixed(2) : +hero.speed.toFixed(2),
      speedMph: car ? Math.abs(car.speed) * 2.237 : hero.speed * 2.237,
      inCar: !!car,
      carDamage: car ? car.damage : 0,
      coins: this.city.coins.filter((c) => c.taken).length,
      coinsTotal: this.city.coins.length,
      thugs: this.people.thugs.length,
      bossHp: this.people.boss ? this.people.boss.hp : null,
      time: +this.time.toFixed(2),
      clock: this.clockMinutes,
      camMode: this.camMode,
    };
  }

  teleport(x, z) {
    if (this.traffic.playerCar) this.traffic.exitCar();
    const hero = this.people.hero;
    hero.onFoot = true;
    hero.pos.set(x, 0, z);
    this.snapCamera();
  }

  giveCar(type, x, z, heading, color) {
    return this.traffic.giveCar(type, x, z, heading || 0, color);
  }

  // Combat probe helper: spawn thugs right in front of the hero.
  debugFight(n) {
    const hero = this.people.hero;
    const fx = Math.sin(hero.heading);
    const fz = Math.cos(hero.heading);
    this.people.spawnThugs(n || 3, { x: hero.pos.x + fx * 6, z: hero.pos.z + fz * 6 }, 3);
  }

  stop() {
    this.running = false;
    this.sound.stopRadio();
    this.sound.siren(false);
  }
}
