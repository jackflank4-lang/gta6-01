// engine.js — Solmar Bay core: renderer, game loop, state machine,
// wanted level, coins, save/load, camera and the debug hooks the
// test driver uses (debugState, teleport, debugFight, snapCamera).
import { City } from './city.js';
import { Vehicles } from './vehicles.js';
import { People } from './people.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

export const SAVE_KEY = 'solmar-bay-save-v1';
export const START_CASH = 200;
export const HIDEOUT = { x: 66, z: 154 };

export class Game {
  constructor() {
    this.state = 'menu';
    this.time = 0;
    this.cash = START_CASH;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.bustTimer = 0;
    this.coinsTaken = 0;
    this.camYaw = 0;
    this.camYawOffset = 0;
    this.cameraMode = 0;
    this.staging = false;
    this.headlightsOn = true;
    this._dragging = false;
    this._lastX = 0;

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 30, 90);

    this.city = new City(this.scene);
    this.audio = new AudioEngine();
    this.input = new Input();
    this.vehicles = new Vehicles(this.scene, this.city, this.audio);
    this.people = new People(this.scene, this.city, this.audio);
    this.hud = new Hud();
    this.missions = new Missions(this);
    this.people.onKill = (kind) => {
      if (kind === 'thug') this.addCash(50, 'Thug down');
    };
    this._wireButtons();
    this._wireCameraDrag(canvas);
    window.addEventListener('resize', () => this._onResize());

    // Headlight spotlight (follows the player's car).
    this.headlight = new THREE.SpotLight(0xffe9a8, 600, 40, 0.5, 0.4, 1.2);
    this.headlight.position.set(0, 2, 0);
    this.scene.add(this.headlight);
    this.headlightTarget = new THREE.Object3D();
    this.scene.add(this.headlightTarget);
    this.headlight.target = this.headlightTarget;

    // Shot staging (?shot=start|drive|chase|mission&seed=11).
    const params = new URLSearchParams(window.location.search);
    this.shotName = params.get('shot');
    this.shotSeed = params.get('seed') || '11';
    if (this.shotName) {
      setTimeout(() => {
        stageShot(this, this.shotName);
        window.__shotReady = true;
      }, 1200);
    }

    this._clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._frame());
    this._refreshHud();
  }

  get playing() { return this.state === 'playing'; }
  get traffic() { return this.vehicles; }

  // ---- public API used by missions / hud / driver ----
  addCash(amount, reason) {
    this.cash += amount;
    this._refreshHud();
  }
  // Note: missions is still undefined while the Missions constructor
  // runs _announce(), so guard the mirrored field.
  setObjective(text) { if (this.missions) this.missions.objective = text; this.hud.setObjective(text); }
  toast(text) { this.hud.toast(text); }
  onStoryComplete() {
    this.state = 'complete';
    this.save();
    this.hud.showMenu('complete');
  }

  missionTarget() {
    const idx = this.missions.index;
    if (idx === 0) return this.city.landmarks.garage;
    if (idx === 1) return this.city.landmarks.casino;
    if (idx === 2) return this.city.landmarks.plaza;
    if (idx === 3) {
      const fares = [[-22, 88], [110, -44], [-66, 44], [22, 0], [132, 66], [-88, 132]];
      const f = this.missions.fareIndex;
      const pick = this.missions.fareStage === 'pickup';
      const p = pick ? fares[f * 2] : fares[f * 2 + 1];
      return { x: p[0], z: p[1] };
    }
    if (idx === 4) return this.city.landmarks.bossArena;
    return null;
  }

  debugState() {
    const hero = this.people.hero;
    return {
      state: this.state,
      cash: Math.floor(this.cash),
      hp: Math.round(hero.hp),
      mission: this.state === 'menu' ? -1 : this.missions.index,
      inCar: !!this.vehicles.playerCar,
      speed: this.vehicles.playerCar ? Math.abs(this.vehicles.playerCar.speed) : 0,
      thugs: this.people.thugs.length,
      bossHp: this.people.boss ? this.people.boss.hp : 0,
      objective: this.missions.objective,
      coins: this.coinsTaken,
      wanted: this.wanted,
      time: +this.time.toFixed(2),
      x: +hero.pos.x.toFixed(1),
      z: +hero.pos.z.toFixed(1),
    };
  }

  debugFight(n) {
    const h = this.people.hero;
    this.people.spawnThugs(n, h.pos.x + 4, h.pos.z);
  }

  teleport(x, z) {
    const h = this.people.hero;
    h.pos.set(x, 0, z);
    h.mesh.position.copy(h.pos);
    if (this.vehicles.playerCar) {
      this.vehicles.playerCar.pos.set(x, 0, z);
      this.vehicles.playerCar.speed = 0;
    }
    this.snapCamera();
  }

  snapCamera() {
    const h = this.people.hero;
    const car = this.vehicles.playerCar;
    const heading = car ? car.heading : h.heading;
    this.camYaw = heading;
    this.camYawOffset = 0;
    this._placeCamera(1);
  }

  // ---- game flow ----
  startNewGame() {
    this.audio.init();
    this.audio.click();
    this.cash = START_CASH;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.bustTimer = 0;
    this.coinsTaken = 0;
    for (const c of this.city.coins) { c.taken = false; c.mesh.visible = true; }
    const hero = this.people.hero;
    hero.hp = 100;
    hero.onFoot = true;
    hero.pos.set(0, 0, 40);
    hero.heading = Math.PI;
    if (this.vehicles.playerCar) this.vehicles.exitCar();
    this.vehicles.despawnCruisers();
    this.people.clearEnemies();
    this.missions.index = 0;
    this.missions._announce();
    this.state = 'playing';
    this.hud.showMenu('playing');
    this.hud.setRadio('');
    this._refreshHud();
    this.toast('Welcome to Solmar Bay, Lena. First job: steal a car.');
    this.save();
  }

  loadSave() {
    let save = null;
    try { save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { save = null; }
    if (!save) { this.startNewGame(); return; }
    this.audio.init();
    this.cash = save.cash ?? START_CASH;
    this.people.hero.hp = save.hp ?? 100;
    this.people.hero.pos.set(save.x ?? 0, 0, save.z ?? 40);
    this.people.hero.onFoot = true;
    if (this.vehicles.playerCar) this.vehicles.exitCar();
    this.vehicles.despawnCruisers();
    this.people.clearEnemies();
    this.coinsTaken = 0;
    this.city.coins.forEach((c, i) => {
      c.taken = !!(save.coins && save.coins.includes(i));
      c.mesh.visible = !c.taken;
      if (c.taken) this.coinsTaken++;
    });
    this.missions.index = Math.min(4, save.mission ?? 0);
    this.missions._announce();
    this.wanted = 0;
    this.state = 'playing';
    this.hud.showMenu('playing');
    this._refreshHud();
    this.toast('Welcome back, Lena.');
  }

  save() {
    try {
      const taken = this.city.coins.map((c, i) => (c.taken ? i : -1)).filter((i) => i >= 0);
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: Math.floor(this.cash),
        mission: this.missions.index,
        coins: taken,
        hp: Math.round(this.people.hero.hp),
        x: +this.people.hero.pos.x.toFixed(1),
        z: +this.people.hero.pos.z.toFixed(1),
      }));
    } catch { /* storage unavailable */ }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.save();
    this.audio.setEngine(0, false);
    this.audio.setRadio(false);
    this.hud.showMenu('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.init();
    this.state = 'playing';
    this.hud.showMenu('playing');
    if (this.vehicles.playerCar) this.audio.setRadio(true);
  }

  quitToMenu() {
    this.state = 'menu';
    this.save();
    this.audio.setEngine(0, false);
    this.audio.setRadio(false);
    this.hud.showMenu('menu');
  }

  retryAfterEnd() {
    const wasBusted = this.state === 'busted';
    if (wasBusted) this.cash = Math.max(0, this.cash - 200);
    const hero = this.people.hero;
    hero.hp = 100;
    hero.onFoot = true;
    hero.pos.set(HIDEOUT.x, 0, HIDEOUT.z);
    hero.heading = 0;
    if (this.vehicles.playerCar) this.vehicles.exitCar();
    this.vehicles.despawnCruisers();
    this.people.clearEnemies();
    this.wanted = 0;
    this.wantedTimer = 0;
    this.bustTimer = 0;
    this.missions._announce();
    this.state = 'playing';
    this.hud.showMenu('playing');
    this._refreshHud();
    this.toast(wasBusted ? 'Bail paid. Back on the street.' : 'Back on your feet, Lena.');
  }

  // ---- wiring ----
  _wireButtons() {
    this.hud.btnStart.addEventListener('click', () => this.startNewGame());
    this.hud.btnContinue.addEventListener('click', () => this.loadSave());
    this.hud.btnHowto.addEventListener('click', () => {
      const e = this.hud.howtoEl;
      e.style.display = e.style.display === 'none' ? 'block' : 'none';
    });
    this.hud.btnResume.addEventListener('click', () => this.resume());
    this.hud.btnRestart.addEventListener('click', () => this.startNewGame());
    this.hud.btnQuit.addEventListener('click', () => this.quitToMenu());
    this.hud.btnRetry.addEventListener('click', () => this.retryAfterEnd());
  }

  _wireCameraDrag(canvas) {
    canvas.addEventListener('pointerdown', (e) => { this._dragging = true; this._lastX = e.clientX; });
    window.addEventListener('pointerup', () => { this._dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      this.camYawOffset += (e.clientX - this._lastX) * 0.005;
      this._lastX = e.clientX;
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _refreshHud() {
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.people.hero.hp);
    this.hud.setStars(this.wanted);
  }

  // ---- frame ----
  _frame() {
    const dt = Math.min(0.1, this._clock.getDelta());
    this.time += dt;
    if (this.state === 'playing') {
      this._handleKeys();
      // Fixed substeps keep physics stable at 2-5 fps (SwiftShader).
      const steps = Math.max(1, Math.ceil(dt / (1 / 30)));
      const sdt = dt / steps;
      // Staged drive/chase shots cruise forward on their own.
      const cruise = this.staging && (this.shotName === 'drive' || this.shotName === 'chase');
      const input = cruise
        ? { axes: () => ({ x: 0, y: 1 }), down: () => false, wasPressed: () => false }
        : this.input;
      for (let i = 0; i < steps; i++) this._update(sdt, input);
      this.hud.update(this, dt);
      this._refreshHud();
    }
    if (this.state === 'menu') {
      // Menu orbit keeps the world breathing behind the title screen.
      this._updateAmbient(dt);
    }
    this.city.update(dt, this.time);
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _handleKeys() {
    const input = this.input;
    if (this.staging) return;
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) { this.pause(); return; }
    if (input.wasPressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
      this.toast(this.audio.muted ? 'Sound off.' : 'Sound on.');
    }
    if (input.wasPressed('KeyC')) {
      this.cameraMode = (this.cameraMode + 1) % 3;
      this.toast(['Camera: chase', 'Camera: wide', 'Camera: top-down'][this.cameraMode]);
    }
    if (input.wasPressed('KeyN') && this.vehicles.playerCar) {
      this.hud.setRadio(this.audio.nextTrack());
    }
    if (input.wasPressed('KeyL')) {
      this.headlightsOn = !this.headlightsOn;
      this.headlight.visible = this.headlightsOn;
    }
    if (input.wasPressed('KeyH') && this.vehicles.playerCar) this.audio.horn();
    if (input.wasPressed('KeyE')) {
      const hero = this.people.hero;
      if (this.vehicles.playerCar) {
        const car = this.vehicles.exitCar();
        const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
        hero.pos.set(car.pos.x + rx * 2.6, 0, car.pos.z + rz * 2.6);
        hero.heading = car.heading;
        hero.onFoot = true;
        this.audio.setEngine(0, false);
        this.audio.setRadio(false);
        this.hud.setRadio('');
      } else {
        const car = this.vehicles.nearestCar(hero.pos, 4.5);
        if (car) {
          this.vehicles.enterCar(car);
          hero.onFoot = false;
          this.audio.init();
          this.audio.setRadio(true);
          this.hud.setRadio(this.audio.radioTrackName());
          if (this.wanted < 5) {
            this.wanted = Math.min(5, this.wanted + 1);
            this.wantedTimer = 0;
            this.toast('You stole a car — the cops are coming.');
          }
        }
      }
    }
  }

  _update(dt, input) {
    const hero = this.people.hero;
    // onFoot is derived state: the hero is on foot whenever no car is
    // occupied. Syncing it here keeps direct traffic calls (the test
    // driver, shots) and the E key in agreement.
    hero.onFoot = !this.vehicles.playerCar;
    const driving = !!this.vehicles.playerCar;
    this.vehicles.update(dt, input, hero, this.wanted);
    this.people.update(dt, input, driving, this.camYaw + this.camYawOffset);
    if (!this.staging) this.missions.update(dt);
    // Coins (on foot or by car).
    const px = driving ? this.vehicles.playerCar.pos.x : hero.pos.x;
    const pz = driving ? this.vehicles.playerCar.pos.z : hero.pos.z;
    for (let i = 0; i < this.city.coins.length; i++) {
      const c = this.city.coins[i];
      if (c.taken) continue;
      const dx = c.pos.x - px, dz = c.pos.z - pz;
      if (dx * dx + dz * dz < 4.8) {
        c.taken = true;
        c.mesh.visible = false;
        this.coinsTaken++;
        this.addCash(40, 'Neon coin');
        this.audio.coin();
        this.toast('Neon coin +$40');
      }
    }
    // Wanted decay after 25 quiet seconds.
    if (this.wanted > 0) {
      this.wantedTimer += dt;
      if (this.wantedTimer > 25) {
        this.wanted--;
        this.wantedTimer = 0;
        this.toast('You lost the cops. Heat is down.');
      }
    }
    // Busted: a cruiser sits on Lena while she is on foot.
    if (this.wanted > 0 && hero.onFoot && hero.hp > 0) {
      let near = false;
      for (const c of this.vehicles.cruisers) {
        const dx = c.pos.x - hero.pos.x, dz = c.pos.z - hero.pos.z;
        if (dx * dx + dz * dz < 9) { near = true; break; }
      }
      this.bustTimer = near ? this.bustTimer + dt : 0;
      if (this.bustTimer > 2) {
        this.state = 'busted';
        this.audio.wasted();
        this.hud.showMenu('busted');
        this.save();
        return;
      }
    } else {
      this.bustTimer = 0;
    }
    // Wasted.
    if (hero.hp <= 0 && this.state === 'playing') {
      this.state = 'wasted';
      this.audio.wasted();
      this.hud.showMenu('wasted');
      this.save();
      return;
    }
    // Headlight follows the player's car.
    if (this.vehicles.playerCar) {
      const car = this.vehicles.playerCar;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      this.headlight.position.set(car.pos.x + fx * 2, 2, car.pos.z + fz * 2);
      this.headlightTarget.position.set(car.pos.x + fx * 20, 0, car.pos.z + fz * 20);
      this.headlight.visible = this.headlightsOn;
      this.hud.setSpeed(Math.abs(car.speed) * 2.237);
    } else {
      this.headlight.visible = false;
      this.hud.setSpeed(0);
    }
    // Sirens while any cruiser is out.
    this.audio.setSiren(this.vehicles.cruisers.length > 0);
  }

  _updateAmbient(dt) {
    // Traffic and pedestrians keep moving behind the menu.
    const hero = this.people.hero;
    const driving = !!this.vehicles.playerCar;
    const sub = Math.max(1, Math.ceil(dt / (1 / 30)));
    for (let i = 0; i < sub; i++) {
      this.vehicles.update(dt / sub, this.input, hero, 0);
      this.people.update(dt / sub, this.input, driving, this.camYaw);
    }
  }

  _updateCamera(dt) {
    const hero = this.people.hero;
    const car = this.vehicles.playerCar;
    const target = car ? car.pos : hero.pos;
    const heading = car ? car.heading : hero.heading;
    // Ease the camera yaw toward the heading while moving.
    const moving = car ? Math.abs(car.speed) > 0.5 : this.input.axes().y !== 0 || this.input.axes().x !== 0;
    if (moving && this.state === 'playing') {
      let diff = heading - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, dt * 2.2);
    }
    this._placeCamera(dt);
  }

  _placeCamera(dt) {
    const hero = this.people.hero;
    const car = this.vehicles.playerCar;
    const target = car ? car.pos : hero.pos;
    const yaw = this.camYaw + this.camYawOffset;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let cx, cy, cz, lx, ly, lz;
    if (this.state === 'menu' && !this.staging) {
      // Slow orbit over the plaza for the title screen.
      const a = this.time * 0.05;
      cx = 22 + Math.cos(a) * 70;
      cy = 42;
      cz = 22 + Math.sin(a) * 70;
      lx = 22; ly = 6; lz = 22;
    } else if (this.cameraMode === 2) {
      cx = target.x; cy = 65; cz = target.z + 0.01;
      lx = target.x; ly = 0; lz = target.z;
    } else if (this.cameraMode === 1) {
      cx = target.x - fx * 24; cy = 18; cz = target.z - fz * 24;
      lx = target.x + fx * 8; ly = 2; lz = target.z + fz * 8;
    } else {
      cx = target.x - fx * 10.5; cy = 4.6; cz = target.z - fz * 10.5;
      lx = target.x + fx * 7; ly = 1.6; lz = target.z + fz * 7;
    }
    const k = dt >= 1 ? 1 : 1 - Math.exp(-dt * 6);
    this.camera.position.x += (cx - this.camera.position.x) * k;
    this.camera.position.y += (cy - this.camera.position.y) * k;
    this.camera.position.z += (cz - this.camera.position.z) * k;
    this.camera.lookAt(lx, ly, lz);
  }
}
