// Engine for Solmar Bay (v10): renderer, game loop, state machine, wanted
// system, combat, coins, save/load and the debug hooks the test driver uses.
// The game object is built here and handed to every subsystem.

import { createRng } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPeople } from './people.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'solmar-bay-save-v1';
const COIN_SPOTS = 12;

export function createGame(opts) {
  const THREE = window.THREE;
  const fxLow = !!opts.fxLow;
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !fxLow, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(fxLow ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !fxLow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(60, 30, 120);

  const game = {
    scene, camera, renderer, canvas,
    state: 'menu',
    cash: 200,
    health: 100,
    wanted: 0,
    time: 0,
    clockMinutes: 19 * 60 + 40,
    cameraMode: 0,
    cameraYaw: Math.PI,
    lightsOn: false,
    fixedCamera: null,
    shotStaged: false,
    shotFrames: 0,
  };

  game.rng = createRng(2026);
  game.input = createInput();
  game.audio = createAudio();
  game.city = buildCity(scene, game.rng);

  // Neon coins: 12, scattered on sidewalks and the plaza.
  game.coins = [];
  const coinGeo = new THREE.TorusGeometry(0.55, 0.18, 10, 20);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  const coinSpots = [];
  coinSpots.push({ x: game.city.plaza.x, z: game.city.plaza.z });
  coinSpots.push({ x: game.city.park.x, z: game.city.park.z });
  coinSpots.push({ x: game.city.marina.x, z: game.city.marina.z - 10 });
  for (let i = 3; i < COIN_SPOTS; i += 1) {
    coinSpots.push(game.city.randomSidewalkPoint());
  }
  coinSpots.forEach((p, i) => {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.position.set(p.x, 1.1, p.z);
    scene.add(mesh);
    game.coins.push({ mesh, pos: mesh.position, taken: false, id: i });
  });

  game.people = createPeople(game);
  game.hero = game.people.hero;
  game.vehicles = createVehicles(game);
  game.traffic = game.vehicles; // alias: the test driver reads __game.traffic.parked
  game.missions = createMissions(game);
  game.hud = createHud(game);

  // ---- helpers the subsystems call back into ----
  game.toast = (msg) => game.hud.toast(msg);
  game.addCash = (n) => { game.cash += n; };
  game.clockText = () => {
    const m = ((Math.floor(game.clockMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  game.cameraModeName = () => ['NEAR', 'FAR', 'TOP'][game.cameraMode];
  game.speedKmh = () => {
    const car = game.vehicles.playerCar;
    if (car) return Math.abs(car.speed) * 3.6;
    return 0;
  };
  game.setWanted = (n) => {
    game.wanted = Math.max(0, Math.min(5, n));
    game.crimeTimer = 0;
    game.decayTimer = 0;
    syncPolice();
  };
  game.addWanted = (n) => {
    if (game.wanted >= 5) return;
    game.wanted = Math.min(5, game.wanted + n);
    game.crimeTimer = 0;
    game.decayTimer = 0;
    syncPolice();
    if (game.wanted > 0) game.audio.startSiren();
  };
  game.crimeTimer = 0;
  game.decayTimer = 0;

  function syncPolice() {
    const want = Math.min(game.wanted, 4);
    if (game.vehicles.police.length < want) {
      game.vehicles.spawnPolice(want, { x: game.hero.pos.x, z: game.hero.pos.z });
    } else if (game.vehicles.police.length > want) {
      game.vehicles.removePolice(want);
    }
    if (game.wanted === 0) game.audio.stopSiren();
  }

  game.onCarCrash = (impact) => {
    if (impact > 14) {
      game.health -= (impact - 14) * 1.0;
      if (game.health <= 0) { game.health = 0; wasted(); }
    }
  };
  game.onPoliceRam = () => {
    const car = game.vehicles.playerCar;
    if (!car) return;
    car.damage = Math.min(100, car.damage + 6);
    car.speed *= 0.7;
    game.audio.crash(0.4);
    if (game.health > 0 && car.speed > 4) {
      game.health -= 2;
      if (game.health <= 0) { game.health = 0; wasted(); }
    }
  };
  game.onMissionComplete = () => saveGame();

  function busted() {
    if (game.state !== 'playing') return;
    game.state = 'busted';
    const fine = Math.max(50, Math.floor(game.cash * 0.1));
    game.cash = Math.max(0, game.cash - fine);
    game.audio.busted();
    game.audio.stopSiren();
    game.audio.setEngine(0, false);
    game.setWanted(0);
    game.hud.setEnd('BUSTED', `The Solmar Bay PD caught Lena. Fine: $${fine}.`);
    game.hud.showMenu('end');
    game.input.setEnabled(false);
    saveGame();
  }
  function wasted() {
    if (game.state !== 'playing') return;
    game.state = 'wasted';
    const fine = Math.max(50, Math.floor(game.cash * 0.15));
    game.cash = Math.max(0, game.cash - fine);
    game.audio.busted();
    game.audio.stopSiren();
    game.audio.setEngine(0, false);
    game.setWanted(0);
    game.hud.setEnd('WASTED', `Lena is down. Hospital bill: $${fine}.`);
    game.hud.showMenu('end');
    game.input.setEnabled(false);
    saveGame();
  }
  function respawn() {
    game.health = 100;
    game.hero.pos.set(game.city.hideout.x, 0, game.city.hideout.z - 14);
    game.hero.velY = 0;
    game.hero.onGround = true;
    game.hero.mesh.visible = true;
    if (game.vehicles.playerCar) {
      const car = game.vehicles.playerCar;
      scene.remove(car.mesh);
      game.vehicles.exitCar();
    }
    game.missions.setIndex(game.missions.index);
    game.state = 'playing';
    game.hud.showMenu(null);
    game.input.setEnabled(true);
    game.audio.resume();
    game.toast('Back on the streets. Stay sharp, Lena.');
    saveGame();
  }

  // ---- save / load ----
  function saveGame() {
    try {
      const taken = game.coins.filter((c) => c.taken).map((c) => c.id);
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, cash: game.cash, health: game.health,
        mission: game.missions.index,
        px: Math.round(game.hero.pos.x * 10) / 10,
        pz: Math.round(game.hero.pos.z * 10) / 10,
        coins: taken,
      }));
    } catch (e) { /* storage unavailable: play on without a save */ }
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return null;
      return s;
    } catch (e) {
      return null;
    }
  }
  game.save = saveGame;
  game.load = loadSave;

  // ---- actions ----
  function tryEnterExitCar() {
    if (game.vehicles.playerCar) {
      game.vehicles.exitCar();
      game.audio.stopRadio();
      return;
    }
    const car = game.vehicles.nearestStealable(game.hero.pos.x, game.hero.pos.z, 4.2);
    if (car) {
      game.vehicles.enterCar(car);
      game.addWanted(1);
      game.toast('Car stolen — wanted +1 star.');
      game.audio.startRadio();
    }
  }
  function tryPunch() {
    if (game.vehicles.playerCar) return;
    const hit = game.people.heroPunch();
    if (!hit) return;
    game.audio.punch();
    if (hit.kind === 'thug' && hit.ref.down) {
      game.addCash(25);
      game.toast('Thug down — +$25.');
    } else if (hit.kind === 'cop') {
      game.addWanted(2);
      game.toast('You hit a cop — wanted +2 stars.');
      if (hit.ref.down) game.toast('Cop down. The PD will remember that.');
    } else if (hit.kind === 'boss' && hit.ref.down) {
      game.toast('Vic Marino is down!');
    }
  }
  function pauseGame() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    game.hud.showMenu('pause');
    game.audio.setEngine(0, false);
    saveGame();
  }
  function resumeGame() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    game.hud.showMenu(null);
    game.audio.resume();
  }

  game.teleport = (x, z) => {
    const fixed = game.city.collideCircle(x, z, 0.8);
    game.hero.pos.set(fixed.x, 0, fixed.z);
    const car = game.vehicles.playerCar;
    if (car) {
      car.mesh.position.set(fixed.x, 0, fixed.z);
      game.hero.pos.set(fixed.x, 0, fixed.z);
    }
    game.snapCamera();
  };
  game.giveCar = (type, x, z, heading) => game.vehicles.giveCar(type, x, z, heading);
  game.debugState = () => ({
    state: game.state,
    cash: game.cash,
    health: Math.round(game.health),
    wanted: game.wanted,
    mission: game.missions.index,
    missionName: game.missions.name,
    objective: game.missions.objective(),
    speedKmh: Math.round(game.speedKmh()),
    inCar: !!game.vehicles.playerCar,
    carDamage: game.vehicles.playerCar ? Math.round(game.vehicles.playerCar.damage) : null,
    pos: { x: Math.round(game.hero.pos.x * 10) / 10, z: Math.round(game.hero.pos.z * 10) / 10 },
    coins: game.coins.filter((c) => c.taken).length,
    time: Math.round(game.time * 10) / 10,
  });

  // ---- camera ----
  const camTarget = new THREE.Vector3();
  function followCamera(dt, snap) {
    if (game.fixedCamera) {
      const f = game.fixedCamera;
      camera.position.set(f.x, f.y, f.z);
      camera.lookAt(f.tx, f.ty, f.tz);
      return;
    }
    const car = game.vehicles.playerCar;
    const focus = car ? car.mesh.position : game.hero.pos;
    const heading = car ? car.heading : game.hero.heading;
    const targetYaw = game.cameraMode === 2 ? Math.PI : heading;
    let dy = targetYaw - game.cameraYaw;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    const k = snap ? 1 : 1 - Math.exp(-2.6 * dt);
    game.cameraYaw += dy * k;
    const dist = [8.5, 14, 3][game.cameraMode];
    const height = [3.4, 7, 26][game.cameraMode];
    const fx = Math.sin(game.cameraYaw);
    const fz = Math.cos(game.cameraYaw);
    const dx = focus.x - fx * dist;
    const dz = focus.z - fz * dist;
    if (snap) {
      camera.position.set(dx, focus.y + height, dz);
    } else {
      const ck = 1 - Math.exp(-6 * dt);
      camera.position.x += (dx - camera.position.x) * ck;
      camera.position.y += (focus.y + height - camera.position.y) * ck;
      camera.position.z += (dz - camera.position.z) * ck;
    }
    camTarget.set(focus.x + fx * 3, focus.y + 1.6, focus.z + fz * 3);
    if (game.cameraMode === 2) camTarget.set(focus.x, focus.y, focus.z);
    camera.lookAt(camTarget);
  }
  game.snapCamera = () => followCamera(0, true);

  // ---- menu buttons ----
  function bindButton(id, fn) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => { game.audio.resume(); game.audio.click(); fn(); });
  }
  bindButton('btn-start', () => {
    game.cash = 200;
    game.health = 100;
    game.setWanted(0);
    game.missions.setIndex(0);
    game.missions.startMission(0);
    game.hero.pos.set(game.city.hideout.x, 0, game.city.hideout.z - 14);
    game.hero.heading = Math.PI;
    game.state = 'playing';
    game.hud.showMenu(null);
    game.input.setEnabled(true);
    game.audio.startEngine();
    game.toast('Lena Cruz — Barracuda crew. Solmar Bay is waiting.');
  });
  bindButton('btn-continue', () => {
    const s = loadSave();
    if (!s) return;
    game.cash = s.cash;
    game.health = s.health;
    game.missions.setIndex(s.mission);
    game.hero.pos.set(s.px, 0, s.pz);
    game.hero.heading = Math.PI;
    for (const id of s.coins || []) {
      const c = game.coins[id];
      if (c) { c.taken = true; c.mesh.visible = false; }
    }
    game.setWanted(0);
    game.state = 'playing';
    game.hud.showMenu(null);
    game.input.setEnabled(true);
    game.audio.startEngine();
    game.toast(`Welcome back — Mission ${s.mission + 1}, $${s.cash}.`);
  });
  bindButton('btn-resume', resumeGame);
  bindButton('btn-quit', () => {
    game.state = 'menu';
    game.fixedCamera = null;
    game.hud.showMenu('start');
    game.input.setEnabled(false);
    refreshMenuSaveNote();
  });
  bindButton('btn-respawn', respawn);

  function refreshMenuSaveNote() {
    const s = loadSave();
    if (s) {
      game.hud.setSaveNote(`Save found: $${s.cash} — Mission ${s.mission + 1} (${game.missions.defs[s.mission] ? game.missions.defs[s.mission].name : 'Free Roam'}).`, true);
    } else {
      game.hud.setSaveNote('No save yet. Start a new game.', false);
    }
  }

  // ---- per-frame update ----
  let autosaveT = 0;
  let frameCount = 0;
  let lastHurt = -10;
  let lastT = performance.now();

  function handleActions() {
    const input = game.input;
    if (input.wasPressed('KeyE')) tryEnterExitCar();
    if (input.wasPressed('KeyF') || input.clicked()) tryPunch();
    if (input.wasPressed('KeyH')) {
      game.audio.horn();
      // Scare nearby pedestrians.
      for (const p of game.people.pedestrians) {
        const d = Math.hypot(p.pos.x - game.hero.pos.x, p.pos.z - game.hero.pos.z);
        if (d < 14) p.fleeT = 2;
      }
    }
    if (input.wasPressed('KeyL')) {
      game.lightsOn = !game.lightsOn;
      game.vehicles.setHeadlights(game.lightsOn);
      game.toast(game.lightsOn ? 'Headlights on.' : 'Headlights off.');
    }
    if (input.wasPressed('KeyN')) {
      const name = game.audio.nextStation();
      game.toast(`Radio: ${name}`);
    }
    if (input.wasPressed('KeyC')) {
      game.cameraMode = (game.cameraMode + 1) % 3;
      game.snapCamera();
    }
  }

  function update(dt) {
    const input = game.input;
    handleActions();
    if (game.state !== 'playing') return;

    // Traffic-light cycle: 12 s per phase.
    game.city.lightState.timer += dt;
    if (game.city.lightState.timer > 12) {
      game.city.lightState.timer = 0;
      game.city.lightState.phase = 1 - game.city.lightState.phase;
      const nsGreen = game.city.lightState.phase === 0;
      for (const h of game.city.lightHeads) {
        h.red.material.color.setHex(nsGreen ? 0x440000 : 0xff2222);
        h.green.material.color.setHex(nsGreen ? 0x22ff66 : 0x003311);
      }
    }

    // Move the hero (on foot) or the car.
    const car = game.vehicles.playerCar;
    if (car) {
      game.vehicles.drivePlayer(dt, input);
      game.hero.pos.set(car.mesh.position.x, 0, car.mesh.position.z);
      game.hero.heading = car.heading;
    } else {
      game.people.updateHero(dt, input, game.cameraYaw);
    }

    // Wanted decay: 20 s quiet, then -1 star every 10 s out of sight.
    if (game.wanted > 0) {
      game.crimeTimer += dt;
      let copNear = false;
      for (const p of game.vehicles.police) {
        if (Math.hypot(p.mesh.position.x - game.hero.pos.x, p.mesh.position.z - game.hero.pos.z) < 26) { copNear = true; break; }
      }
      if (game.crimeTimer > 20 && !copNear) {
        game.decayTimer += dt;
        if (game.decayTimer > 10) {
          game.decayTimer = 0;
          game.setWanted(game.wanted - 1);
          game.toast('Wanted level falling — stay out of sight.');
        }
      }
    }

    // Foot cops: spawn up to 2 while wanted >= 2 and the hero is on foot.
    if (game.wanted >= 2 && !car) {
      while (game.people.cops.filter((c) => !c.down).length < 2) {
        const a = game.rng.range(0, Math.PI * 2);
        const x = game.hero.pos.x + Math.sin(a) * 22;
        const z = game.hero.pos.z + Math.cos(a) * 22;
        const fixed = game.city.collideCircle(x, z, 0.8);
        game.people.spawnCop(fixed.x, fixed.z);
      }
    } else if (car || game.wanted < 2) {
      for (let i = game.people.cops.length - 1; i >= 0; i -= 1) {
        scene.remove(game.people.cops[i].mesh);
        game.people.cops.splice(i, 1);
      }
    }

    game.vehicles.updateTraffic(dt, game.time);
    game.vehicles.updatePolice(dt, game.hero.pos, !!car, game.time);
    // A police car touching the hero on foot means busted.
    if (!car) {
      for (const p of game.vehicles.police) {
        if (Math.hypot(p.mesh.position.x - game.hero.pos.x, p.mesh.position.z - game.hero.pos.z) < 2.6) {
          busted();
          return;
        }
      }
    }
    const scared = game.wanted > 0;
    game.people.updatePedestrians(dt, game.hero.pos, scared);
    game.people.updateThugs(dt, game.hero.pos, (dmg) => {
      if (game.time - lastHurt > 0.6) {
        lastHurt = game.time;
        game.health -= dmg;
        game.audio.punch();
        if (game.health <= 0) { game.health = 0; wasted(); }
      }
    });
    game.people.updateCops(dt, game.hero.pos, (dmg) => {
      if (game.time - lastHurt > 0.6) {
        lastHurt = game.time;
        game.health -= dmg;
        game.audio.punch();
        if (game.health <= 0) { game.health = 0; wasted(); }
      }
    }, () => busted());
    game.people.updateBoss(dt, game.hero.pos, (dmg) => {
      if (game.time - lastHurt > 0.6) {
        lastHurt = game.time;
        game.health -= dmg;
        game.audio.punch();
        if (game.health <= 0) { game.health = 0; wasted(); }
      }
    });

    game.missions.update(dt);

    // Coins.
    for (const c of game.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 1.1 + Math.sin(game.time * 2 + c.id) * 0.15;
      const d = Math.hypot(c.pos.x - game.hero.pos.x, c.pos.z - game.hero.pos.z);
      if (d < 2.6) {
        c.taken = true;
        c.mesh.visible = false;
        game.addCash(40);
        game.audio.coin();
        game.toast('Neon coin +$40.');
      }
    }

    // Health regen after 8 s without a hit.
    if (game.health > 0 && game.health < 100 && game.time - lastHurt > 8) {
      game.health = Math.min(100, game.health + 1.2 * dt);
    }

    // Rosa's Garage repairs (not while mission 1 is waiting on an undamaged car).
    if (car && game.missions.index !== 0 && car.damage > 0) {
      const d = Math.hypot(car.mesh.position.x - game.city.garage.x, car.mesh.position.z - game.city.garage.z);
      if (d < 9 && game.cash >= 25) {
        car.damage = 0;
        game.cash -= 25;
        game.audio.coin();
        game.toast("Rosa's Garage: repaired -$25.");
      }
    }

    // Clock: 1 game minute per 1.5 real seconds.
    game.clockMinutes += dt / 1.5;
    autosaveT += dt;
    if (autosaveT > 30) {
      autosaveT = 0;
      saveGame();
    }
  }

  function animate() {
    const dt = Math.min(0.1, Math.max(0.001, (performance.now() - lastT) / 1000));
    lastT = performance.now();
    game.time += dt;
    game.input.snapshot();
    // Pause / resume works from any state (update() only runs while playing).
    if (game.input.wasPressed('KeyP', 'Escape')) {
      if (game.state === 'playing') pauseGame();
      else if (game.state === 'paused') resumeGame();
    }
    if (game.state === 'playing' || game.state === 'menu') {
      if (game.state === 'menu') {
        // Ambient city life behind the menu.
        game.vehicles.updateTraffic(dt, game.time);
        game.people.updatePedestrians(dt, game.hero.pos, false);
      } else {
        update(dt);
      }
    }
    // Ambient animation: beacon sweep, boats, water.
    if (game.city.animated.beacon) {
      game.city.animated.beacon.target.position.set(
        22 + Math.sin(game.time * 0.5) * 120, 0, -66 + Math.cos(game.time * 0.5) * 120,
      );
    }
    for (const b of game.city.animated.boats) {
      b.position.y = Math.sin(game.time * 0.8 + b.position.x) * 0.15;
      b.rotation.z = Math.sin(game.time * 0.6 + b.position.x) * 0.02;
    }
    if (game.city.animated.waterMat && game.city.animated.waterMat.map) {
      game.city.animated.waterMat.map.offset.x = game.time * 0.01;
    }
    followCamera(dt, false);
    frameCount += 1;
    if (frameCount % 3 === 0) game.hud.drawMinimap();
    game.hud.update();
    // Engine hum follows the player car.
    const pcar = game.vehicles.playerCar;
    game.audio.setEngine(pcar ? Math.abs(pcar.speed) / 28 : 0, !!pcar);
    renderer.render(scene, camera);
    if (game.shotStaged) {
      game.shotFrames += 1;
      if (game.shotFrames >= 2) window.__shotReady = true;
    }
    requestAnimationFrame(animate);
  }

  // ---- boot ----
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  refreshMenuSaveNote();
  game.hud.showMenu('start');
  game.input.setEnabled(false);

  // Screenshot staging (?shot=...&seed=...).
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const shotSeed = parseInt(params.get('seed') || '1', 10);
  game.fxLow = fxLow;
  if (shotName) {
    game.input.setEnabled(true);
    if (applyShot(game, shotName, Number.isFinite(shotSeed) ? shotSeed : 1)) {
      game.shotStaged = true;
    }
  }

  window.__game = game;
  requestAnimationFrame(animate);
  return game;
}
