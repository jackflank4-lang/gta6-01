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
    // Lena in a car on a long boulevard at dusk.
    const boulevards = [
      { x: -88, z: 0, heading: Math.PI / 2 },
      { x: 0, z: -88, heading: 0 },
      { x: 88, z: 44, heading: -Math.PI / 2 },
    ];
    const spot = boulevards[rng.int(0, boulevards.length - 1)];
    game.stageInCar(spot.x, spot.z, spot.heading);
    game.setCameraMode(0);
    // Let the car roll a little so the wheels and the city read as motion.
    await sleep(900);
    window.__shotReady = true;
    return;
  }

  if (name === 'chase') {
    // Wanted 2, two cruisers closing in from behind.
    const spots = [
      { x: -44, z: 44, heading: Math.PI / 2 },
      { x: 44, z: -44, heading: -Math.PI / 2 },
    ];
    const spot = spots[rng.int(0, spots.length - 1)];
    game.stageInCar(spot.x, spot.z, spot.heading);
    game.setWanted(2);
    game.setCameraMode(0);
    // Wait for the cruisers to close in (max 8 s).
    for (let i = 0; i < 40; i += 1) {
      await sleep(200);
      const s = game.debugState();
      if (s.police >= 1) break;
    }
    await sleep(1200);
    window.__shotReady = true;
    return;
  }

  if (name === 'mission') {
    // The boss fight: Lena on foot at Meridian Tower, Vic Marino and his
    // crew closing in.
    game.setMission(4);
    const t = city.tower;
    const a = rng.range(0, Math.PI * 2);
    game.teleport(t.x + Math.sin(a) * 14, t.z + Math.cos(a) * 14);
    game.setCameraMode(1);
    // Let the mission spawn the boss and crew, and let them walk in.
    await sleep(2500);
    window.__shotReady = true;
    return;
  }

  // Unknown shot name: just mark ready so the driver does not hang.
  window.__shotReady = true;
}
