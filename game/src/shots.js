// Screenshot staging for Solmar Bay (v10): four deterministic views reached
// by query (?shot=start|drive|chase|mission&seed=N). The seed drives the
// staging randomness (car colour, traffic jitter) so the shots match the
// manifest. The engine sets window.__shotReady after the staged scene has
// rendered a couple of frames.

import { createRng } from './rng.js';

const CAR_PAINTS = [0xc22a2a, 0x2a5ac2, 0x1a8a4a, 0xd4a21a, 0x222222, 0x7a2ad4];

export function applyShot(game, name, seed) {
  const rng = createRng(seed * 7919 + 13);
  const { city, people, vehicles } = game;
  game.clockMinutes = 19 * 60 + 40; // dusk, fixed for every shot

  if (name === 'start') {
    // Title menu over the dusk city: hero on the plaza, camera high looking
    // north across the tower and the bay behind the menu overlay.
    game.state = 'menu';
    game.hero.pos.set(city.plaza.x, 0, city.plaza.z + 6);
    game.hero.heading = Math.PI;
    game.hero.mesh.rotation.y = game.hero.heading;
    game.fixedCamera = { x: 60, y: 42, z: 120, tx: 0, ty: 14, tz: -60 };
    game.hud.showMenu('start');
    return true;
  }

  game.state = 'playing';
  game.hud.showMenu(null);
  game.input.setEnabled(true);

  if (name === 'drive') {
    // Driving north on the central boulevard, minimap and HUD visible.
    const car = vehicles.giveCar('sedan', 0, 30, Math.PI);
    // Seed-picked paint so the shot differs per seed.
    const body = car.mesh.children[0];
    if (body) body.material = new window.THREE.MeshLambertMaterial({ color: CAR_PAINTS[rng.int(0, CAR_PAINTS.length - 1)] });
    car.speed = 15;
    game.wanted = 0;
    game.vehicles.removePolice(0);
    game.missions.setIndex(0);
    game.snapCamera();
    return true;
  }

  if (name === 'chase') {
    // Wanted chase: 3 stars, three cruisers closing in. The cruisers are
    // staged AHEAD of the player car on the same road, so the chase camera
    // (behind the player) sees them; the pursuit AI then drives them at the
    // player and they cluster around the car by capture time.
    const car = vehicles.giveCar('sports', -40, 0, Math.PI / 2);
    car.speed = 12;
    game.setWanted(3);
    game.vehicles.spawnPolice(3, { x: -40, z: 0 });
    const spots = [[-16, 5], [-8, -5], [2, 2]];
    game.vehicles.police.forEach((cop, i) => {
      const s = spots[i % spots.length];
      cop.mesh.position.set(s[0], 0, s[1]);
      cop.heading = Math.PI / 2;
      cop.mesh.rotation.y = cop.heading;
      cop.speed = 12;
    });
    game.missions.setIndex(1);
    game.snapCamera();
    return true;
  }

  if (name === 'mission') {
    // Finale: Lena on foot facing Vic Marino and his crew at the tower.
    game.missions.setIndex(4);
    game.missions.update(0.01); // spawns the boss + crew
    game.hero.pos.set(22, 0, -18);
    game.hero.heading = Math.PI;
    game.hero.mesh.rotation.y = game.hero.heading;
    game.hero.mesh.visible = true;
    game.wanted = 2;
    game.vehicles.spawnPolice(1, { x: 22, z: -18 });
    game.snapCamera();
    return true;
  }

  return false;
}

export function shotNames() {
  return ['start', 'drive', 'chase', 'mission'];
}
