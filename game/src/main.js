// Boot + main loop + HUD + menus + save + deterministic ?shot= scenes.
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
      $('menunote').textContent = 'Save found: $' + save.money + ' · mission ' + Math.min(save.missionIndex + 1, 5) + '/5 · your progress continues.';
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
  function updateHUD() {
    const p = world.player;
    $('money').textContent = '$' + Math.round(p.money).toLocaleString('en-US');
    $('healthbar').style.width = Math.max(0, p.health) + '%';
    $('healthbar').style.background = p.health > 50 ? 'linear-gradient(90deg,#37d67a,#7dff5e)' : 'linear-gradient(90deg,#ff3b30,#ff9500)';
    $('ammo').textContent = p.inCar ? '' : ('AMMO ' + p.ammo + '  ·  F punch · Click shoot');
    // stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < world.wanted ? '★' : '<span class="off">★</span>';
    $('stars').innerHTML = stars;
    if (world.wanted > 0) show($('wantedlabel')); else hide($('wantedlabel'));
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
      const car = world.nearestCar(4.5);
      if (car) { hint.textContent = 'Press E to get in the car' + (car.driver === 'traffic' ? ' (it has a driver…)' : ''); show(hint); }
      else hide(hint);
    } else { hint.textContent = 'E — exit car · SPACE — handbrake'; show(hint); }
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
      // Dax in a car on the central north-south road (x=0), driving south
      // through the city so buildings, traffic and the road read in frame.
      const car = world.cars.find((c) => c.driver === 'parked');
      car.x = 0; car.z = 80; car.angle = 0;
      world.player.x = car.x; world.player.z = car.z;
      world.enterCar(car);
      world.camYaw = 0;
      SB.Render.camYaw = 0;
      if (shot === 'chase') {
        world.addWanted(3, true);
        world.events = [];
      }
    } else if (shot === 'mission') {
      // mission 2 in progress at the docks: Dax on the road south of the
      // Docks building, thugs in front of him, beacon behind them.
      world.mission = null;
      world.startMission(1);
      world.events = [];
      const d = city.places.docks;
      world.player.x = d.x; world.player.z = d.z + 30;
      world.player.angle = Math.PI;
      world.camYaw = Math.PI;
      SB.Render.camYaw = Math.PI;
      const spots = [[-6, 14], [0, 12], [6, 15]];
      world.thugs.forEach((t, i) => {
        t.x = d.x + spots[i][0]; t.z = d.z + spots[i][1];
        t.angle = Math.PI; // facing the player (south)
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
      return {
        screen: screen, x: +p.x.toFixed(1), z: +p.z.toFixed(1), angle: +p.angle.toFixed(2),
        health: Math.round(p.health), money: Math.round(p.money), ammo: p.ammo,
        inCar: p.inCar, speed: +(p.speed || 0).toFixed(1), wanted: world.wanted,
        mission: world.missionIndex + 1, missionStage: world.mission ? world.mission.stage : null,
        missionKills: world.mission ? world.mission.kills : 0,
        cars: world.cars.length, peds: world.peds.length, thugs: world.thugs.filter((t) => t.hp > 0).length,
        police: world.cars.filter((c) => c.isPolice && c.active).length,
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
    SB.Render.render();
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
