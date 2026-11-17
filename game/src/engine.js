// Solmar Bay — the Game. Owns the renderer, the frame loop, the player
// (on foot and in a car), the wanted system, combat, coins, the save
// system and the debug API the test driver uses. All the other modules
// plug in here: city, traffic, police, pedestrians, thugs, missions,
// HUD and audio.
import { Rng } from './rng.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity, pushOutOfColliders } from './city.js';
import { Traffic, Police, makeCarMesh } from './vehicles.js';
import { Pedestrians, Thugs, makePersonMesh } from './people.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Hud } from './hud.js';

const THREE = window.THREE;
const SAVE_KEY = 'solmar-bay-save-v1';

export class Game {
  constructor(canvas, opts = {}) {
    this.lowFx = !!opts.lowFx;
    this.canvas = canvas;
    this.time = 0;
    this.clockHours = 18.5; // dusk
    this.state = 'menu'; // menu | playing | paused | wasted | busted
    this.cash = 200;
    this.wanted = 0;
    this.lastCrime = -100;
    this.decayTimer = 0;
    this.saveTimer = 0;
    this.camMode = 0;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.coinsTaken = 0;
    this.beacon = null;
    this.beaconMesh = null;
    this.car = null; // the player's car, or null on foot
    this.repairArmed = true;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.lowFx,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = !this.lowFx;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1f3d);
    this.scene.fog = new THREE.Fog(0x2a1f3d, 130, 430);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 60, 140);

    const hemi = new THREE.HemisphereLight(0x8a7ab8, 0x2a2018, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xff9a5a, 1.5);
    sun.position.set(-120, 90, 60);
    sun.castShadow = !this.lowFx;
    if (!this.lowFx) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -160;
      sun.shadow.camera.right = 160;
      sun.shadow.camera.top = 160;
      sun.shadow.camera.bottom = -160;
      sun.shadow.camera.far = 500;
    }
    this.scene.add(sun);

    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.city = buildCity(this.scene, this.lowFx);
    this.traffic = new Traffic(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.peds = new Pedestrians(this.scene, this.city);
    this.thugs = new Thugs(this.scene);
    this.missions = new MissionManager(this);
    this.hud = new Hud();

    // The hero, Lena Cruz.
    this.heroMesh = makePersonMesh(0x2ad8c2, { skin: 0xd8a878, pants: 0x223344 });
    this.scene.add(this.heroMesh);
    this.hero = {
      pos: new THREE.Vector3(this.city.hideout.x, 0, this.city.hideout.z + 4),
      heading: 0,
      vy: 0,
      onGround: true,
      hp: 100,
      punchCd: 0,
      walkBob: 0,
    };
    this.heroMesh.position.copy(this.hero.pos);

    this.makeCoins();
    this.bindButtons();
    this.hud.setCash(this.cash);
    this.hud.setHp(this.hero.hp);
    this.hud.setStars(0);
    this.hud.setObjective('Press Start to play');
    this.hud.setContinueVisible(this.hasSave());
    this.hud.show('menu');

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.lastT = performance.now();
    const loop = (t) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0.001, (t - this.lastT) / 1000));
      this.lastT = t;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  // ---- world helpers used by missions / shots / driver ----

  heroPos() {
    return this.hero.pos;
  }

  get heroHeading() {
    return this.hero.heading;
  }

  playerCar() {
    return this.car;
  }

  teleport(x, z) {
    this.hero.pos.set(x, 0, z);
    this.hero.vy = 0;
    this.heroMesh.position.copy(this.hero.pos);
  }

  giveCar(kind, x, z, heading) {
    if (this.car) this.scene.remove(this.car.mesh);
    const mesh = makeCarMesh(0xc23b2e, kind || 'sedan');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading || 0;
    this.scene.add(mesh);
    this.car = { mesh, kind: kind || 'sedan', speed: 0, heading: heading || 0, damage: 0, isPlayer: true };
    this.heroMesh.visible = false;
    return this.car;
  }

  spawnMissionCar(kind, x, z) {
    const mesh = makeCarMesh(0x2e6ac2, kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = 0;
    this.scene.add(mesh);
    this.traffic.parked.push({ mesh, kind, taken: false, mission: true });
  }

  spawnThugs(list) {
    for (const t of list) this.thugs.spawn(t.x, t.z, t);
  }

  clearThugs() {
    this.thugs.clear();
  }

  thugsAlive() {
    return this.thugs.alive().length;
  }

  findBoss() {
    return this.thugs.list.find((t) => t.boss) || null;
  }

  setBeacon(x, z, color) {
    this.clearBeacon();
    this.beacon = { x, z };
    const geo = new THREE.CylinderGeometry(3, 3, 34, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: color || 0xffd27a, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    });
    this.beaconMesh = new THREE.Mesh(geo, mat);
    this.beaconMesh.position.set(x, 17, z);
    this.scene.add(this.beaconMesh);
  }

  clearBeacon() {
    this.beacon = null;
    if (this.beaconMesh) {
      this.scene.remove(this.beaconMesh);
      this.beaconMesh = null;
    }
  }

  toast(msg) {
    this.hud.toast(msg);
  }

  addCash(n) {
    this.cash += n;
    this.hud.setCash(this.cash);
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.lastCrime = this.time;
    this.police.setWanted(this.wanted);
    this.audio.setSiren(this.wanted > 0);
    this.hud.setStars(this.wanted);
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
  }

  onMissionComplete() {
    this.hud.banner('MISSION COMPLETE');
    this.saveGame();
  }

  // ---- coins ----

  makeCoins() {
    this.coinMeshes = [];
    const rng = new Rng(555);
    const spots = [];
    for (let k = 0; k <= 8; k += 1) {
      const line = this.city.roadLines[k];
      spots.push({ x: line + 4, z: rng.range(-150, 150) });
      spots.push({ x: rng.range(-150, 150), z: line + 4 });
    }
    spots.push({ x: this.city.plaza.x + 10, z: this.city.plaza.z });
    spots.push({ x: this.city.park.x, z: this.city.park.z });
    spots.push({ x: this.city.beach.x, z: this.city.beach.z - 4 });
    rng.shuffle(spots);
    const geo = new THREE.OctahedronGeometry(0.7);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
    for (const s of spots.slice(0, 12)) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(s.x, 1.2, s.z);
      this.scene.add(m);
      this.coinMeshes.push({ mesh: m, taken: false });
    }
  }

  // ---- menus / save ----

  bindButtons() {
    const on = (id, fn) => {
      const e = document.getElementById(id);
      if (e) e.addEventListener('click', () => { this.audio.unlock(); this.audio.click(); fn(); });
    };
    on('btn-start', () => this.startGame());
    on('btn-continue', () => this.continueGame());
    on('btn-resume', () => this.resumeGame());
    on('btn-restart', () => this.startGame());
    on('btn-respawn', () => this.respawn());
  }

  startGame() {
    this.cash = 200;
    this.hero.hp = 100;
    this.coinsTaken = 0;
    for (const c of this.coinMeshes) { c.taken = false; c.mesh.visible = true; }
    if (this.car) { this.scene.remove(this.car.mesh); this.car = null; }
    this.heroMesh.visible = true;
    this.clearThugs();
    this.clearBeacon();
    this.setWanted(0);
    this.teleport(this.city.hideout.x, this.city.hideout.z + 4);
    this.hero.heading = 0;
    this.missions.index = 0;
    this.missions.start();
    this.state = 'playing';
    this.hud.show('playing');
    this.hud.setObjective(this.missions.objective());
    this.toast('Welcome to Solmar Bay, Lena.');
  }

  continueGame() {
    const save = this.loadGame();
    if (!save) { this.startGame(); return; }
    this.cash = save.cash;
    this.hero.hp = save.hp;
    this.teleport(save.x, save.z);
    this.missions.index = save.mission;
    this.coinsTaken = save.coins || 0;
    for (let i = 0; i < this.coinsTaken && i < this.coinMeshes.length; i += 1) {
      this.coinMeshes[i].taken = true;
      this.coinMeshes[i].mesh.visible = false;
    }
    this.setWanted(0);
    this.missions.start();
    this.state = 'playing';
    this.hud.setCash(this.cash);
    this.hud.setHp(this.hero.hp);
    this.hud.show('playing');
    this.toast('Welcome back, Lena.');
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.saveGame();
    this.audio.setEngine(false, 0);
    this.audio.setSiren(false);
    this.hud.show('paused');
    this.hud.setSaveNote('Progress saved.');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.show('playing');
    this.audio.setSiren(this.wanted > 0);
  }

  respawn() {
    const fine = this.state === 'busted' ? 100 : 200;
    this.cash = Math.max(0, this.cash - fine);
    this.hud.setCash(this.cash);
    if (this.car) { this.scene.remove(this.car.mesh); this.car = null; }
    this.heroMesh.visible = true;
    this.hero.hp = 100;
    this.hud.setHp(100);
    this.teleport(this.city.hideout.x, this.city.hideout.z + 4);
    this.setWanted(0);
    this.state = 'playing';
    this.hud.show('playing');
    this.toast(`Back on the streets — $${fine} fine.`);
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        mission: this.missions.index,
        hp: Math.round(this.hero.hp),
        x: this.hero.pos.x,
        z: this.hero.pos.z,
        coins: this.coinsTaken,
      }));
    } catch (e) { /* storage unavailable */ }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ---- per-frame ----

  frame(dt) {
    this.input.beginFrame();
    if (this.state === 'playing') {
      this.time += dt;
      this.clockHours += dt / 240; // a full day in 4 minutes of play
      this.updatePlaying(dt);
    } else if (this.state === 'menu') {
      this.time += dt;
      this.traffic.update(dt, this.time);
      this.peds.update(dt, this.time);
      this.menuCamera(dt);
    }
    this.hud.update(dt);
    this.audio.update();
    this.renderer.render(this.scene, this.camera);
  }

  menuCamera(dt) {
    if (this.menuShot) return; // staged title shot: hold the camera still
    const a = this.time * 0.05;
    this.camera.position.set(
      this.city.tower.x + Math.cos(a) * 130,
      55,
      this.city.tower.z + Math.sin(a) * 130,
    );
    this.camera.lookAt(this.city.tower.x, 40, this.city.tower.z);
  }

  updatePlaying(dt) {
    const input = this.input;
    const drag = input.consumeDrag();
    this.camYaw -= drag.dx * 0.005;
    this.camPitch = Math.max(0.05, Math.min(1.2, this.camPitch + drag.dy * 0.003));

    if (input.pressed('KeyP') || input.pressed('Escape')) { this.pauseGame(); return; }
    if (input.pressed('KeyC')) {
      this.camMode = (this.camMode + 1) % 3;
      this.toast(['Camera: chase', 'Camera: far', 'Camera: high'][this.camMode]);
    }
    if (input.pressed('KeyN')) {
      const name = this.audio.radioNext();
      this.hud.setRadio(name);
      this.toast(`Radio: ${name}`);
    }
    if (input.pressed('KeyH') && this.car) this.audio.horn();
    if (input.pressed('KeyL') && this.car) {
      this.headlights = !this.headlights;
      this.toast(this.headlights ? 'Headlights on' : 'Headlights off');
    }
    if (input.pressed('KeyE')) this.toggleCar();

    if (this.car) this.updateDriving(dt);
    else this.updateOnFoot(dt);

    this.traffic.update(dt, this.time);
    this.peds.update(dt, this.time);
    this.thugs.update(dt, this.hero.pos, (dmg) => this.hurtHero(dmg));
    if (this.wanted > 0) {
      this.police.update(
        dt, this.hero.pos, !!this.car,
        (cruiser) => this.onRam(cruiser),
        () => this.busted(),
      );
    }
    this.missions.update(dt);
    this.updateCoins(dt);
    this.updateWanted(dt);
    this.updateCamera(dt);
    this.updateHud(dt);

    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.saveGame();
    }
    // Radio only plays while driving.
    this.audio.setRadio(!!this.car);
    this.audio.setEngine(!!this.car, this.car ? Math.abs(this.car.speed) / 28 : 0);
  }

  toggleCar() {
    if (this.car) {
      // Exit: hero steps out beside the car; the car becomes parked again.
      const c = this.car;
      const side = { x: Math.cos(c.heading), z: -Math.sin(c.heading) };
      this.teleport(c.mesh.position.x + side.x * 2.6, c.mesh.position.z + side.z * 2.6);
      this.hero.heading = c.heading;
      this.heroMesh.visible = true;
      this.traffic.parked.push({ mesh: c.mesh, kind: c.kind, taken: false });
      this.car = null;
      return;
    }
    const p = this.traffic.nearestParked(this.hero.pos, 4.5);
    if (!p) return;
    p.taken = true;
    const idx = this.traffic.parked.indexOf(p);
    if (idx >= 0) this.traffic.parked.splice(idx, 1);
    this.car = { mesh: p.mesh, kind: p.kind, speed: 0, heading: this.hero.heading, damage: 0, isPlayer: true };
    this.heroMesh.visible = false;
    this.addWanted(1);
    this.toast('Car stolen — the law is coming');
    this.peds.scare(this.hero.pos, 14);
    this.audio.setSiren(true);
  }

  updateDriving(dt) {
    const input = this.input;
    const c = this.car;
    const fwd = input.isDown('KeyW') || input.isDown('ArrowUp') ? 1
      : input.isDown('KeyS') || input.isDown('ArrowDown') ? -1 : 0;
    const steer = input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1
      : input.isDown('KeyD') || input.isDown('ArrowRight') ? -1 : 0;
    const wrecked = c.damage >= 100;
    if (!wrecked) {
      if (fwd > 0) c.speed += 15 * dt;
      else if (fwd < 0) c.speed -= (c.speed > 0.5 ? 24 : 10) * dt;
      else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 6 * dt);
    }
    c.speed = Math.max(-10, Math.min(28, c.speed));
    const turnRate = 1.9 * Math.min(1, Math.abs(c.speed) / 9);
    c.heading += steer * turnRate * dt * (c.speed >= 0 ? 1 : -1);
    const nx = c.mesh.position.x + Math.sin(c.heading) * c.speed * dt;
    const nz = c.mesh.position.z + Math.cos(c.heading) * c.speed * dt;
    c.mesh.position.x = nx;
    c.mesh.position.z = nz;
    c.mesh.rotation.y = c.heading;
    this.hero.pos.copy(c.mesh.position);
    this.hero.heading = c.heading;

    // Building collision.
    const hit = pushOutOfColliders(c.mesh.position, 1.7, this.city.colliders);
    if (hit && Math.abs(c.speed) > 6) {
      c.damage = Math.min(100, c.damage + (Math.abs(c.speed) - 6) * 1.4);
      c.speed *= 0.35;
      this.audio.crash();
      this.toast(c.damage >= 100 ? 'Car wrecked!' : 'Crash!');
    } else if (hit) {
      c.speed *= 0.6;
    }
    // Traffic collision: bounce off moving cars.
    for (const other of this.traffic.moving) {
      const dx = other.mesh.position.x - c.mesh.position.x;
      const dz = other.mesh.position.z - c.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0.01) {
        c.mesh.position.x -= (dx / d) * (3.4 - d);
        c.mesh.position.z -= (dz / d) * (3.4 - d);
        if (Math.abs(c.speed) > 5) {
          c.damage = Math.min(100, c.damage + 4);
          c.speed *= 0.6;
          this.audio.crash();
        }
      }
    }
    // Pedestrians scatter (and get hurt if hit fast).
    for (const p of this.peds.list) {
      const dx = p.mesh.position.x - c.mesh.position.x;
      const dz = p.mesh.position.z - c.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) this.peds.scare(c.mesh.position, 6);
      if (d < 2 && Math.abs(c.speed) > 4) {
        p.mesh.position.x += (dx / (d || 1)) * 3;
        p.mesh.position.z += (dz / (d || 1)) * 3;
        c.damage = Math.min(100, c.damage + 2);
      }
    }
    // Garage repair pad.
    const g = this.city.garage;
    const gd = Math.hypot(c.mesh.position.x - g.x, c.mesh.position.z - g.z);
    if (gd < 10 && c.damage > 0 && this.cash >= 25 && this.repairArmed) {
      this.repairArmed = false;
      c.damage = 0;
      this.cash -= 25;
      this.hud.setCash(this.cash);
      this.toast('Repaired at Rosa\'s — $25');
    } else if (gd >= 12) {
      this.repairArmed = true;
    }
    // Sea edge: cars cannot drive into the water.
    if (c.mesh.position.z > 205) {
      c.mesh.position.z = 205;
      c.speed *= -0.3;
    }
  }

  updateOnFoot(dt) {
    const input = this.input;
    const h = this.hero;
    let mx = 0;
    let mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) mz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) mz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? 9 : 5;
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      // Movement is relative to the camera's view direction, whose angle
      // is the hero heading plus the camera orbit offset.
      const yaw = h.heading + this.camYaw;
      const wx = -mz * Math.sin(yaw) - mx * Math.cos(yaw);
      const wz = -mz * Math.cos(yaw) + mx * Math.sin(yaw);
      h.pos.x += wx * speed * dt;
      h.pos.z += wz * speed * dt;
      const targetHeading = Math.atan2(wx, wz);
      let dh = targetHeading - h.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      h.heading += Math.max(-10 * dt, Math.min(10 * dt, dh));
      h.walkBob += dt * (sprint ? 12 : 8);
    }
    // Gravity and jump.
    if (input.pressed('Space') && h.onGround) {
      h.vy = 7.2;
      h.onGround = false;
    }
    h.vy -= 22 * dt;
    h.pos.y += h.vy * dt;
    if (h.pos.y <= 0) {
      h.pos.y = 0;
      h.vy = 0;
      h.onGround = true;
    }
    // Building collision and sea edge.
    pushOutOfColliders(h.pos, 0.55, this.city.colliders);
    if (h.pos.z > 204) h.pos.z = 204;
    if (h.pos.x > 178) h.pos.x = 178;
    if (h.pos.x < -178) h.pos.x = -178;
    if (h.pos.z < -178) h.pos.z = -178;

    // Punch.
    h.punchCd -= dt;
    if ((input.pressed('KeyF') || input.pressed('MouseClick')) && h.punchCd <= 0) {
      h.punchCd = 0.45;
      this.audio.punch();
      const before = this.thugs.alive().length;
      this.thugs.punchFrom(h.pos, h.heading, 2.4, 25);
      const after = this.thugs.alive().length;
      if (after < before) {
        const kills = before - after;
        this.addCash(50 * kills);
        this.toast(`Thug down — +$${50 * kills}`);
      }
      // Shove foot cops back.
      for (const cop of this.police.footCops) {
        const dx = cop.mesh.position.x - h.pos.x;
        const dz = cop.mesh.position.z - h.pos.z;
        if (Math.hypot(dx, dz) < 2.4) {
          cop.mesh.position.x += dx * 1.5;
          cop.mesh.position.z += dz * 1.5;
          cop.touchTime = 0;
        }
      }
    }

    // Hero mesh pose.
    this.heroMesh.position.copy(h.pos);
    this.heroMesh.rotation.y = h.heading;
    const swing = Math.sin(h.walkBob) * (mx !== 0 || mz !== 0 ? 0.5 : 0);
    const legL = this.heroMesh.getObjectByName('legL');
    const legR = this.heroMesh.getObjectByName('legR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
  }

  hurtHero(dmg) {
    if (this.state !== 'playing') return;
    this.hero.hp -= dmg;
    this.hud.setHp(this.hero.hp);
    if (this.hero.hp <= 0) {
      this.hero.hp = 0;
      this.state = 'wasted';
      this.audio.setEngine(false, 0);
      this.audio.setSiren(false);
      this.hud.show('wasted');
    }
  }

  onRam() {
    if (this.car) {
      this.car.damage = Math.min(100, this.car.damage + 6);
      this.car.speed *= 0.7;
      this.audio.crash();
    } else {
      this.hurtHero(15);
      const dx = this.hero.pos.x - this.police.cruisers[0].mesh.position.x;
      const dz = this.hero.pos.z - this.police.cruisers[0].mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      this.hero.pos.x += (dx / d) * 2;
      this.hero.pos.z += (dz / d) * 2;
    }
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.audio.setEngine(false, 0);
    this.audio.setSiren(false);
    this.hud.show('busted');
  }

  updateCoins(dt) {
    for (const c of this.coinMeshes) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 1.2 + Math.sin(this.time * 3 + c.mesh.position.x) * 0.25;
      const d = Math.hypot(c.mesh.position.x - this.hero.pos.x, c.mesh.position.z - this.hero.pos.z);
      if (d < 2.5) {
        c.taken = true;
        c.mesh.visible = false;
        this.coinsTaken += 1;
        this.addCash(40);
        this.audio.coin();
        this.toast('Neon coin — +$40');
      }
    }
  }

  updateWanted(dt) {
    if (this.wanted === 0) return;
    // Decay after 12 s with no fresh crime and no police close by.
    let nearest = Infinity;
    for (const c of this.police.cruisers) {
      const d = Math.hypot(c.mesh.position.x - this.hero.pos.x, c.mesh.position.z - this.hero.pos.z);
      if (d < nearest) nearest = d;
    }
    if (this.time - this.lastCrime > 12 && nearest > 28) {
      this.decayTimer += dt;
      if (this.decayTimer > 8) {
        this.decayTimer = 0;
        this.setWanted(this.wanted - 1);
        if (this.wanted === 0) this.toast('You lost them.');
      }
    } else {
      this.decayTimer = 0;
    }
  }

  updateCamera(dt) {
    const target = this.car ? this.car.mesh.position : this.hero.pos;
    const heading = this.car ? this.car.heading : this.hero.heading;
    const yaw = heading + this.camYaw + Math.PI;
    const dist = [7.5, 11, 6][this.camMode];
    const height = [3.2, 4.6, 15][this.camMode];
    const tx = target.x + Math.sin(yaw) * dist;
    const tz = target.z + Math.cos(yaw) * dist;
    const ty = target.y + height;
    const k = 1 - Math.exp(-6 * dt);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (ty - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(target.x, target.y + 1.4, target.z);
  }

  updateHud(dt) {
    this.hud.setHp(this.hero.hp);
    this.hud.setClock(this.clockHours);
    this.hud.setSpeed(this.car ? Math.abs(this.car.speed) * 2.237 : 0, !!this.car);
    this.hud.setObjective(this.missions.objective());
    this.hud.setDamage(this.car ? this.car.damage : 0);
    this.hud.drawMinimap(this);
  }

  debugState() {
    return {
      state: this.state,
      mission: this.missions.name(),
      missionIndex: this.missions.index,
      cash: Math.floor(this.cash),
      hp: Math.round(this.hero.hp),
      wanted: this.wanted,
      inCar: !!this.car,
      speedMph: this.car ? Math.round(Math.abs(this.car.speed) * 2.237) : 0,
      x: Math.round(this.hero.pos.x * 10) / 10,
      z: Math.round(this.hero.pos.z * 10) / 10,
      coins: this.coinsTaken,
      police: this.police.cruisers.length,
      thugsAlive: this.thugsAlive(),
    };
  }
}
