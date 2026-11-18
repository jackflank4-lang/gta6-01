// Screenshot staging for Solmar Bay — Neon Heat.
// Deterministic scenes for the four required captures. Every shot is
// staged from the live game (no mock objects), using the shot seed for
// any placement jitter. Called once from main.js when ?shot= is present.
// Note: roads run on the lines -176 + 44k; block centres hold buildings,
// so every staged position sits on a road line or open ground.
import { Rng } from './rng.js';

export function applyShot(game, name, seed) {
  const rng = new Rng(seed || 9);
  const city = game.city;
  const hero = game.people.hero;

  if (name === 'start') {
    // Title screen: hero on foot at the plaza, high camera over the city.
    game.state = 'menu';
    game.hud.showMenu('start');
    hero.pos.set(10, 0, 30);
    hero.heading = Math.PI * 0.75;
    hero.onFoot = true;
    // The sim does not run in menu state, so place the mesh directly.
    const mesh = game.people.heroMesh();
    mesh.position.copy(hero.pos);
    mesh.rotation.y = hero.heading;
    game.camMode = 1;
    game.snapCamera();
    return;
  }

  // The other three shots need a running game.
  if (game.state === 'menu') game.newGame();

  if (name === 'drive') {
    // Lena cruising the central boulevard (road z=0) westward in a red
    // sedan, traffic ahead of her.
    const car = game.traffic.giveCar('sedan', 150, rng.range(-2, 2), -Math.PI / 2, 0xd83a3a);
    game.traffic.enterCar(car);
    hero.onFoot = false;
    hero.pos.copy(car.pos);
    hero.heading = car.heading;
    car.speed = 16;
    game.traffic.giveCar('taxi', 110, 0, -Math.PI / 2);
    game.traffic.giveCar('sedan', 70, 0, -Math.PI / 2);
    game.camMode = 0;
    game.snapCamera();
    return;
  }

  if (name === 'chase') {
    // Wanted 3: Lena fleeing south on road x=0 in a red sports car, three
    // cruisers in pursuit behind her.
    const car = game.traffic.giveCar('sports', 0, 44, 0, 0xd83a3a);
    game.traffic.enterCar(car);
    hero.onFoot = false;
    hero.pos.copy(car.pos);
    hero.heading = car.heading;
    car.speed = 22;
    game.addWanted(3);
    game.traffic.cruisers.forEach((c, i) => {
      c.pos.set((i - 1) * 5, 0, 58 + i * 6);
      c.heading = 0;
      c.speed = 20;
    });
    game.camMode = 0;
    game.snapCamera();
    return;
  }

  if (name === 'mission') {
    // Mission 5 finale: Lena facing Vic Marino and his crew on the road
    // south of Meridian Tower. The crew is staged 14 m out so the boss
    // and his men are visible but cannot reach Lena before the capture.
    game.missions.start(4);
    hero.pos.set(16, 0, 10);
    hero.heading = Math.PI - 0.4; // face north-northwest: the boss shows past Lena
    hero.onFoot = true;
    if (game.traffic.playerCar) game.traffic.exitCar();
    if (game.people.boss) {
      game.people.boss.pos.set(city.tower.x, 0, city.tower.z + 20);
    }
    game.people.thugs.forEach((t, i) => {
      t.pos.set(city.tower.x - 12 + i * 8, 0, city.tower.z + 18);
    });
    game.camMode = 2;
    game.snapCamera();
    return;
  }

  throw new Error('unknown shot: ' + name);
}
