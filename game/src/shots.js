// Shot staging for Solmar Bay: puts the game into a photogenic state for
// each of the four screenshots and sets window.__shotReady when the frame
// is settled. The seed (from ?seed=) picks the staging variant, so a
// seed=7 run stages differently from a seed=1 run — same game, different
// angles and positions. Nothing here is a cheat: it only uses the engine's
// public debug API (teleport, giveCar, setWanted, setMission).
import { makeRng } from './rng.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function stageShot(game, name, seed) {
  const rng = makeRng(seed * 101 + 7);
  const city = game.city;
  window.__shotReady = false;

  if (name === 'start') {
    // Title menu over the city: the engine's menu camera orbits slowly,
    // so wait for it to swing over the marina side.
    game.setCameraMode(0);
    await sleep(3200);
    window.__shotReady = true;
    return;
  }

  // Every other shot plays the game.
  game.forcePlay();

  if (name === 'drive') {
    // Lena in a car on a long boulevard at dusk. Headings run ALONG the
    // road the car sits on (a road at fixed x runs along z, and vice versa)
    // so the chase camera behind the car stays on the road too.
    const boulevards = [
      { x: -88, z: 0, heading: 0 },
      { x: 0, z: -88, heading: Math.PI / 2 },
      { x: 88, z: 44, heading: Math.PI },
    ];
    const spot = boulevards[rng.int(0, boulevards.length - 1)];
    const car = game.stageInCar(spot.x, spot.z, spot.heading);
    car.speed = 12; // rolling at ~27 MPH for the still
    game.setCameraMode(0);
    game.snapCamera();
    await sleep(900);
    game.snapCamera();
    window.__shotReady = true;
    return;
  }

  if (name === 'chase') {
    // Wanted 2, two cruisers closing in from behind.
    const spots = [
      { x: -44, z: 44, heading: 0 },
      { x: 44, z: -44, heading: -Math.PI / 2 },
    ];
    const spot = spots[rng.int(0, spots.length - 1)];
    const car = game.stageInCar(spot.x, spot.z, spot.heading);
    car.speed = 12;
    game.setWanted(2);
    game.setCameraMode(0);
    game.snapCamera();
    // Wait for a cruiser to close to within 18 m of the hero (max 12 s),
    // so it is actually in the frame when the still is taken.
    for (let i = 0; i < 60; i += 1) {
      await sleep(200);
      const police = game.vehiclesApi.police;
      const hero = game.hero;
      let closest = Infinity;
      for (const p of police) closest = Math.min(closest, Math.hypot(p.x - hero.x, p.z - hero.z));
      if (closest < 18) break;
    }
    await sleep(600);
    game.snapCamera();
    window.__shotReady = true;
    return;
  }

  if (name === 'mission') {
    // The boss fight: Lena on foot on the road south of Meridian Tower,
    // facing it — the chase camera behind her lands on the road (clear of
    // buildings) and the tower, Vic Marino and his crew are all in frame.
    game.setMission(4);
    const t = city.tower;
    game.teleport(t.x, t.z + 22);
    game.hero.heading = Math.PI;
    game.setCameraMode(0);
    game.snapCamera();
    // Let the mission spawn the boss and crew, and let them walk in.
    await sleep(2500);
    game.snapCamera();
    window.__shotReady = true;
    return;
  }

  // Unknown shot name: just mark ready so the driver does not hang.
  window.__shotReady = true;
}
