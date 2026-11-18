// Engine for Solmar Bay: renderer, game loop, hero/wanted/save systems,
// camera, coins, the mission marker, and the debug hooks the test driver
// uses (window.__game). State machine: menu -> playing -> paused -> over.
// Everything else (city, vehicles, people, missions, hud, audio) is a
// module the engine wires together; the engine owns cash, wanted level,
// save/load and the frame loop.
import { makeWorldRng } from './rng.js';
import { buildCity } from './city.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { createVehicles } from './vehicles.js';
import { createPeople } from './people.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';

const THREE = window.THREE;
const SAVE_KEY = 'solmar-bay-save-v1';
const COIN_COUNT = 12;
const COIN_VALUE = 40;

export function createGame(canvas, opts = {}) {
  const fxLow = !!opts.fxLow;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !fxLow });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fxLow ? 1 : 2));
  renderer.shadowMap.enabled = !fxLow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1e3f);
  scene.fog = new THREE.Fog(0x2a1e3f, 120, 460);

  const hemi = new THREE.HemisphereLight(0x8a6bbf, 0x2a1e1a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.4);
  sun.position.set(140, 190, -90);
  sun.castShadow = !fxLow;
  sun.shadow.mapSize.set(fxLow ? 1024 : 2048, fxLow ? 1024 : 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 60, 120);

  // ---- modules ----
  const rng = makeWorldRng();
  const city = buildCity(scene, rng);
  const audio = new AudioSys();
  const input = new Input(canvas);
  const vehicles = createVehicles(scene, city, rng, audio);
  const people = createPeople(scene, city, rng);
  const missions = createMissions(city);
  const hud = createHud();

  // ---- game state ----
  let state = 'menu';
  let cash = 200;
  let wanted = 0;
  let elapsed = 0;
  let driving = false;
  let cameraMode = 0;
  let cameraAngle = 0;
  let menuOrbit = 0;
  let heatCooldown = 0;
  let wantedTimer = 0;
  let saveTimer = 0;
  let headlightsOn = false;
  let headlight = null;
  let overReason = '';
  const coins = [];
  const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16);
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  for (let i = 0; i < COIN_COUNT; i += 1) {
    const p = city.roadPoint();
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(p.x, 1.0, p.z);
    m.rotation.x = Math.PI / 2;
    scene.add(m);
    coins.push({ mesh: m, x: p.x, z: p.z, taken: false });
  }
  // Mission marker: a gold ring on the ground.
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.1;
  scene.add(marker);
  const markerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 30, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
  );
  markerBeam.position.y = 15;
  scene.add(markerBeam);

  const G = {
    input, audio, city, heroX: 0, heroZ: 0, heroHeading: 0,
    driving: false, wanted: 0, car: null, cameraAngle: 0,
    onCrash, onHeroDamaged, onThugKilled, onCopDown, onBusted,
  };
  const W = {
    hero: people.hero, driving: false, car: null, people, audio,
    addCash, toast, get thugsLeft() { return people.thugs.length; },
  };

  function toast(text) { hud.toast(text); }
  function addCash(amount, reason) {
    cash += amount;
    if (reason) hud.toast(`+$${amount} — ${reason}`);
  }

  function gainWanted(n, reason) {
    if (heatCooldown > 0) return;
    heatCooldown = 5;
    wanted = Math.min(5, wanted + n);
    if (reason) toast(reason);
  }

  function onCrash(strength) {
    audio.crash(strength);
    if (strength > 0.5) {
      // A hard crash can attract attention.
      gainWanted(0, '');
    }
  }

  function onHeroDamaged(dmg, src) {
    people.hero.hp -= dmg;
    if (people.hero.hp <= 0) {
      people.hero.hp = 0;
      wasted();
    }
  }

  function onThugKilled(t) {
    if (!t.isBoss) {
      addCash(50, 'Thug down');
      audio.coin();
    }
  }

  function onCopDown() {
    gainWanted(1, 'You dropped a cop — wanted level up!');
  }

  function onBusted() {
    if (state !== 'playing') return;
    overReason = 'Busted by the cops';
    const fine = Math.min(200, cash);
    cash -= fine;
    audio.busted();
    endRun(fine);
  }

  function wasted() {
    if (state !== 'playing') return;
    overReason = 'Wasted';
    const fine = Math.min(200, cash);
    cash -= fine;
    audio.busted();
    endRun(fine);
  }

  function endRun(fine) {
    state = 'over';
    document.getElementById('over-title').textContent = overReason;
    document.getElementById('over-text').textContent = `Hospital / bail: -$${fine} — respawn at the hideout.`;
    hud.showMenu('over');
    if (vehicles.playerCar) vehicles.removePlayerCar();
    driving = false;
    wanted = 0;
    saveGame();
  }

  function respawn() {
    people.resetHero(city.hideout.x, city.hideout.z);
    people.hero.hp = 100;
    wanted = 0;
    cameraAngle = 0;
    state = 'playing';
    hud.showMenu(null);
    toast('Back on your feet at the hideout.');
  }

  // ---- save / load ----
  function saveGame() {
    try {
      const data = {
        version: 1, cash, missionIndex: missions.index,
        heroX: people.hero.x, heroZ: people.hero.z, hp: people.hero.hp,
        coinsTaken: coins.map((c) => c.taken),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable — the game still runs */ }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.version !== 1) return false;
      cash = data.cash;
      people.hero.hp = data.hp;
      people.resetHero(data.heroX, data.heroZ);
      missions.setIndex(data.missionIndex || 0);
      (data.coinsTaken || []).forEach((taken, i) => {
        if (taken && coins[i]) {
          coins[i].taken = true;
          coins[i].mesh.visible = false;
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function hasSave() {
    try { return !!window.localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  // ---- entering / exiting cars ----
  function enterCar() {
    const car = vehicles.nearestParked(people.hero.x, people.hero.z, 4.5);
    if (!car) return;
    vehicles.stealParked(car);
    driving = true;
    G.driving = true;
    W.driving = true;
    W.car = car;
    G.car = car;
    gainWanted(1, 'Car stolen — wanted level up!');
    audio.ensure();
    audio.radioStart();
    if (headlight) car.mesh.add(headlight);
    toast('Nice wheels. E to get out.');
  }

  function exitCar() {
    const car = vehicles.playerCar;
    if (!car) return;
    if (headlight) car.mesh.remove(headlight);
    vehicles.removePlayerCar();
    // Park the hero beside where the car was.
    people.resetHero(car.x + Math.sin(car.heading + Math.PI / 2) * 2.5, car.z + Math.cos(car.heading + Math.PI / 2) * 2.5);
    people.hero.hp = Math.max(people.hero.hp, 1);
    driving = false;
    G.driving = false;
    W.driving = false;
    W.car = null;
    G.car = null;
    audio.radioStop();
    audio.setEngine(0, false);
  }

  function toggleHeadlights() {
    headlightsOn = !headlightsOn;
    if (!headlight) {
      headlight = new THREE.SpotLight(0xfff2c0, 120, 40, 0.5, 0.4);
      headlight.position.set(0, 1.2, 2.0);
      headlight.target.position.set(0, 0, 12);
    }
    const car = vehicles.playerCar;
    if (car) {
      if (headlightsOn) car.mesh.add(headlight);
      else car.mesh.remove(headlight);
    }
    toast(headlightsOn ? 'Headlights on' : 'Headlights off');
  }

  // ---- police management ----
  function managePolice(dt) {
    const desired = wanted === 0 ? 0 : Math.min(4, wanted);
    while (vehicles.police.length < desired) {
      const p = city.roadPoint();
      const a = Math.atan2(people.hero.x - p.x, people.hero.z - p.z);
      const px = people.hero.x - Math.sin(a) * 45;
      const pz = people.hero.z - Math.cos(a) * 45;
      vehicles.spawnPolice(px, pz);
      audio.setSiren(true);
    }
    while (vehicles.police.length > desired) {
      vehicles.removePolice(vehicles.police[vehicles.police.length - 1]);
    }
    if (vehicles.police.length === 0) audio.setSiren(false);
    // Foot cops when wanted and on foot.
    if (wanted >= 1 && !driving && people.cops.length < Math.min(2, wanted)) {
      const a = Math.random() * Math.PI * 2;
      people.spawnFootCop(people.hero.x + Math.sin(a) * 16, people.hero.z + Math.cos(a) * 16);
    }
    if (wanted === 0 && people.cops.length > 0) {
      for (const c of [...people.cops]) {
        scene.remove(c.mesh);
        people.cops.splice(people.cops.indexOf(c), 1);
      }
    }
  }

  // ---- camera ----
  function updateCamera(dt) {
    const target = driving && vehicles.playerCar
      ? { x: vehicles.playerCar.x, z: vehicles.playerCar.z, heading: vehicles.playerCar.heading, y: 0 }
      : { x: people.hero.x, z: people.hero.z, heading: people.hero.heading, y: people.hero.y };
    if (state === 'menu') {
      menuOrbit += dt * 0.06;
      camera.position.set(Math.sin(menuOrbit) * 130, 65, Math.cos(menuOrbit) * 130);
      camera.lookAt(0, 10, 0);
      return;
    }
    if (cameraMode === 2) {
      camera.position.lerp(new THREE.Vector3(target.x, 58, target.z + 0.1), 1 - Math.exp(-dt * 4));
      camera.lookAt(target.x, 0, target.z);
      return;
    }
    const dist = cameraMode === 0 ? 9 : 17;
    const height = cameraMode === 0 ? 4.2 : 8.5;
    cameraAngle += (((target.heading + Math.PI) - cameraAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 3);
    const cx = target.x - Math.sin(cameraAngle) * dist;
    const cz = target.z - Math.cos(cameraAngle) * dist;
    camera.position.lerp(new THREE.Vector3(cx, target.y + height, cz), 1 - Math.exp(-dt * 5));
    camera.lookAt(target.x, target.y + 1.6, target.z);
  }

  // ---- coins ----
  function updateCoins(dt) {
    const hx = driving && vehicles.playerCar ? vehicles.playerCar.x : people.hero.x;
    const hz = driving && vehicles.playerCar ? vehicles.playerCar.z : people.hero.z;
    for (const c of coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      const d = Math.hypot(hx - c.x, hz - c.z);
      if (d < 2.4) {
        c.taken = true;
        c.mesh.visible = false;
        addCash(COIN_VALUE, 'Neon coin');
        audio.coin();
      }
    }
  }

  // ---- per-frame update ----
  function update(dt) {
    elapsed += dt;
    heatCooldown = Math.max(0, heatCooldown - dt);
    city.update(dt);
    // Wanted decay: 25 s quiet and the heat drops a star.
    if (wanted > 0) {
      wantedTimer += dt;
      if (wantedTimer > 25) {
        wantedTimer = 0;
        wanted -= 1;
        toast(`Heat dying down — wanted level ${wanted}`);
      }
    } else {
      wantedTimer = 0;
    }
    G.heroX = people.hero.x;
    G.heroZ = people.hero.z;
    G.heroHeading = people.hero.heading;
    G.driving = driving;
    G.wanted = wanted;
    G.car = vehicles.playerCar;
    G.cameraAngle = cameraAngle;
    W.driving = driving;
    W.car = vehicles.playerCar;
    W.hero = people.hero;
    vehicles.update(dt, G);
    people.update(dt, G);
    missions.update(dt, W);
    managePolice(dt);
    updateCoins(dt);
    // Pedestrian hit while driving: they get up elsewhere, you get heat.
    if (driving && vehicles.playerCar) {
      const car = vehicles.playerCar;
      for (const p of people.peds) {
        const d = Math.hypot(p.x - car.x, p.z - car.z);
        if (d < 2.0 && Math.abs(car.speed) > 3) {
          const t = city.roadPoint();
          p.x = t.x;
          p.z = t.z;
          p.mesh.position.set(p.x, 0, p.z);
          people.scare(car.x, car.z, 12);
          gainWanted(1, 'You hit a pedestrian!');
        }
      }
    }
    // Mission marker follows the current target.
    const m = missions.markerPos(W);
    if (m) {
      marker.visible = true;
      markerBeam.visible = true;
      marker.position.set(m.x, 0.12, m.z);
      markerBeam.position.set(m.x, 15, m.z);
      const s = 1 + Math.sin(elapsed * 3) * 0.12;
      marker.scale.set(s, s, 1);
    } else {
      marker.visible = false;
      markerBeam.visible = false;
    }
    // Autosave every 30 s.
    saveTimer += dt;
    if (saveTimer > 30) {
      saveTimer = 0;
      saveGame();
    }
    hud.update({
      cash, hp: people.hero.hp, wanted, elapsed,
      speed: driving && vehicles.playerCar ? Math.abs(vehicles.playerCar.speed) : 0,
      driving, objective: `${missions.name} — ${missions.objectiveText(W)}`,
      radio: driving ? `♪ ${audio.radioName()}` : '',
      hero: people.hero, city, traffic: vehicles.traffic, police: vehicles.police,
      marker: m, time: elapsed,
    });
  }

  // ---- key edges ----
  function handleKeys() {
    if (input.hit('KeyC') && state === 'playing') {
      cameraMode = (cameraMode + 1) % 3;
      toast(['Chase camera', 'Far camera', 'Top-down camera'][cameraMode]);
    }
    if (input.hit('KeyH') && driving) audio.horn();
    if (input.hit('KeyL') && driving) toggleHeadlights();
    if (input.hit('KeyN') && driving) {
      const t = audio.radioNext();
      toast(`Radio: ${audio.radioName()}`);
      void t;
    }
    if (input.hit('KeyM')) {
      audio.setMuted(!audio.muted);
      toast(audio.muted ? 'Muted' : 'Sound on');
    }
    if (input.hit('KeyE') && state === 'playing') {
      if (driving) exitCar();
      else enterCar();
    }
    if (input.pauseHit()) {
      if (state === 'playing') {
        state = 'paused';
        hud.showMenu('pause');
        saveGame();
      } else if (state === 'paused') {
        state = 'playing';
        hud.showMenu(null);
      }
    }
  }

  // ---- menus ----
  function bindButtons() {
    const on = (id, fn) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', fn);
    };
    on('btn-start', () => {
      audio.ensure();
      newGame();
    });
    on('btn-load', () => {
      audio.ensure();
      if (loadGame()) {
        state = 'playing';
        hud.showMenu(null);
        toast('Save loaded — welcome back, Lena.');
      } else {
        newGame();
      }
    });
    on('btn-continue', () => {
      state = 'playing';
      hud.showMenu(null);
    });
    on('btn-restart', () => {
      audio.ensure();
      newGame();
    });
    on('btn-again', () => respawn());
  }

  function newGame() {
    cash = 200;
    wanted = 0;
    elapsed = 0;
    driving = false;
    cameraAngle = 0;
    if (vehicles.playerCar) vehicles.removePlayerCar();
    people.resetHero(city.hideout.x, city.hideout.z);
    people.hero.hp = 100;
    missions.setIndex(0);
    for (const c of coins) {
      c.taken = false;
      c.mesh.visible = true;
    }
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    state = 'playing';
    hud.showMenu(null);
    toast('Solmar Bay — Neon Heat. Steal a car, Lena.');
  }

  function start() {
    bindButtons();
    hud.showMenu('start');
    const loadBtn = document.getElementById('btn-load');
    if (loadBtn) loadBtn.style.display = hasSave() ? 'inline-block' : 'none';
    window.addEventListener('keydown', () => audio.ensure(), { once: true });
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      input.beginFrame();
      handleKeys();
      if (state === 'playing') update(dt);
      else if (state === 'menu') city.update(dt);
      updateCamera(dt);
      renderer.render(scene, camera);
    };
    requestAnimationFrame(loop);
  }

  // Put the hero in a fresh car at (x, z), already driving — used by the
  // screenshot staging (shots.js) so a drive/chase still needs no keys.
  function stageInCar(x, z, heading) {
    if (vehicles.playerCar) vehicles.removePlayerCar();
    const car = vehicles.giveCar('sedan', x, z, heading || 0);
    driving = true;
    G.driving = true;
    W.driving = true;
    W.car = car;
    G.car = car;
    audio.ensure();
    audio.radioStart();
    if (headlight) car.mesh.add(headlight);
    return car;
  }

  // ---- debug hooks for the test driver ----
  function debugState() {
    return {
      state, cash: Math.floor(cash), hp: Math.round(people.hero.hp), wanted,
      mission: missions.name, missionIndex: missions.index,
      objective: missions.objectiveText(W),
      driving, speed: driving && vehicles.playerCar ? Math.round(Math.abs(vehicles.playerCar.speed) * 2.237) : 0,
      heroX: Math.round(people.hero.x * 10) / 10,
      heroZ: Math.round(people.hero.z * 10) / 10,
      heroY: Math.round(people.hero.y * 100) / 100,
      carDamage: vehicles.playerCar ? Math.round(vehicles.playerCar.damage) : null,
      coinsTaken: coins.filter((c) => c.taken).length,
      thugsLeft: people.thugs.length,
      cops: people.cops.length,
      police: vehicles.police.length,
      elapsed: Math.round(elapsed),
    };
  }

  const api = {
    start, debugState,
    get state() { return state; },
    get cash() { return cash; },
    teleport(x, z) {
      if (driving && vehicles.playerCar) {
        vehicles.playerCar.x = x;
        vehicles.playerCar.z = z;
      } else {
        people.hero.x = x;
        people.hero.z = z;
        people.hero.mesh.position.set(x, people.hero.y, z);
      }
    },
    giveCar(kind, x, z, heading) {
      return vehicles.giveCar(kind, x, z, heading || 0);
    },
    stageInCar,
    setWanted(n) { wanted = Math.max(0, Math.min(5, n)); },
    setMission(i) { missions.setIndex(i); },
    setCash(n) { cash = n; },
    forcePlay() {
      state = 'playing';
      hud.showMenu(null);
    },
    setCameraMode(m) { cameraMode = m; },
    get city() { return city; },
    get hero() { return people.hero; },
    get traffic() { return vehicles.traffic; },
    get peopleApi() { return people; },
    get vehiclesApi() { return vehicles; },
    get missionsApi() { return missions; },
    renderer,
  };
  window.__game = api;
  window.__errors = window.__errors || [];
  window.addEventListener('error', (e) => {
    window.__errors.push(String(e.message || e.error || 'unknown error'));
  });
  return api;
}
