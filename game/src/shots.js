// Deterministic screenshot staging for Solmar Bay. Each shot sets up one
// composed scene the engine then renders; the engine raises
// window.__shotReady after a dozen frames so the capture driver can shoot.
// All positions are fixed (seed 1), so the four screenshots are stable.
export function stageShot(engine, name) {
  const city = engine.city;
  if (name === 'start') {
    // Title menu over the dusk city; the engine orbits the camera in menu mode.
    engine.state = 'menu';
    engine.hud.showMenu(false);
    engine.hero.x = city.hideout.x;
    engine.hero.z = city.hideout.z + 12;
    engine.people.heroMesh.position.set(engine.hero.x, 0, engine.hero.z);
    return;
  }

  if (name === 'drive') {
    // Lena driving down the boulevard (road x=44), camera in chase mode.
    engine.giveCar('sedan', 44, -60, 0);
    engine.wanted = 0;
    engine.hud.setStars(0);
    for (const c of engine.vehicles.cruisers.slice()) engine.vehicles.removeCruiser(c);
    engine.hero.car.speed = 12;
    engine.shotCruise = true;
    engine.camMode = 0;
    return;
  }

  if (name === 'chase') {
    // Wanted 3: Lena speeding down the boulevard with two cruisers pulling
    // alongside ahead of her, light bars flashing. (Cruisers behind her
    // would sit behind the chase camera and never be seen.)
    engine.giveCar('sedan', 44, -60, 0);
    engine.addWanted(2); // steal already added 1 -> wanted 3
    engine.hero.car.speed = 14;
    engine.shotCruise = true;
    engine.camMode = 0;
    const cruisers = engine.vehicles.cruisers;
    if (cruisers[0]) {
      cruisers[0].x = 36; cruisers[0].z = -45; cruisers[0].heading = 0; cruisers[0].speed = 14;
      cruisers[0].pace = { dx: -8, dz: 15 };
      cruisers[0].sync();
    }
    if (cruisers[1]) {
      cruisers[1].x = 52; cruisers[1].z = -45; cruisers[1].heading = 0; cruisers[1].speed = 14;
      cruisers[1].pace = { dx: 8, dz: 15 };
      cruisers[1].sync();
    }
    if (cruisers[2]) engine.vehicles.removeCruiser(cruisers[2]);
    return;
  }

  if (name === 'mission') {
    // The finale: Lena on foot on road x=-44, facing Vic Marino and his
    // crew twenty metres up the road — the camera stays on the road too,
    // with the Meridian Tower to the right. (An earlier staging put a
    // streetlight pole between the camera and the hero.)
    engine.hero.x = -44;
    engine.hero.z = 2;
    engine.hero.heading = Math.PI;
    engine.people.heroMesh.position.set(engine.hero.x, 0, engine.hero.z);
    engine.people.heroMesh.rotation.y = engine.hero.heading;
    engine.people.spawnBoss(-44, -18);
    engine.people.spawnThugs(-44, -18, 6);
    engine.camMode = 0;
    return;
  }
}
