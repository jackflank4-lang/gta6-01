// The engine of Solmar Bay: the frame loop, the state machine (menu, playing,
// paused, busted, wasted), the wanted system, combat, coins, the mission
// beacon, the chase camera, and saving. Everything else in the game is a
// system this class owns and ticks: city, traffic, police, crowd, hero, car,
// thugs, missions, HUD and sound.

import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { buildCity } from './city.js';
import { Traffic, Police, PlayerCar } from './vehicles.js';
import { Crowd, Hero, Thugs, makeWalkerMesh } from './people.js';
import { Missions, bindPlaces } from './missions.js';
import { Hud } from './hud.js';

const SAVE_KEY = 'solmar-bay-save-v1';
const COIN_SPOTS = [
  [-150, -20], [-120, 60], [-60, -120], [0, 0], [30, -20], [60, 60],
  [120, -70], [150, 30], [60, 185], [-150, 150], [30, 30], [-90, 120],
];

export class Game {
  constructor() {
    this.state = 'menu';
    this.time = 0;
    this.clockMin = 15 * 60;
    this.cash = 200;
    this.health = 100;
    this.wanted = 0;
    this.crimeTimer = 0;
    this.wantedDecay = 0;
    this.bustTimer = 0;
    this.saveTimer = 0;
    this.camMode = 0;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDist = 9;
    this.inCar = false;
    this.radioOn = false;
    this.muted = false;
    this.errors = [];
    // ?fx=low trades shadows and antialiasing for speed on weak machines
    // (and in software renderers). The default keeps the full dusk look.
    this.lowFx = new URLSearchParams(window.location.search).get('fx') === 'low';

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowFx, preserveDrawingBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowFx ? 1 : 1.5));
    this.renderer.shadowMap.enabled = !this.lowFx;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xff9a6b);
    this.scene.fog = new THREE.Fog(0xff9a6b, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    const sunLight = new THREE.DirectionalLight(0xffd9a0, 1.5);
    sunLight.position.set(-120, 160, -80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -190;
    sunLight.shadow.camera.right = 190;
    sunLight.shadow.camera.top = 190;
    sunLight.shadow.camera.bottom = -190;
    sunLight.shadow.camera.far = 500;
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0xffb090, 0.75));
    const hemi = new THREE.HemisphereLight(0xffc090, 0x3a4a5a, 0.5);
    this.scene.add(hemi);

    this.input = new Input();
    this.sound = new SoundBank();
    this.city = buildCity(this.scene);
    this.traffic = new Traffic(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.crowd = new Crowd(this.scene, this.city);
    this.hero = new Hero(this.scene);
    this.playerCar = new PlayerCar(this.scene);
    this.thugs = new Thugs(this.scene);
    this.missions = new Missions(this);
    bindPlaces(this.missions, this.city);
    this.hud = new Hud(this.city);
    this.cops = [];

    // The mission beacon: a pillar of gold light and a ring on the ground.
    this.beacon = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23b, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.y = 17;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23b, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beacon.add(pillar);
    this.beacon.add(ring);
    this.beacon.visible = false;
    this.scene.add(this.beacon);

    // Twelve gold coins scattered over the city, worth $40 each.
    this.coins = [];
    const coinGeo = new THREE.OctahedronGeometry(0.55);
    const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd23b, emissive: 0x8a6d00 });
    for (const [x, z] of COIN_SPOTS) {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.position.set(x, 1.2, z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.coins.push({ mesh, x, z, taken: false, phase: Math.random() * 6 });
    }

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.hud.onStart = () => this.startNew();
    this.hud.onContinue = () => this.continueSave();
    this.hud.onResume = () => this.resume();
    this.hud.onRestart = () => this.startNew();
    this.hud.onRespawn = () => this.respawn();
    this.lastTick = performance.now();
  }

  // ---- public hooks used by missions, shots staging and the test driver ----
  playerFootPos() {
    if (this.inCar && this.playerCar.pos) return { x: this.playerCar.pos.x, z: this.playerCar.pos.z };
    return { x: this.hero.x, z: this.hero.z };
  }

  playerHeading() {
    if (this.inCar) return this.playerCar.heading;
    return this.hero.heading;
  }

  addCash(n) {
    this.cash += n;
    this.hud.setCash(this.cash);
  }

  carDamage() {
    return this.playerCar.active ? this.playerCar.damage : 0;
  }

  toast(text, ms) {
    this.hud.toast(text, ms);
  }

  spawnThugs(at, count, boss) {
    this.thugs.spawn(at.x, at.z, count, boss);
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.police.setWanted(this.wanted);
    this.hud.setWanted(this.wanted);
    this.sound.siren(this.wanted > 0);
  }

  addWanted(n) {
    if (n > 0) this.crimeTimer = 0;
    this.setWanted(this.wanted + n);
  }

  teleport(x, z) {
    this.hero.pos.set(x, 0, z);
    this.hero.mesh.position.copy(this.hero.pos);
  }

  giveCar(kind, x, z, heading) {
    const mesh = this.traffic.parked.length
      ? this.traffic.parked[0].mesh
      : null;
    if (!mesh) return false;
    const entry = this.traffic.nearestCar({ x, z }, 1e9);
    const stolen = this.traffic.steal(entry);
    stolen.position.set(x, 0, z);
    stolen.rotation.y = heading;
    this.playerCar.takeOver(stolen, entry.kind);
    this.inCar = true;
    return true;
  }

  startMission(index) {
    this.missions.index = index;
    this.missions.stage = 0;
    this.missions.done = false;
    this.missions.allDone = false;
    this.missions.enterStage();
  }

  // ---- state transitions ----
  startNew() {
    this.sound.unlock();
    this.cash = 200;
    this.health = 100;
    this.setWanted(0);
    this.thugs.clear();
    for (const cop of this.cops) this.scene.remove(cop.mesh);
    this.cops = [];
    for (const coin of this.coins) { coin.taken = false; coin.mesh.visible = true; }
    this.teleport(this.city.hideout.x, this.city.hideout.z + 12);
    this.hero.heading = Math.PI;
    this.missions.start();
    this.clockMin = 15 * 60;
    this.hud.hideOverlays();
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.health);
    this.hud.setMissionTitle(this.missions.title);
    this.hud.setObjective(this.missions.objectiveText());
    this.hud.toast('Mission 1: Grand Theft, Baby — steal a car');
    this.state = 'playing';
    this.sound.radioStart();
    this.radioOn = true;
    this.hud.setRadio(this.sound.radioName());
  }

  continueSave() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return this.startNew();
    try {
      const save = JSON.parse(raw);
      this.sound.unlock();
      this.cash = save.cash ?? 200;
      this.health = save.health ?? 100;
      this.setWanted(0);
      this.missions.index = save.mission ?? 0;
      this.missions.stage = save.stage ?? 0;
      this.missions.enterStage();
      this.teleport(save.x ?? this.city.hideout.x, save.z ?? this.city.hideout.z);
      this.clockMin = save.clockMin ?? 15 * 60;
      this.hud.hideOverlays();
      this.hud.setCash(this.cash);
      this.hud.setHealth(this.health);
      this.hud.setMissionTitle(this.missions.title);
      this.hud.setObjective(this.missions.objectiveText());
      this.state = 'playing';
      this.sound.radioStart();
      this.radioOn = true;
      this.hud.setRadio(this.sound.radioName());
      this.toast('Save loaded — welcome back to Solmar Bay');
    } catch (err) {
      this.startNew();
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showPause();
    this.sound.engine(false, 0);
    this.sound.siren(false);
    this.saveGame();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.hideOverlays();
    this.sound.siren(this.wanted > 0);
  }

  bust(fine) {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.cash = Math.max(0, this.cash - fine);
    this.setWanted(0);
    this.sound.busted();
    this.sound.engine(false, 0);
    this.hud.setCash(this.cash);
    this.hud.showBusted(fine);
    this.saveGame();
  }

  waste() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.cash = Math.max(0, this.cash - 200);
    this.setWanted(0);
    this.sound.busted();
    this.sound.engine(false, 0);
    this.hud.setCash(this.cash);
    this.hud.showWasted();
    this.saveGame();
  }

  respawn() {
    if (this.playerCar.active) {
      const mesh = this.playerCar.abandon();
      this.traffic.abandon(mesh, this.playerCar.kind);
      this.inCar = false;
    }
    this.health = 100;
    this.teleport(this.city.hideout.x, this.city.hideout.z + 12);
    this.hero.heading = Math.PI;
    this.thugs.clear();
    for (const cop of this.cops) this.scene.remove(cop.mesh);
    this.cops = [];
    this.hud.hideOverlays();
    this.hud.setHealth(this.health);
    this.state = 'playing';
    this.toast('Back on your feet — the city is still yours to take');
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        health: this.health,
        mission: this.missions.index,
        stage: this.missions.stage,
        x: this.hero.x,
        z: this.hero.z,
        clockMin: this.clockMin,
      }));
    } catch (err) { /* private mode or full storage: saving is best-effort */ }
  }

  hasSave() {
    try { return localStorage.getItem(SAVE_KEY) !== null; }
    catch (err) { return false; }
  }

  // ---- foot cops: they chase and, if they hold you for 1.5 s, bust you ----
  spawnCops(count) {
    for (let i = 0; i < count; i += 1) {
      const mesh = makeWalkerMesh(0x2a3a6e, 0x1c1c22, 0xe8b98a);
      const angle = Math.random() * Math.PI * 2;
      mesh.position.set(this.hero.x + Math.cos(angle) * 30, 0, this.hero.z + Math.sin(angle) * 30);
      this.scene.add(mesh);
      this.cops.push({ mesh, hold: 0, punchTimer: 0 });
    }
  }

  updateCops(dt) {
    const want = this.wanted >= 2 ? Math.min(2, this.wanted - 1) : 0;
    while (this.cops.length < want) this.spawnCops(1);
    while (this.cops.length > want) {
      const cop = this.cops.pop();
      this.scene.remove(cop.mesh);
    }
    for (const cop of this.cops) {
      const dx = this.hero.x - cop.mesh.position.x;
      const dz = this.hero.z - cop.mesh.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      if (dist > 1.7) {
        cop.mesh.position.x += (dx / dist) * 4.4 * dt;
        cop.mesh.position.z += (dz / dist) * 4.4 * dt;
        cop.hold = 0;
      } else {
        cop.hold += dt;
        if (cop.hold > 1.5) {
          this.bust(150 * Math.max(1, this.wanted));
          return;
        }
      }
      cop.mesh.rotation.y = Math.atan2(dx, dz);
      const swing = Math.sin(this.time * 9) * 0.5;
      cop.mesh.userData.legL.rotation.x = swing;
      cop.mesh.userData.legR.rotation.x = -swing;
    }
  }

  // ---- combat ----
  tryPunch() {
    if (!this.hero.punch()) return;
    this.sound.thud();
    const fx = this.hero.x + Math.sin(this.hero.heading) * 1.6;
    const fz = this.hero.z + Math.cos(this.hero.heading) * 1.6;
    const hit = this.thugs.hitAt({ x: fx, z: fz }, 2.4, 34, (thug) => {
      this.missions.onKill();
      this.addCash(thug.boss ? 500 : 50);
      this.toast(thug.boss ? 'Vic Marino is down — +$500' : 'Thug down — +$50');
      this.sound.coin();
    });
    if (hit) return;
    // Punching a cop is a crime; punching a pedestrian is worse.
    for (const cop of this.cops) {
      const d = Math.hypot(cop.mesh.position.x - fx, cop.mesh.position.z - fz);
      if (d < 2.2) {
        this.addWanted(1);
        this.toast('You hit a cop — wanted level up');
        this.crowd.scare({ x: fx, z: fz }, 25);
        return;
      }
    }
    const ped = this.crowd.nearest({ x: fx, z: fz }, 2.2);
    if (ped) {
      this.addWanted(1);
      this.toast('That was a civilian — wanted level up');
      this.crowd.scare({ x: fx, z: fz }, 30);
    }
  }

  tryEnterCar() {
    if (this.inCar) {
      // Step out beside the car.
      const mesh = this.playerCar.abandon();
      const hx = this.hero.x;
      const hz = this.hero.z;
      this.traffic.abandon(mesh, this.playerCar.kind);
      this.inCar = false;
      this.hero.pos.set(mesh.position.x + 2.5, 0, mesh.position.z + 2.5);
      this.hero.mesh.position.copy(this.hero.pos);
      this.sound.engine(false, 0);
      return;
    }
    const entry = this.traffic.nearestCar({ x: this.hero.x, z: this.hero.z }, 4.5);
    if (!entry) {
      this.toast('No car close enough — walk up to one and press E');
      return;
    }
    const mesh = this.traffic.steal(entry);
    this.playerCar.takeOver(mesh, entry.kind);
    this.inCar = true;
    this.addWanted(1);
    this.toast('Car stolen — the law is watching now');
    this.sound.pickup();
    this.missions.onSteal();
  }

  // ---- the frame loop ----
  // Edges are snapshotted at the start of the frame (see Input.beginFrame):
  // a press during a long render survives to the next frame, and a press
  // during update() lands in the next frame's snapshot. P / Escape toggles
  // pause here so it also works while paused (update() does not run then).
  loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.input.beginFrame();
    if (this.input.hit('KeyP') || this.input.hit('Escape')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
    if (this.state === 'playing') this.update(dt);
    this.time += dt;
    this.city.update(dt, this.time);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    this.clockMin += dt * 2.2; // a game day runs about 11 real minutes
    if (this.clockMin >= 24 * 60) this.clockMin -= 24 * 60;

    // Global keys (pause is handled in the frame loop so it toggles).
    if (this.input.hit('KeyM')) {
      this.muted = !this.muted;
      this.sound.setMuted(this.muted);
      this.toast(this.muted ? 'Sound muted' : 'Sound on');
    }
    if (this.input.hit('KeyC')) {
      this.camMode = (this.camMode + 1) % 3;
      this.toast(['Camera: street level', 'Camera: high chase', 'Camera: rooftop'][this.camMode]);
    }
    if (this.input.hit('KeyN') && this.radioOn) {
      this.hud.setRadio(this.sound.radioNext());
      this.toast(`Radio: ${this.sound.radioName()}`);
    }

    const drag = this.input.takeDrag();
    this.camYaw -= drag.x * 0.004;
    this.camPitch = Math.max(0.08, Math.min(0.9, this.camPitch + drag.y * 0.003));

    if (this.inCar) {
      if (this.input.hit('KeyE')) this.tryEnterCar();
      if (this.input.hit('KeyH') && this.playerCar.honk()) this.sound.horn();
      if (this.input.hit('KeyL')) {
        const on = this.playerCar.toggleHeadlights();
        this.toast(on ? 'Headlights on' : 'Headlights off');
      }
      // Repair at Rosa's Garage: drive into the bay and the car is fixed.
      const garage = this.city.garage;
      const carPos = this.playerCar.pos;
      if (carPos && Math.hypot(carPos.x - garage.x, carPos.z - garage.z) < 9 && this.playerCar.damage > 0) {
        this.playerCar.repair();
        this.sound.pickup();
        this.toast('Rosa\'s Garage — car repaired, on the house');
      }
      this.playerCar.update(dt, this.input, this.city, this.traffic);
      this.crowd.scare(this.playerCar.pos, Math.abs(this.playerCar.speed) > 12 ? 12 : 0);
      if (this.playerCar.damage >= 100 && this.wanted > 0) {
        this.bust(150 * this.wanted);
        return;
      }
      if (this.playerCar.damage >= 100) {
        this.toast('Your ride is totalled — get out and find another');
        this.playerCar.damage = 99;
      }
      this.sound.engine(true, Math.abs(this.playerCar.speed) / 40);
    } else {
      if (this.input.hit('KeyE')) this.tryEnterCar();
      if (this.input.hit('KeyF')) this.tryPunch();
      this.hero.update(dt, this.input, this.camYaw, this.city);
      this.sound.engine(false, 0);
    }

    this.traffic.update(dt, this.time);
    this.crowd.update(dt, this.time);
    const dealt = this.thugs.update(dt, this.time, { x: this.hero.x, z: this.hero.z }, null);
    if (dealt > 0 && !this.inCar) {
      this.health -= dealt;
      this.hud.setHealth(this.health);
      this.sound.thud();
      if (this.health <= 0) { this.waste(); return; }
    }
    this.updateCops(dt);
    if (this.state !== 'playing') return;
    const touching = this.police.update(dt, this.time, this.playerFootPos(), this.inCar ? this.playerCar.speed : 0);
    if (touching && this.inCar) {
      this.playerCar.damage = Math.min(100, this.playerCar.damage + 22 * dt);
      this.playerCar.speed *= Math.max(0, 1 - 1.2 * dt);
      if (this.playerCar.damage >= 100) { this.bust(150 * this.wanted); return; }
    }

    // Wanted decay: lay low, out of sight, and the heat cools off.
    this.crimeTimer += dt;
    if (this.wanted > 0 && this.crimeTimer > 18) {
      let nearestCop = 1e9;
      for (const cop of this.police.cruisers) {
        nearestCop = Math.min(nearestCop, Math.hypot(
          cop.mesh.position.x - this.hero.x, cop.mesh.position.z - this.hero.z));
      }
      for (const cop of this.cops) {
        nearestCop = Math.min(nearestCop, Math.hypot(
          cop.mesh.position.x - this.hero.x, cop.mesh.position.z - this.hero.z));
      }
      if (nearestCop > 45) {
        this.wantedDecay += dt;
        if (this.wantedDecay > 10) {
          this.wantedDecay = 0;
          this.setWanted(this.wanted - 1);
          this.toast('The heat is cooling off…');
        }
      } else {
        this.wantedDecay = 0;
      }
    }

    // Coins: spin, bob, collect.
    const pos = this.playerFootPos();
    for (const coin of this.coins) {
      if (coin.taken) continue;
      coin.mesh.rotation.y += dt * 2.4;
      coin.mesh.position.y = 1.2 + Math.sin(this.time * 2 + coin.phase) * 0.25;
      const d = Math.hypot(coin.x - pos.x, coin.z - pos.z);
      if (d < (this.inCar ? 3.2 : 2.2)) {
        coin.taken = true;
        coin.mesh.visible = false;
        this.addCash(40);
        this.sound.coin();
        this.toast('Gold coin — +$40');
      }
    }

    this.missions.update(dt);

    // Mission beacon follows the current objective.
    const beacon = this.missions.beaconPos();
    if (beacon) {
      this.beacon.visible = true;
      this.beacon.position.set(beacon.x, 0, beacon.z);
      this.beacon.rotation.y += dt * 0.8;
    } else {
      this.beacon.visible = false;
    }

    // Chase camera: behind the car, or orbiting the hero on foot.
    const target = this.inCar ? this.playerCar.pos : this.hero.pos;
    const speeds = this.inCar ? Math.abs(this.playerCar.speed) : 0;
    if (this.inCar) {
      const targetYaw = this.playerCar.heading + Math.PI;
      let diff = targetYaw - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, dt * 2.2);
    }
    const dist = [9, 13, 22][this.camMode] + speeds * 0.12;
    const height = [3.2, 5, 12][this.camMode];
    const cx = target.x + Math.sin(this.camYaw) * dist;
    const cz = target.z + Math.cos(this.camYaw) * dist;
    this.camera.position.set(cx, height + (this.camMode === 2 ? 6 : 0), cz);
    this.camera.lookAt(target.x, target.y + 1.6, target.z);

    // HUD.
    this.hud.setHealth(this.health);
    this.hud.setObjective(this.missions.objectiveText());
    this.hud.setMissionTitle(this.missions.title);
    this.hud.setSpeed(this.inCar ? Math.abs(this.playerCar.speed) * 2.2 : 0, this.inCar);
    const hours = Math.floor(this.clockMin / 60);
    const minutes = Math.floor(this.clockMin % 60);
    this.hud.setClock(hours, minutes);
    // The minimap repaints a 2048 px ground canvas: throttle it to every
    // third frame so software renderers keep up.
    this.frameCount = (this.frameCount || 0) + 1;
    if (this.frameCount % 3 === 0) this.hud.drawMinimap(this, this.time);
    this.sound.siren(this.wanted > 0);

    // Autosave every 30 seconds of play.
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.saveGame();
    }
  }

  // A plain snapshot for the test driver and the HUD.
  debugState() {
    return {
      state: this.state,
      cash: this.cash,
      health: Math.round(this.health),
      wanted: this.wanted,
      inCar: this.inCar,
      mission: this.missions.title,
      missionIndex: this.missions.index,
      stage: this.missions.stage,
      objective: this.missions.objectiveText(),
      hero: { x: Math.round(this.hero.x), z: Math.round(this.hero.z) },
      carSpeed: this.inCar ? Math.round(this.playerCar.speed * 2.2) : 0,
      carDamage: Math.round(this.carDamage()),
      thugsAlive: this.thugs.aliveCount(),
      coinsLeft: this.coins.filter((c) => !c.taken).length,
      traffic: this.traffic.cars.length,
      police: this.police.cruisers.length,
      errors: this.errors,
    };
  }
}
