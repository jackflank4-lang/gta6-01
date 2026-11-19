// Bootstrap: collect page errors for the play-test driver, build the game,
// apply screenshot staging when the URL asks for it, and start the loop.

import { Game } from './engine.js';
import { readShotQuery, stageShot } from './shots.js';

// Every page error and unhandled rejection lands here so the driver can
// read them back and fail loudly instead of guessing.
window.__solmarErrors = [];
window.addEventListener('error', (event) => {
  window.__solmarErrors.push(`error: ${event.message} @ ${event.filename}:${event.lineno}`);
});
window.addEventListener('unhandledrejection', (event) => {
  window.__solmarErrors.push(`rejection: ${event.reason}`);
});

const query = readShotQuery();
const game = new Game();

// Debug + play-test API. The driver drives the game through these instead
// of guessing at internals.
window.SOLMAR = {
  game,
  state() {
    return {
      state: game.state,
      cash: Math.floor(game.cash),
      health: Math.round(game.health),
      wanted: game.wanted,
      mission: game.missions.done ? 5 : game.missions.index,
      missionDone: game.missions.done,
      missionName: game.missions.done ? 'done' : game.missions.def.name,
      inCar: !!game.car,
      carSpeedKmh: game.car ? Math.round(game.car.speedKmh()) : 0,
      carDamage: game.car ? Math.round(game.car.damage * 100) / 100 : null,
      x: Math.round(game.player.x * 100) / 100,
      z: Math.round(game.player.z * 100) / 100,
      y: Math.round((game.player.y || 0) * 100) / 100,
      heading: Math.round(game.player.heading * 100) / 100,
      coins: game.coins.filter((c) => c.taken).length,
      thugsAlive: game.people.thugs.filter((t) => !t.dead).length,
      police: game.police.cruisers.length,
      saveExists: game.loadSaveRaw() !== null,
      objective: game.objective,
      clockMin: Math.floor(game.clockMin),
      errors: window.__solmarErrors.slice(),
    };
  },
  startGame(fresh = true) { game.startGame(fresh); },
  toMenu() { game.toMenu(); },
  pause() { game.pause(); },
  resume() { game.resume(); },
  giveCar(kind, color, x, z, heading) { return game.giveCar(kind, color, x, z, heading); },
  teleport(x, z, heading = 0) { game.teleportPlayer(x, z, heading); },
  setWanted(n) { game.setWanted(n); },
  startMission(i) { game.startMission(i); },
  setHealth(n) { game.health = n; },
  setCash(n) { game.cash = n; },
  // Combat probe: drop four thugs around the player, mission-3 style.
  spawnFight() {
    game.startMission(2);
    return game.people.thugs.filter((t) => !t.dead).length;
  },
  key(code, down) {
    // Synthetic key events for the driver (it can also use real CDP input).
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  },
};

if (query.shot) {
  stageShot(game, query.shot, query.seed);
} else {
  game.toMenu();
}

game.start();
