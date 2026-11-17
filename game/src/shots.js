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
    // Wanted 3: Lena speeding down the boulevard with two cruisers pacing
    // behind her, light bars flashing.
    engine.giveCar('sedan', 44, -60, 0);
    engine.addWanted(2); // steal already added 1 -> wanted 3
    engine.hero.car.speed = 14;
    engine.shotCruise = true;
    engine.camMode = 0;
    const cruisers = engine.vehicles.cruisers;
    if (cruisers[0]) {
      cruisers[0].x = 40; cruisers[0].z = -88; cruisers[0].heading = 0; cruisers[0].speed = 13;
      cruisers[0].sync();
    }
    if (cruisers[1]) {
      cruisers[1].x = 48; cruisers[1].z = -96; cruisers[1].heading = 0; cruisers[1].speed = 13;
      cruisers[1].sync();
    }
    if (cruisers[2]) engine.vehicles.removeCruiser(cruisers[2]);
    return;
  }

  if (name === 'mission') {
    // The finale: Lena on foot in the tower plaza, facing Vic Marino and
    // his crew under the red beacon.
    const tx = city.tower.x;
    const tz = city.tower.z;
    engine.hero.x = tx + 14;
    engine.hero.z = tz + 14;
    engine.hero.heading = Math.atan2(tx - engine.hero.x, tz - engine.hero.z);
    engine.people.heroMesh.position.set(engine.hero.x, 0, engine.hero.z);
    engine.people.heroMesh.rotation.y = engine.hero.heading;
    engine.people.spawnBoss(tx + 4, tz + 4);
    engine.people.spawnThugs(tx, tz, 6);
    engine.camMode = 0;
    return;
  }
}
