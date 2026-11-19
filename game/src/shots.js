// Screenshot staging: deterministic setups for the four shots named in
// shots.json, driven by the ?shot=<name>&seed=<n> query. Each setup puts the
// game in a fixed, readable state (menu over the dusk city / driving on the
// boulevard / a wanted chase with cruisers in frame / the boss finale at the
// tower) so the screenshots match the manifest and show the game at its best.

export function readShotQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot') || null,
    seed: Number(params.get('seed') || 13),
    fxLow: params.get('fx') === 'low',
  };
}

// Stage one of the four shots. `game` is the engine's public API. The seed
// is honoured so a staged view is reproducible from the manifest alone.
export function stageShot(game, name, seed) {
  const tower = game.city.spots.tower;
  if (name === 'start') {
    // Title menu over the dusk city; the menu camera orbits on its own.
    game.toMenu();
    game.setClock(18, 20);
    return;
  }

  game.startGame(true);
  // Staged shots snap the camera (no lerp lag on the slow renderer).
  game.shotMode = true;

  if (name === 'drive') {
    // Red sportscar cruising the central boulevard (road x = 0), minimap
    // and HUD live, mission 1 waiting.
    game.giveCar('sport', 0xd23b3b, 0, -60, 0);
    game.setAutoDrive(true);
    game.setClock(18, 40);
    game.setCameraMode(0);
  } else if (name === 'chase') {
    // Three wanted stars, teal sportscar, two cruisers staged AHEAD of the
    // player so the chase camera actually sees them.
    game.giveCar('sport', 0x37e0ff, 0, -40, 0);
    game.setAutoDrive(true);
    game.setWanted(3);
    game.placePoliceAhead(2, 16);
    game.setClock(19, 5);
    game.setCameraMode(0);
  } else if (name === 'mission') {
    // On foot at the Meridian Tower, facing Vic Marino and his crew under
    // the beacon, mission 5 live. Close enough that the gold-jacketed boss
    // reads clearly in frame.
    game.startMission(4);
    game.teleportPlayer(tower.x, tower.z + 26, Math.PI);
    game.setClock(20, 15);
    game.setCameraMode(0);
  }
  // The seed is recorded on the game so any seeded staging stays in sync.
  game.shotSeed = seed;
}
