// shots.js — deterministic staged scenes for the four screenshots.
// The driver loads the game with ?shot=<name>&seed=11; the engine calls
// stageShot() 1.2 s after boot and sets window.__shotReady when the
// scene is placed. Staged scenes run with staging=true: the world
// animates but missions and keyboard input stay frozen.
export function stageShot(game, name) {
  const hero = game.people.hero;
  if (name === 'start') {
    // Title menu over the plaza, tower in frame; the menu orbit camera
    // does the rest.
    game.state = 'menu';
    game.hud.showMenu('menu');
    game.camYaw = Math.PI * 0.75;
    return;
  }
  if (name === 'drive') {
    // Lena in a red sedan cruising south down the main boulevard,
    // a yellow taxi ahead of her.
    game.state = 'playing';
    game.staging = true;
    game.hud.showMenu('playing');
    const car = game.vehicles._addCar(0, -88, 0, false, false, 0xc0392b);
    game.vehicles.enterCar(car);
    hero.onFoot = false;
    const taxi = game.vehicles._addCar(0, -40, 0, false, false, 0xf39c12);
    taxi.speed = 9;
    game.setObjective('Solmar Bay — cruise the boulevard. The city never sleeps.');
    game.hud.setRadio('NEON FM 92.4 — synthwave');
    game.snapCamera();
    return;
  }
  if (name === 'chase') {
    // Wanted 3: Lena in a red sports car, two cruisers flanking her
    // just ahead in the next lanes — visible in the chase camera.
    game.state = 'playing';
    game.staging = true;
    game.hud.showMenu('playing');
    const car = game.vehicles._addCar(44, 44, Math.PI / 2, false, false, 0xc0392b);
    car.topSpeed = 16;
    game.vehicles.enterCar(car);
    hero.onFoot = false;
    game.wanted = 3;
    const c1 = game.vehicles._addCar(70, 40.5, Math.PI / 2, false, true, 0xffffff);
    c1.speed = 12;
    const c2 = game.vehicles._addCar(66, 47.5, Math.PI / 2, false, true, 0xffffff);
    c2.speed = 12;
    game.setObjective('Wanted: 3 stars. Lose the Solmar Bay PD.');
    game.hud.setStars(3);
    game.snapCamera();
    return;
  }
  if (name === 'mission') {
    // The finale: Lena facing Vic Marino and his crew at Meridian Tower.
    game.state = 'playing';
    game.staging = true;
    game.hud.showMenu('playing');
    hero.pos.set(20, 0, 8);
    hero.heading = Math.PI;
    hero.hp = 100;
    hero.onFoot = true;
    game.people.spawnThugs(4, 22, 0);
    game.people.spawnBoss(22, -6);
    game.setObjective('Mission 5 — Neon Heat: take down Vic Marino at Meridian Tower.');
    game.hud.setHealth(100);
    game.camYaw = Math.PI;
    game.camYawOffset = 0;
    game.snapCamera();
    return;
  }
}
