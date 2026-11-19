// Engine: renderer, game loop, camera, player physics, wanted system,
// coins, save/load, and the public API the screenshot staging and the
// play-test driver use. Everything the other modules built plugs in here.

import { Rng } from './rng.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { makeCarMesh, Car, Traffic, Police, collideCircleBox } from './vehicles.js';
import { makePersonMesh, People } from './people.js';
import { MissionRunner } from './missions.js';
import { Hud } from './hud.js';

const SAVE_KEY = 'solmar-bay-save-v1';
const COIN_VALUE = 40;
const START_CASH = 200;
const START_HEALTH = 100;
const THUG_REWARD = 25;

export class Game {
  constructor() {
    this.fxLow = new URLSearchParams(window.location.search).get('fx') === 'low';
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.fxLow });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.fxLow;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 60, 140);

    this.city = buildCity(this.scene, this.fxLow);
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.traffic = new Traffic(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.people = new People(this.scene);
    this.hud = new Hud({
      onStart: (cont) => this.startGame(!cont),
      onResume: () => this.resume(),
      onQuitToMenu: () => this.toMenu(),
      onRespawn: () => this.respawn(),
    });
    this.missions = new MissionRunner(this.city.spots, this.people, {
      toast: (msg) => this.hud.toast(msg),
      addCash: (n) => { this.cash += n; },
      setObjective: (text) => { this.objective = text; },
      setMarker: (pos) => { this.marker = pos; },
      jingle: () => this.audio.jingle(),
      fail: () => this.audio.fail(),
      save: () => this.save(),
      randomRoadPoint: () => this.city.randomRoadPoint(new Rng((Math.random() * 1e9) | 0)),
    });

    // Player state.
    this.playerMesh = makePersonMesh(0xff5da2, 0xe8b98a);
    this.scene.add(this.playerMesh);
    this.player = { x: 0, z: 0, y: 0, heading: 0, vy: 0, onGround: true, speed: 0 };
    this.health = START_HEALTH;
    this.cash = START_CASH;
    this.wanted = 0;
    this.wantedGrace = 0;
    this.wantedDecay = 0;
    this.bustedTimer = 0;
    this.car = null; // the Car the player is driving, or null on foot
    this.parkedCars = [];
    this.objective = 'Meet the crew at the hideout.';
    this.marker = null;
    this.cameraMode = 0;
    this.autoDrive = false;
    this.shotMode = false; // staged screenshots: camera snaps, no lerp lag
    this.clockMin = 18 * 60;
    this.day = 1;
    this.state = 'menu'; // menu | playing | paused | ended
    this.punchCooldown = 0;
    this.saveTimer = 0;
    this.timeSec = 0;
    this.shotSeed = 13;
    this.beaconMesh = null;

    this.spawnParkedCars();
    this.spawnCoins();
    this.people.spawnAmbientThugs(this.city.spots.plaza);
    this.placePlayerAtHideout();
    this.buildMarkerBeacon();
    this.hud.showMenu(this.loadSaveRaw() !== null);
    this.hud.update(0, this.hudState());
    this.missions.start(0);
    window.addEventListener('resize', () => this.onResize());
  }

  // --- setup ---------------------------------------------------------------
  spawnParkedCars() {
    const rng = new Rng(99);
    const spots = [
      { x: 104, z: -96 }, { x: 118, z: -104 }, // hideout lot
      { x: -58, z: -58 }, // casino lot
      { x: 58, z: 74 }, // garage forecourt
      { x: -102, z: 102 }, // diner lot
      { x: 30, z: 30 }, // plaza edge
      { x: -14, z: 118 }, // park edge
      { x: 34, z: -14 }, // tower base
    ];
    for (const spot of spots) {
      const kind = rng.pick(['sedan', 'sedan', 'sport', 'truck']);
      const mesh = makeCarMesh(kind, rng.pick([0xd23b3b, 0x3b7dd2, 0x37c978, 0xe8c93b, 0xdddddd]));
      this.scene.add(mesh);
      const car = new Car(mesh, kind, { x: spot.x, z: spot.z, heading: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) });
      car.parked = true;
      this.parkedCars.push(car);
    }
  }

  spawnCoins() {
    const rng = new Rng(1313);
    this.coins = [];
    const coinGeo = new THREE.TorusGeometry(0.55, 0.18, 8, 20);
    const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    for (let i = 0; i < 12; i++) {
      const pt = this.city.randomRoadPoint(rng);
      // Nudge the coin onto the sidewalk instead of the middle of the road.
      const x = pt.x + rng.range(-9, 9);
      const z = pt.z + rng.range(-9, 9);
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.position.set(x, 1.1, z);
      this.scene.add(mesh);
      this.coins.push({ x, z, mesh, taken: false, phase: rng.range(0, Math.PI * 2) });
    }
  }

  buildMarkerBeacon() {
    const geo = new THREE.CylinderGeometry(0.9, 0.9, 26, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beaconMesh = new THREE.Mesh(geo, mat);
    this.beaconMesh.visible = false;
    this.scene.add(this.beaconMesh);
  }

  placePlayerAtHideout() {
    const h = this.city.spots.hideout;
    this.player.x = h.x + 6;
    this.player.z = h.z + 10;
    this.player.heading = Math.PI;
    this.player.vy = 0;
    this.player.onGround = true;
    this.syncPlayerMesh();
  }

  syncPlayerMesh() {
    this.playerMesh.position.set(this.player.x, this.player.y || 0, this.player.z);
    this.playerMesh.rotation.y = this.player.heading;
  }

  // --- public API (staging + play-test driver) ------------------------------
  toMenu() {
    this.state = 'menu';
    this.audio.setMuted(true);
    this.hud.showMenu(this.loadSaveRaw() !== null);
  }

  setClock(hours, minutes) {
    this.clockMin = hours * 60 + minutes;
  }

  setCameraMode(mode) {
    this.cameraMode = mode % 3;
  }

  setAutoDrive(on) {
    this.autoDrive = on;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.wantedGrace = 20;
  }

  startMission(index) {
    this.missions.start(index);
  }

  teleportPlayer(x, z, heading = 0) {
    this.exitCar(true);
    this.player.x = x;
    this.player.z = z;
    this.player.heading = heading;
    this.player.y = 0;
    this.syncPlayerMesh();
  }

  giveCar(kind, color, x, z, heading) {
    if (this.car) this.exitCar(true);
    const mesh = makeCarMesh(kind, color);
    this.scene.add(mesh);
    const car = new Car(mesh, kind, { x, z, heading, maxSpeed: kind === 'sport' ? 30 : 24 });
    car.owner = 'player';
    this.car = car;
    this.playerMesh.visible = false;
    return car;
  }

  placePoliceAhead(count, dist) {
    // Use the car (not the player object) when driving: at staging time the
    // player position has not been synced from the car yet.
    const ref = this.car ?? this.player;
    const f = { x: Math.sin(ref.heading), z: Math.cos(ref.heading) };
    for (let i = 0; i < count; i++) {
      const mesh = makeCarMesh('police', 0xffffff);
      this.scene.add(mesh);
      const lateral = i % 2 === 0 ? -4.5 : 4.5;
      // Same direction as the player, holding a steady gap ahead so the
      // chase camera keeps them in frame (they do not pursue in shot mode).
      const cruiser = new Car(mesh, 'police', {
        x: ref.x + f.x * (dist + i * 9) - f.z * lateral,
        z: ref.z + f.z * (dist + i * 9) + f.x * lateral,
        heading: ref.heading,
        maxSpeed: 31,
        accel: 16,
      });
      cruiser.speed = 8;
      cruiser.shotHold = true;
      this.police.cruisers.push(cruiser);
    }
  }

  // --- game flow --------------------------------------------------------------
  startGame(fresh) {
    this.audio.unlock();
    this.audio.setMuted(false);
    if (fresh) {
      this.cash = START_CASH;
      this.health = START_HEALTH;
      this.wanted = 0;
      this.coins.forEach((c) => { c.taken = false; c.mesh.visible = true; });
      this.placePlayerAtHideout();
      this.missions.start(0);
      this.clockMin = 18 * 60;
      this.day = 1;
    } else {
      const save = this.loadSaveRaw();
      if (save) {
        this.cash = save.cash;
        this.health = save.health;
        this.player.x = save.x;
        this.player.z = save.z;
        this.player.heading = save.heading;
        this.clockMin = save.clockMin;
        this.day = save.day;
        this.coins.forEach((c, i) => {
          c.taken = save.coinsTaken.includes(i);
          c.mesh.visible = !c.taken;
        });
        this.missions.start(save.missionIndex);
        this.syncPlayerMesh();
      }
    }
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.hideEnd();
    this.hud.toast('Welcome back to Solmar Bay, Lena.');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.save();
    this.hud.showPause(`Progress autosaved — $${Math.floor(this.cash)} · mission ${this.missions.index + 1} of 5.`);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.hidePause();
  }

  respawn() {
    // Busted or wasted: pay the fine, wake up at the hideout, heat gone.
    const fine = Math.floor(this.cash * 0.15);
    this.cash = Math.max(0, this.cash - fine);
    this.health = START_HEALTH;
    this.wanted = 0;
    this.bustedTimer = 0;
    this.exitCar(true);
    this.placePlayerAtHideout();
    this.state = 'playing';
    this.hud.hideEnd();
    this.hud.toast(fine > 0 ? `You paid a $${fine} fine. Back on the streets.` : 'Back on the streets.');
    this.save();
  }

  // --- save / load --------------------------------------------------------------
  save() {
    try {
      const data = {
        cash: Math.floor(this.cash),
        health: Math.round(this.health),
        missionIndex: this.missions.done ? 5 : this.missions.index,
        x: this.player.x,
        z: this.player.z,
        heading: this.player.heading,
        clockMin: Math.floor(this.clockMin),
        day: this.day,
        coinsTaken: this.coins.map((c, i) => (c.taken ? i : -1)).filter((i) => i >= 0),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (err) {
      // Storage can be unavailable (private mode); the game plays on.
    }
  }

  loadSaveRaw() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  // --- player --------------------------------------------------------------
  exitCar(silent = false) {
    if (!this.car) return;
    const car = this.car;
    const rx = Math.cos(car.heading);
    const rz = -Math.sin(car.heading);
    this.player.x = car.x + rx * 2.4;
    this.player.z = car.z + rz * 2.4;
    this.player.heading = car.heading;
    this.player.y = 0;
    this.car = null;
    this.playerMesh.visible = true;
    this.syncPlayerMesh();
    if (!silent) this.hud.toast('On foot.');
  }

  tryEnterCar() {
    const candidates = [...this.parkedCars, ...this.traffic.cars];
    let best = null;
    let bestDist = 3.6;
    for (const car of candidates) {
      if (car.damage >= 1) continue;
      if (car.isTraffic && Math.abs(car.speed) > 2) continue; // no carjacking a moving car
      const d = Math.hypot(car.x - this.player.x, car.z - this.player.z);
      if (d < bestDist) { best = car; bestDist = d; }
    }
    if (!best) {
      this.hud.toast('No car close enough.');
      return;
    }
    const stolen = best.owner !== 'player';
    this.car = best;
    best.parked = false;
    if (stolen) {
      best.owner = 'player';
      best.stolen = true;
      this.addWanted(1);
      this.hud.toast('Car stolen! The cops noticed.');
      this.audio.horn();
    }
    this.playerMesh.visible = false;
  }

  addWanted(n) {
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    this.wantedGrace = 15;
    this.wantedDecay = 0;
  }

  updatePlayer(dt) {
    const p = this.player;
    if (this.car) {
      // Driving.
      const axes = this.autoDrive ? { throttle: 1, steer: 0 } : this.input.driveAxes();
      this.car.drive(dt, axes.throttle, axes.steer, this.city.colliders);
      p.x = this.car.x;
      p.z = this.car.z;
      p.heading = this.car.heading;
      // Wrecked car: bail out.
      if (this.car.damage >= 1) {
        this.hud.toast('Car wrecked!');
        this.audio.crash(1);
        this.exitCar(true);
      }
      // Garage repair: stopped near Rosa's.
      const g = this.city.spots.garage;
      if (Math.hypot(this.car.x - g.x, this.car.z - g.z) < 11 && Math.abs(this.car.speed) < 1 && this.car.damage > 0) {
        this.car.damage = 0;
        this.hud.toast("Rosa's Garage: good as new.");
      }
      return;
    }
    // On foot.
    const axes = this.input.moveAxes();
    const sprint = this.input.isDown('ShiftLeft', 'ShiftRight') ? 1.65 : 1;
    const speed = 4.4 * sprint;
    const moving = axes.forward !== 0 || axes.strafe !== 0;
    if (moving) {
      // Strafe right (D) is the camera's right: atan2(-strafe, forward).
      const want = Math.atan2(-axes.strafe, axes.forward) + this.cameraHeading();
      let dh = want - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-8 * dt, Math.min(8 * dt, dh));
      const nx = p.x + Math.sin(p.heading) * speed * dt;
      const nz = p.z + Math.cos(p.heading) * speed * dt;
      const res = collideCircleBox(nx, nz, 0.55, this.city.colliders);
      p.x = res.x;
      p.z = res.z;
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    // Jump: about a metre high.
    if (this.input.wasPressed('Space') && p.onGround) {
      p.vy = 5.0;
      p.onGround = false;
    }
    if (!p.onGround) {
      p.vy -= 12 * dt;
      p.y = (p.y || 0) + p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.onGround = true;
      }
    }
    // Walk-cycle limb swing.
    const phase = this.timeSec * (4 + p.speed * 2.2);
    const swing = Math.sin(phase) * 0.5 * Math.min(1, p.speed / 3);
    const u = this.playerMesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    this.syncPlayerMesh();
    // Punch (F or mouse click).
    this.punchCooldown -= dt;
    const wantPunch = this.input.wasPressed('KeyF') || this.mousePressedThisFrame;
    if (wantPunch && this.punchCooldown <= 0) {
      this.punchCooldown = 0.45;
      this.audio.punch();
      const killed = this.people.playerPunch(p.x, p.z, p.heading);
      for (const thug of killed) {
        this.cash += THUG_REWARD;
        this.hud.toast(`Thug down! +$${THUG_REWARD}`);
      }
    }
  }

  cameraHeading() {
    // The camera sits behind the player, so "forward" is the camera's yaw.
    return this.camYaw ?? this.player.heading;
  }

  // --- per-frame update -------------------------------------------------------
  update(dt) {
    this.timeSec += dt;
    this.clockMin += dt; // 1 game minute per real second
    if (this.clockMin >= 24 * 60) {
      this.clockMin -= 24 * 60;
      this.day++;
    }
    this.mousePressedThisFrame = this.input.beginFrame();

    if (this.state === 'playing') {
      // Global keys.
      if (this.input.wasPressed('KeyP', 'Escape')) this.pause();
      if (this.input.wasPressed('KeyC')) this.setCameraMode(this.cameraMode + 1);
      if (this.input.wasPressed('KeyN')) this.hud.toast(`Radio: ${this.audio.nextStation()}`);
      if (this.input.wasPressed('KeyH') && this.car) this.audio.horn();
      if (this.input.wasPressed('KeyL') && this.car) this.car.setHeadlights(!this.car.headlightsOn);
      if (this.input.wasPressed('KeyE')) {
        if (this.car) this.exitCar();
        else this.tryEnterCar();
      }

      this.updatePlayer(dt);
      const allCars = [...this.traffic.cars, ...this.parkedCars, ...(this.car ? [this.car] : []), ...this.police.cruisers];
      this.traffic.update(dt, this.timeSec, this.city.colliders, allCars);
      this.police.update(dt, this.timeSec, this.player, this.wanted, this.city.colliders, (cruiser) => {
        if (this.car) {
          this.car.damage = Math.min(1, this.car.damage + 0.05);
          this.car.speed *= 0.55;
          this.audio.crash(0.7);
          this.hud.flashDamage();
        } else {
          this.health -= 10;
          this.hud.flashDamage();
          this.audio.crash(0.6);
          const dx = this.player.x - cruiser.x;
          const dz = this.player.z - cruiser.z;
          const d = Math.hypot(dx, dz) || 1;
          this.player.x += (dx / d) * 1.2;
          this.player.z += (dz / d) * 1.2;
        }
      });
      this.people.update(dt, this.player, !!this.car, this.car ? this.car.speedKmh() : this.player.speed * 3.6, (damage) => {
        this.health -= damage;
        this.hud.flashDamage();
        this.audio.punch();
      });
      this.missions.update(dt, this.player, this.car);

      // Coins.
      for (const coin of this.coins) {
        if (coin.taken) continue;
        coin.mesh.rotation.y += dt * 2;
        coin.mesh.position.y = 1.1 + Math.sin(this.timeSec * 2 + coin.phase) * 0.18;
        if (Math.hypot(this.player.x - coin.x, this.player.z - coin.z) < 1.9) {
          coin.taken = true;
          coin.mesh.visible = false;
          this.cash += COIN_VALUE;
          this.audio.coin();
          this.hud.toast(`Neon coin! +$${COIN_VALUE}`);
        }
      }

      // Wanted decay: out of sight, heat fades one star at a time.
      if (this.wanted > 0) {
        this.wantedGrace -= dt;
        const nearestCop = this.police.cruisers.reduce((m, c) => Math.min(m, Math.hypot(c.x - this.player.x, c.z - this.player.z)), 999);
        if (this.wantedGrace <= 0 && nearestCop > 42) {
          this.wantedDecay += dt;
          if (this.wantedDecay > 6) {
            this.wanted--;
            this.wantedDecay = 0;
            this.wantedGrace = 4;
            if (this.wanted === 0) this.hud.toast('You lost the cops.');
          }
        } else {
          this.wantedDecay = 0;
        }
      }

      // Busted: a cruiser sits on the player on foot.
      if (!this.car && this.wanted > 0) {
        const near = this.police.cruisers.some((c) => Math.hypot(c.x - this.player.x, c.z - this.player.z) < 3.2);
        this.bustedTimer = near ? this.bustedTimer + dt : 0;
        if (this.bustedTimer > 1.5) {
          this.state = 'ended';
          this.audio.fail();
          this.hud.showEnd('busted', 'The Solmar PD caught up with you. Bail is 15% of your cash — pay up and walk.');
          return;
        }
      } else {
        this.bustedTimer = 0;
      }

      // Wasted: beaten to zero health.
      if (this.health <= 0) {
        this.health = 0;
        this.state = 'ended';
        this.audio.fail();
        this.hud.showEnd('wasted', 'You got flattened. The hospital bill is 15% of your cash — you wake up at the hideout.');
        return;
      }

      // Autosave every 30 seconds.
      this.saveTimer += dt;
      if (this.saveTimer > 30) {
        this.saveTimer = 0;
        this.save();
      }

      this.audio.update(dt, this.car ? this.car.speedKmh() : 0, this.wanted);
    }

    this.city.update(dt, this.timeSec);
    // The mission marker beacon stands where the marker is.
    if (this.marker) {
      this.beaconMesh.visible = true;
      this.beaconMesh.position.set(this.marker.x, 13, this.marker.z);
      this.beaconMesh.rotation.y = this.timeSec * 0.8;
    } else {
      this.beaconMesh.visible = false;
    }
    this.updateCamera(dt);
    this.hud.update(dt, this.hudState());
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(dt) {
    const p = this.player;
    if (this.state === 'menu') {
      const a = this.timeSec * 0.05;
      this.camera.position.set(Math.cos(a) * 130, 58, Math.sin(a) * 130);
      this.camera.lookAt(22, 20, -22);
      this.camYaw = Math.atan2(-Math.cos(a), -Math.sin(a));
      return;
    }
    const dist = [8.5, 5.2, 15][this.cameraMode];
    const height = [3.4, 2.0, 9.5][this.cameraMode];
    const back = this.camYaw ?? p.heading;
    const tx = p.x - Math.sin(back) * dist;
    const tz = p.z - Math.cos(back) * dist;
    if (this.shotMode) {
      // Staged screenshots: snap straight to the chase position so a slow
      // software renderer cannot leave the camera trailing high above.
      this.camYaw = p.heading;
      this.camera.position.set(tx, height, tz);
      this.camera.lookAt(p.x + Math.sin(p.heading) * 4, 1.6, p.z + Math.cos(p.heading) * 4);
      return;
    }
    const k = 1 - Math.exp(-dt * 5);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(p.x + Math.sin(p.heading) * 4, 1.6, p.z + Math.cos(p.heading) * 4);
    // The camera yaw follows the player's heading (smoothed).
    let dh = p.heading - (this.camYaw ?? p.heading);
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.camYaw = (this.camYaw ?? p.heading) + dh * Math.min(1, dt * 3);
  }

  hudState() {
    const hours = Math.floor(this.clockMin / 60);
    const minutes = Math.floor(this.clockMin % 60);
    return {
      cash: this.cash,
      health: this.health,
      wanted: this.wanted,
      clock: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      day: this.day,
      speedKmh: this.car ? this.car.speedKmh() : 0,
      inCar: !!this.car,
      objective: this.objective,
      radio: this.audio.stationName(),
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
      marker: this.marker,
      police: this.police.cruisers,
      spots: this.city.spots,
      coins: this.coins,
    };
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - (this.lastNow ?? now));
      this.lastNow = now;
      this.update(dt);
    };
    requestAnimationFrame(loop);
  }
}
