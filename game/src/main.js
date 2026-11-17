// Boot + main loop + HUD + menus + save + deterministic ?shot= scenes.
// Rebuild r2: same skeleton as v1, reorganised — the controls list is built
// from the input bindings table, the HUD gains a car-damage bar, a coin
// counter and a dusk clock, C cycles the camera and N switches radio track,
// and the shot scenes are restaged (eastbound drive, tower finale).
(function () {
  'use strict';
  window.SB = window.SB || {};
  const CFG = SB.CFG;

  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || String(CFG.seed), 10) || CFG.seed;
  const shot = params.get('shot') || '';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const hud = $('hud'), menuEl = $('menu'), pauseEl = $('pause'), endEl = $('end');

  window.__errors = [];
  window.addEventListener('error', (e) => { window.__errors.push(String(e.message)); });

  const city = SB.City.build(seed);
  SB.Render.init(canvas, city);
  const world = SB.World.create(city, seed);
  SB.Input.init(canvas);

  let screen = shot ? 'play' : 'menu'; // shot modes skip the menu
  let toastTimer = 0;
  let toastQueue = [];
  let lastTime = performance.now();
  let shotSetupDone = false;
  let frames = 0;

  // ---------- menus ----------
  // Controls list rendered from the input bindings table (single source).
  (function buildControls() {
    const el = $('controls');
    if (!el) return;
    el.innerHTML = SB.Input.bindings
      .map(([k, what]) => '<b>' + k + '</b> — ' + what)
      .join('<br>');
  })();

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function setScreen(s) {
    screen = s;
    world.screen = s;
    if (s === 'menu') { show(menuEl); hide(pauseEl); hide(endEl); hide(hud); }
    else if (s === 'pause') { show(pauseEl); }
    else if (s === 'play') { hide(menuEl); hide(pauseEl); hide(endEl); show(hud); }
    else if (s === 'busted' || s === 'wasted' || s === 'win') {
      hide(pauseEl);
      const ev = world.events.find((e) => e.kind === 'end' || e.kind === 'win');
      $('endtitle').textContent = s === 'win' ? 'SOLMAR BAY IS YOURS' : (ev ? ev.title : s.toUpperCase());
      $('endsub').textContent = ev ? ev.sub : '';
      $('retrybtn').textContent = s === 'win' ? 'KEEP PLAYING' : 'BACK ON THE STREETS';
      show(endEl);
    }
  }
  function startGame() {
    SB.Audio.init(); SB.Audio.startMusic(); SB.Audio.click();
    const save = world.load();
    if (save) world.applySave(save);
    setScreen('play');
    toast('WELCOME TO SOLMAR BAY', 'Mama Lou has a job for you. Follow the yellow marker.');
  }
  $('startbtn').addEventListener('click', startGame);
  $('resumebtn').addEventListener('click', () => { SB.Audio.click(); setScreen('play'); });
  $('quitbtn').addEventListener('click', () => { SB.Audio.click(); world.save(); setScreen('menu'); });
  $('retrybtn').addEventListener('click', () => {
    SB.Audio.click();
    if (screen === 'win') { world.events = world.events.filter((e) => e.kind !== 'win'); setScreen('play'); }
    else setScreen('play');
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && screen === 'menu') startGame();
    if (e.code === 'Enter' && (screen === 'busted' || screen === 'wasted' || screen === 'win')) $('retrybtn').click();
  });

  // save note on the menu
  (function () {
    const save = world.load();
    if (save) {
      $('menunote').textContent = 'Save found: $' + save.money + ' · mission ' + Math.min(save.missionIndex + 1, 5) + '/5 · ' + (save.coinsGot || 0) + '/10 coins · your progress continues.';
    }
  })();

  // ---------- toasts ----------
  function toast(text, sub) {
    // shot scenes stay clean: no centre toast over the frame
    if (shot && shot !== 'start') return;
    $('toast').textContent = text;
    $('subtoast').textContent = sub || '';
    show($('toast')); show($('subtoast'));
    toastTimer = text.indexOf('MISSION') === 0 || text.indexOf('SOLMAR') === 0 ? 4.5 : 2.8;
  }
  function drainEvents() {
    while (world.events.length) {
      const ev = world.events.shift();
      if (ev.kind === 'end' || ev.kind === 'win') {
        setScreen(ev.kind === 'win' ? 'win' : (ev.title === 'BUSTED' ? 'busted' : 'wasted'));
      } else {
        toastQueue.push(ev);
      }
    }
    if (toastTimer <= 0 && toastQueue.length) {
      const ev = toastQueue.shift();
      toast(ev.text, ev.sub);
    }
  }

  // ---------- HUD ----------
  function clockText() {
    // Dusk cycle: 15:00 -> 19:00 across CFG.duskCycle seconds of play.
    const t = world.time % CFG.duskCycle;
    const mins = 15 * 60 + Math.floor((t / CFG.duskCycle) * 240);
    let h = Math.floor(mins / 60), m = mins % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }
  function updateHUD() {
    const p = world.player;
    $('money').textContent = '$' + Math.round(p.money).toLocaleString('en-US');
    $('healthbar').style.width = Math.max(0, p.health) + '%';
    $('healthbar').style.background = p.health > 50 ? 'linear-gradient(90deg,#37d67a,#7dff5e)' : 'linear-gradient(90deg,#ff3b30,#ff9500)';
    $('ammo').textContent = p.inCar ? '' : ('AMMO ' + p.ammo + '  ·  F punch · Click shoot');
    $('coins').textContent = 'COINS ' + world.coinsGot + '/' + CFG.coinsTotal + '  ·  ' + clockText();
    // stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < world.wanted ? '★' : '<span class="off">★</span>';
    $('stars').innerHTML = stars;
    if (world.wanted > 0) show($('wantedlabel')); else hide($('wantedlabel'));
    // car damage bar (only while driving)
    const car = p.inCar ? world.cars.find((c) => c.id === p.carId) : null;
    if (car) {
      show($('carwrap'));
      const left = Math.max(0, 100 - car.damage);
      $('carbar').style.width = left + '%';
      $('carbar').style.background = left > 60 ? 'linear-gradient(90deg,#37d67a,#7dff5e)' : left > 25 ? 'linear-gradient(90deg,#ffb02d,#ffe14d)' : 'linear-gradient(90deg,#ff3b30,#ff9500)';
      $('carlabel').textContent = 'CAR ' + Math.round(left) + '% — hold H at the Chop Shop to repair';
    } else hide($('carwrap'));
    // objective
    const obj = $('objective');
    if (world.mission) {
      const m = world.mission;
      let extra = '';
      if (world.missionIndex === 1 || world.missionIndex === 4) extra = '  (' + m.kills + '/' + m.need + ')';
      if (world.missionIndex === 3 && m.stage === 1) extra = '  — ' + Math.max(0, Math.ceil(m.timer)) + 's left!';
      if (world.missionIndex === 0 && m.stage === 0) extra = '  — find a car!';
      obj.innerHTML = '<span class="mname">' + m.def.name + '</span><br>' + m.def.objective + extra;
      show(obj);
    } else if (world.freeRoam) {
      obj.innerHTML = '<span class="mname">FREE ROAM</span><br>Solmar Bay is yours. Steal cars, dodge the PD, have fun.';
      show(obj);
    } else hide(obj);
    // speedo
    if (p.inCar) {
      show($('speedo'));
      $('speed').textContent = Math.round(Math.abs(p.speed || 0) * 2.2);
    } else hide($('speedo'));
    // hint
    const hint = $('hint');
    if (!p.inCar) {
      const car2 = world.nearestCar(4.5);
      if (car2) { hint.textContent = 'Press E to get in the car' + (car2.driver === 'traffic' ? ' (it has a driver…)' : ''); show(hint); }
      else hide(hint);
    } else {
      const nearChop = world.city.places.chopshop;
      const d = SB.CityHelpers.dist(p.x, p.z, nearChop.x, nearChop.z);
      hint.textContent = d < 14 && car && car.damage > 0 ? 'Hold H — repair ($1.50 per point)' : 'E — exit car · SPACE — handbrake · C — camera';
      show(hint);
    }
    // crosshair when aiming on foot
    if (!p.inCar && (SB.Input.mouseDown || SB.Input.mouseX !== 0)) show($('crosshair')); else hide($('crosshair'));
    // minimap
    SB.Render.drawMinimap($('minimap'), world);
    // status line for screen readers
    $('status').textContent = 'Money $' + Math.round(p.money) + ', health ' + Math.round(p.health) + ', wanted ' + world.wanted + ' stars' +
      (world.mission ? ', mission: ' + world.mission.def.name : '');
  }

  // ---------- shot staging ----------
  function setupShot() {
    if (shotSetupDone) return;
    shotSetupDone = true;
    if (shot === 'start') {
      setScreen('menu');
      return;
    }
    setScreen('play');
    hide(menuEl); show(hud);
    // shot scenes must be clean: no intro toast over the frame
    world.events = [];
    toastTimer = 0; hide($('toast')); hide($('subtoast'));
    if (shot === 'drive' || shot === 'chase') {
      // Dax in a car on the central east-west road (z=0), driving east
      // through the city so Neon Row billboards and traffic read in frame.
      const car = world.cars.find((c) => c.driver === 'parked');
      car.x = -80; car.z = 0; car.angle = Math.PI / 2;
      world.player.x = car.x; world.player.z = car.z;
      world.enterCar(car);
      world.camYaw = Math.PI / 2;
      SB.Render.camYaw = Math.PI / 2;
      if (shot === 'chase') {
        world.addWanted(3, true);
        world.events = [];
        // stage the pursuit INTO the frame: the PD spawns 70–110 units
        // away and would still be off-screen when the capture fires, so
        // pull two cruisers oncoming ahead of the player and one alongside.
        const cruisers = world.cars.filter((c) => c.isPolice && c.active);
        const stage = [
          { dx: 48, dz: -14, angle: -Math.PI / 2, speed: 30 },
          { dx: 68, dz: 14, angle: -Math.PI / 2, speed: 30 },
          { dx: -24, dz: 16, angle: Math.PI / 2, speed: 34 },
        ];
        cruisers.forEach((c, i) => {
          const s = stage[i % stage.length];
          c.x = world.player.x + s.dx; c.z = world.player.z + s.dz;
          c.angle = s.angle; c.speed = s.speed;
        });
      }
    } else if (shot === 'mission') {
      // mission 5 in progress at the Tower: Dax south of it facing the
      // Kingfish boss and his guards, the beacon rising behind them.
      world.mission = null;
      world.startMission(4);
      world.events = [];
      const t = city.places.tower;
      world.player.x = t.x; world.player.z = t.z + 30;
      world.player.angle = Math.PI;
      world.camYaw = Math.PI;
      SB.Render.camYaw = Math.PI;
      // HIGH camera for this shot: the tower, the 60-unit mission beacon
      // rising behind it and the whole crew fit the frame.
      world.cameraMode = 2;
      SB.Render.setCameraMode(2);
      const spots = [[-8, 16], [0, 14], [8, 17], [-4, 22], [4, 22], [0, 20]];
      world.thugs.forEach((th, i) => {
        const s = spots[i % spots.length];
        th.x = t.x + s[0]; th.z = t.z + s[1];
        th.angle = Math.PI; // facing the player (south)
      });
    }
    window.__shotReady = true;
  }

  // ---------- debug handle (CDP play-tests) ----------
  window.__game = {
    world: world, city: city,
    screen: () => screen,
    state: function () {
      const p = world.player;
      const car = p.inCar ? world.cars.find((c) => c.id === p.carId) : null;
      return {
        screen: screen, x: +p.x.toFixed(1), z: +p.z.toFixed(1), angle: +p.angle.toFixed(2),
        health: Math.round(p.health), money: Math.round(p.money), ammo: p.ammo,
        inCar: p.inCar, speed: +(p.speed || 0).toFixed(1), wanted: world.wanted,
        mission: world.missionIndex + 1, missionStage: world.mission ? world.mission.stage : null,
        missionKills: world.mission ? world.mission.kills : 0,
        cars: world.cars.length, peds: world.peds.length, thugs: world.thugs.filter((t) => t.hp > 0).length,
        police: world.cars.filter((c) => c.isPolice && c.active).length,
        footCops: world.footCops.filter((f) => !f.dead).length,
        coins: world.coinsGot, coinsTotal: CFG.coinsTotal,
        carDamage: car ? Math.round(car.damage) : null,
        cameraMode: SB.Render.cameraModeName(),
        track: SB.Audio.trackName(),
        errors: window.__errors.slice(),
      };
    },
    press: function (code) { SB.Input.keys[code] = true; SB.Input.pressed[code] = true; setTimeout(() => { SB.Input.keys[code] = false; }, 120); },
    hold: function (code, on) { SB.Input.keys[code] = !!on; },
    mouseAt: function (x, y) { SB.Input.mouseX = x; SB.Input.mouseY = y; },
    mouseDown: function (on) { SB.Input.mouseDown = !!on; },
    startMission: function (i) { world.startMission(i); },
    setWanted: function (n) { world.wanted = 0; world.addWanted(n, true); },
    teleport: function (x, z) { world.player.x = x; world.player.z = z; },
    setCamera: function (m) { world.cameraMode = m; SB.Render.setCameraMode(m); },
  };

  // ---------- main loop ----------
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (dt <= 0) dt = 0.016;
    frames++;

    if (shot) setupShot();

    if (screen === 'play') {
      // camera + radio toggles (edge-triggered)
      if (SB.Input.wasPressed('KeyC')) {
        world.cameraMode = (world.cameraMode + 1) % 3;
        const name = SB.Render.setCameraMode(world.cameraMode);
        toast('CAMERA: ' + name, 'C cycles follow / shoulder / high.');
      }
      if (SB.Input.wasPressed('KeyN')) {
        const name = SB.Audio.nextTrack();
        toast('RADIO: ' + name, 'N switches the track.');
      }
      // shot autopilot: hold W so the car drives itself for the capture
      if (shot === 'drive' || shot === 'chase') SB.Input.keys['KeyW'] = true;
      world.update(dt, SB.Input);
      drainEvents();
      if (world.screen !== 'play') setScreen(world.screen);
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) { hide($('toast')); hide($('subtoast')); }
      }
      // sync meshes
      const t = world.time;
      SB.Render.syncPlayer(world.player, t);
      for (const car of world.cars) if (car.active) SB.Render.syncCar(car.mesh, car, t);
      for (const pd of world.peds) if (!pd.dead) SB.Render.syncPerson(pd.mesh, pd, t);
      for (const th of world.thugs) if (th.hp > 0) SB.Render.syncPerson(th.mesh, th, t);
      for (const fc of world.footCops) if (!fc.dead) SB.Render.syncPerson(fc.mesh, fc, t);
      const focus = world.player;
      SB.Render.updateCamera(focus, world.camYaw, dt);
      updateHUD();
    } else if (screen === 'menu') {
      SB.Render.vistaCamera(world.time);
      world.time += dt;
      SB.Render.syncPlayer(world.player, world.time);
      for (const car of world.cars) if (car.active) SB.Render.syncCar(car.mesh, car, world.time);
    } else {
      // paused / end screens: keep rendering the frozen scene
      SB.Render.syncPlayer(world.player, world.time);
    }
    SB.Render.render(world.time);
    SB.Input.endFrame();
    if (frames === 30) window.__shotReady = true;
  }

  // global keys: pause / mute / restart
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if ((e.code === 'KeyP' || e.code === 'Escape') && screen === 'play') { setScreen('pause'); SB.Audio.click(); }
    else if ((e.code === 'KeyP' || e.code === 'Escape') && screen === 'pause') { setScreen('play'); SB.Audio.click(); }
    else if (e.code === 'KeyM') { const m = SB.Audio.toggleMute(); toast(m ? 'MUTED' : 'SOUND ON', ''); }
    else if (e.code === 'KeyR' && (screen === 'play' || screen === 'pause')) {
      world.reset(); world.events = []; setScreen('play');
      toast('FRESH START', 'New day in Solmar Bay.');
    }
  });

  if (shot === 'start') setScreen('menu');
  requestAnimationFrame(frame);
})();
