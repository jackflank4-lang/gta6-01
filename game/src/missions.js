// Story missions for Solmar Bay (v10): five missions in order, each with a
// cash payout. The engine drives the checks (position, car, enemies down);
// this module owns the mission state, the objective text and the 3D beacon
// that marks the current target.

const DEFS = [
  { name: 'Hot Wheels', payout: 350, intro: "Steal a car and bring it to Rosa's Garage." },
  { name: 'Neon Run', payout: 550, intro: 'Timed delivery: reach the Marina in 90 seconds.' },
  { name: 'Plaza Brawl', payout: 450, intro: 'Beat the 4 thugs in the plaza.' },
  { name: 'Night Shift', payout: 750, intro: 'Three taxi fares. Pick up, drop off, get paid.' },
  { name: 'Kingfish', payout: 5000, intro: 'Take down Vic Marino at the Meridian Tower.' },
];

export function createMissions(game) {
  const THREE = window.THREE;
  const { scene, city, people, rng } = game;

  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x22e5ff, transparent: true, opacity: 0.28, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 16, 1, true), beaconMat);
  beacon.position.y = 17;
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0x22e5ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  ring.visible = false;
  scene.add(ring);

  let index = 0; // 0..4 active, 5 = all done
  let phase = 'needCar';
  let timer = 0;
  let faresDone = 0;
  let fareState = 'toPickup';
  let pickup = null;
  let dest = null;
  let spawned = false;

  function marker() {
    if (index >= 5) return null;
    if (index === 0) return phase === 'deliver' ? { x: city.garage.x, z: city.garage.z } : null;
    if (index === 1) return { x: city.marina.x, z: city.marina.z - 6 };
    if (index === 2) return { x: city.plaza.x, z: city.plaza.z };
    if (index === 3) return fareState === 'toPickup' ? pickup : dest;
    if (index === 4) return { x: city.tower.x, z: city.tower.z + 22 };
    return null;
  }

  function objective() {
    if (index >= 5) return 'Solmar Bay is yours — free roam. Buy low, sell high, stay free.';
    if (index === 0) return phase === 'needCar' ? 'Mission 1 — Hot Wheels: steal a car (E near a parked car).' : "Mission 1 — Hot Wheels: deliver the car to Rosa's Garage.";
    if (index === 1) return `Mission 2 — Neon Run: reach the Marina. ${Math.ceil(timer)}s left.`;
    if (index === 2) return `Mission 3 — Plaza Brawl: thugs down ${people.countThugsDown(true)}/4.`;
    if (index === 3) return `Mission 4 — Night Shift: fares ${faresDone}/3 — ${fareState === 'toPickup' ? 'pick up the fare' : 'drop off the fare'}.`;
    if (index === 4) return 'Mission 5 — Kingfish: take down Vic Marino at the Meridian Tower.';
    return '';
  }

  function startMission(i) {
    index = i;
    spawned = false;
    if (i === 0) phase = 'needCar';
    if (i === 1) { phase = 'drive'; timer = 90; }
    if (i === 2) { phase = 'fight'; }
    if (i === 3) { phase = 'taxi'; faresDone = 0; fareState = 'toPickup'; newFare(); }
    if (i === 4) { phase = 'boss'; }
    if (i < 5) game.toast(`Mission ${i + 1} — ${DEFS[i].name}: ${DEFS[i].intro}`);
  }

  function newFare() {
    pickup = city.randomSidewalkPoint();
    // Destination: a different sidewalk point at least 80 m away.
    let d = city.randomSidewalkPoint();
    let guard = 0;
    while (Math.hypot(d.x - pickup.x, d.z - pickup.z) < 80 && guard < 20) {
      d = city.randomSidewalkPoint();
      guard += 1;
    }
    dest = d;
    fareState = 'toPickup';
  }

  function complete(payout, bonus) {
    const total = payout + (bonus || 0);
    const doneIdx = index;
    game.addCash(total);
    game.audio.missionDone();
    game.toast(`Mission ${doneIdx + 1} complete — +$${total}${bonus ? ` (incl. $${bonus} bonus)` : ''}.`);
    const next = index + 1;
    if (next >= 5) {
      index = 5;
      game.toast('All missions done. Solmar Bay is yours, Lena.');
    } else {
      startMission(next);
    }
    // Save AFTER the index advanced, so a Continue restores the new mission.
    game.onMissionComplete();
  }

  function update(dt) {
    if (index >= 5) {
      beacon.visible = false;
      ring.visible = false;
      return;
    }
    const m = marker();
    if (m) {
      beacon.visible = true;
      ring.visible = true;
      beacon.position.x = m.x;
      beacon.position.z = m.z;
      ring.position.x = m.x;
      ring.position.z = m.z;
      beaconMat.opacity = 0.22 + 0.12 * Math.sin(game.time * 3);
    } else {
      beacon.visible = false;
      ring.visible = false;
    }

    const heroPos = game.hero.pos;
    const inCar = !!game.vehicles.playerCar;

    if (index === 0) {
      if (phase === 'needCar' && inCar) {
        phase = 'deliver';
        game.toast("Now deliver it to Rosa's Garage — undamaged pays +$150.");
      } else if (phase === 'deliver' && inCar) {
        const d = Math.hypot(heroPos.x - city.garage.x, heroPos.z - city.garage.z);
        // Hero pos follows the car while driving (engine keeps them in sync).
        const car = game.vehicles.playerCar;
        const cd = Math.hypot(car.mesh.position.x - city.garage.x, car.mesh.position.z - city.garage.z);
        if (Math.min(d, cd) < 9) {
          const bonus = car.damage === 0 ? 150 : 0;
          complete(DEFS[0].payout, bonus);
        }
      }
    } else if (index === 1) {
      timer -= dt;
      if (timer <= 0) {
        timer = 90;
        game.toast('Neon Run: too slow — try again, 90 seconds on the clock.');
      } else {
        const d = Math.hypot(heroPos.x - city.marina.x, heroPos.z - (city.marina.z - 6));
        if (d < 10) complete(DEFS[1].payout, 0);
      }
    } else if (index === 2) {
      if (!spawned) {
        spawned = true;
        for (let i = 0; i < 4; i += 1) {
          people.spawnThug(city.plaza.x + [-8, 8, -4, 4][i], city.plaza.z + [-6, 6, 8, -8][i], 60, true);
        }
        game.toast('Four thugs in the plaza. Put them down.');
      }
      if (people.countThugsAlive(true) === 0 && people.countThugsDown(true) >= 4) {
        complete(DEFS[2].payout, 0);
      }
    } else if (index === 3) {
      if (fareState === 'toPickup' && inCar && pickup) {
        const car = game.vehicles.playerCar;
        const d = Math.hypot(car.mesh.position.x - pickup.x, car.mesh.position.z - pickup.z);
        if (d < 7) {
          fareState = 'toDrop';
          game.toast('Fare picked up. Drive to the marker.');
        }
      } else if (fareState === 'toDrop' && inCar && dest) {
        const car = game.vehicles.playerCar;
        const d = Math.hypot(car.mesh.position.x - dest.x, car.mesh.position.z - dest.z);
        if (d < 8) {
          faresDone += 1;
          game.addCash(250);
          game.audio.coin();
          if (faresDone >= 3) {
            game.audio.missionDone();
            game.toast('Night Shift done — $750 in fares.');
            startMission(4);
            game.onMissionComplete();
          } else {
            game.toast(`Fare ${faresDone}/3 paid +$250. Next fare...`);
            newFare();
          }
        }
      }
    } else if (index === 4) {
      if (!spawned) {
        spawned = true;
        people.spawnBoss(city.tower.x, city.tower.z + 22);
        for (let i = 0; i < 4; i += 1) {
          people.spawnThug(city.tower.x + [-10, 10, -6, 6][i], city.tower.z + 22 + [-4, 4, 8, -6][i], 60, true);
        }
        game.toast('Vic Marino and his crew are waiting at the Meridian Tower.');
      }
      const boss = people.boss;
      if (boss && boss.down) {
        complete(DEFS[4].payout, 0);
      }
    }
  }

  function setIndex(i) {
    // Used by save/load: jump straight to a mission without the intro toast.
    index = i;
    spawned = false;
    if (i === 0) phase = 'needCar';
    if (i === 1) { phase = 'drive'; timer = 90; }
    if (i === 2) phase = 'fight';
    if (i === 3) { phase = 'taxi'; faresDone = 0; fareState = 'toPickup'; newFare(); }
    if (i === 4) phase = 'boss';
  }

  return {
    defs: DEFS,
    get index() { return index; },
    get name() { return index < 5 ? DEFS[index].name : 'Free Roam'; },
    objective, marker, update, startMission, setIndex,
    get phase() { return phase; },
    get faresDone() { return faresDone; },
  };
}
