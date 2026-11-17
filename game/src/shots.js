// Deterministic staging for the four screenshots. Each shot sets the
// game up in a fixed, readable scene: the title menu over the dusk city,
// driving on the boulevard, a wanted chase with cruisers closing in, and
// the hero facing the boss and his crew at Meridian Tower. The driver
// waits for window.__shotReady, which main.js sets after staging.
export function stageShot(game, name) {
  const city = game.city;
  if (name === 'start') {
    // Menu over the city: leave the game in the menu state and park the
    // camera low over the boulevard looking at the tower.
    game.camera.position.set(city.tower.x - 60, 26, city.tower.z + 95);
    game.camera.lookAt(city.tower.x, 45, city.tower.z);
    game.menuShot = true;
    return;
  }
  // The other three shots play the game.
  game.startGame();
  game.audio.setRadio(false);
  if (name === 'drive') {
    // Drive north up the boulevard toward Meridian Tower.
    game.giveCar('sports', 0, 60, Math.PI);
    game.car.speed = 12;
    game.cruiseSpeed = 12;
    game.camMode = 0;
    game.setBeacon(city.garage.x, city.garage.z, 0xffd27a);
  } else if (name === 'chase') {
    // On the x=44 road heading south, cruisers pacing ahead in the lane.
    game.giveCar('sedan', 44, 88, 0);
    game.car.speed = 20;
    game.cruiseSpeed = 20;
    game.setWanted(3);
    game.camMode = 0;
    const offsets = [-4, 4, -4, 4];
    game.police.cruisers.forEach((c, i) => {
      c.mesh.position.set(44 + offsets[i % offsets.length], 0, 108 + i * 7);
      c.heading = 0;
      c.speed = 20;
    });
    game.setBeacon(city.plaza.x, city.plaza.z, 0xff5a5a);
  } else if (name === 'mission') {
    game.missions.index = 4;
    game.missions.start();
    game.teleport(city.tower.x, city.tower.z + 34);
    game.hero.heading = Math.PI;
    game.camMode = 0;
  }
}
