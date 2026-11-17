// Screenshot staging for Solmar Bay: the game reads `?shot=<name>` from the
// URL and sets up one deterministic scene per screenshot, so the cover and the
// three play shots each show a different system at its best. The shot driver
// waits for `window.__shotReady` before capturing.
//
//   start   — the title menu over the city at dusk, tower and bay behind it
//   drive   — Lena in a stolen sports car on the boulevard, traffic around her
//   chase   — wanted level 3, three cruisers closing in, sirens on the HUD
//   mission — the finale at the Meridian Tower: Vic Marino, his crew, the beacon

export function stageShot(game, name) {
  const city = game.city;
  if (name === 'start') {
    // Menu state: park the camera high over the plaza, looking north at the
    // tower with the bay glittering behind it.
    game.camera.position.set(40, 55, 90);
    game.camera.lookAt(-10, 20, -120);
    game.hud.showStart(game.hasSave());
    finish();
    return;
  }

  // Every play shot starts a fresh game, then stages its own scene.
  game.startNew();

  if (name === 'drive') {
    // On the central boulevard, heading north, in a stolen sports car.
    game.teleport(2, 60);
    game.giveCar('sports', 0, 58, Math.PI);
    game.playerCar.speed = 16;
    game.camMode = 0;
    game.camYaw = Math.PI;
    game.toast('Solmar Bay — steal it, drive it, own it');
    finish();
    return;
  }

  if (name === 'chase') {
    // Wanted 3, in a sedan on the east avenue, cruisers already closing in.
    game.teleport(88, 40);
    game.giveCar('sedan', 88, 38, Math.PI);
    game.playerCar.speed = 24;
    game.setWanted(3);
    game.camMode = 1;
    game.camYaw = Math.PI;
    game.toast('WANTED — lose the cops');
    finish();
    return;
  }

  if (name === 'mission') {
    // The finale: Lena on foot at the tower, Vic Marino and six thugs in
    // front of her, the gold beacon marking the last job.
    game.startMission(4);
    game.teleport(city.tower.x + 6, city.tower.z + 26);
    game.hero.heading = Math.PI;
    game.camMode = 0;
    game.camYaw = 0;
    game.setWanted(2);
    game.toast('King of the Bay — take down Vic Marino');
    finish();
    return;
  }

  // Unknown shot name: fall back to the menu.
  game.hud.showStart(game.hasSave());
  finish();

  function finish() {
    // Let the scene settle (traffic moves, the beacon pulses, the camera
    // finds its follow) before the driver captures.
    setTimeout(() => { window.__shotReady = true; }, 1400);
  }
}
