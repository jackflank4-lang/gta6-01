// The five story missions of Solmar Bay. Lena Cruz, fresh in town with
// $200 and a grudge, works for the Barracuda crew against Vic Marino's
// Kingfish outfit. The module owns mission state only — the engine owns
// cash, the hero and the world, and passes them in as W each update.
// Payouts: 350 (+150 undamaged bonus) / 550 / 450 / 750 / 5000.
const MISSIONS = [
  { name: 'Hot Wheels', brief: 'Steal a car and deliver it to Rosa\'s Garage. Bring it back clean for a bonus.' },
  { name: 'Diner Dash', brief: 'Timed delivery: get to the Pelican Diner in 75 seconds.' },
  { name: 'Plaza Brawl', brief: 'Four Kingfish thugs are waiting at the plaza. Put them down.' },
  { name: 'Three Fares', brief: 'Drive the cab: pick up three fares and drop them off.' },
  { name: 'Kingfish Down', brief: 'Vic Marino is at Meridian Tower with his crew. End it.' },
];

export function createMissions(city) {
  let index = 0;
  let done = false;
  let phase = 'start'; // per-mission phase
  let timer = 0;
  let fare = 0; // fares completed in mission 4
  let pickup = null; // {x, z} of the current fare's passenger
  let dropoff = null; // {x, z} of the current fare's destination
  let thugsSpawned = false;
  let bossSpawned = false;
  let stolen = false;

  function resetMissionState() {
    phase = 'start';
    timer = 0;
    fare = 0;
    pickup = null;
    dropoff = null;
    thugsSpawned = false;
    bossSpawned = false;
    stolen = false;
  }

  function start(i) {
    index = i;
    resetMissionState();
    if (i === 1) timer = 75;
    if (i === 3) {
      fare = 0;
      pickup = null;
      dropoff = null;
      phase = 'pickup';
    }
  }

  function complete(W, amount, text) {
    W.addCash(amount, text);
    if (W.audio) W.audio.missionDone();
    W.toast(`${MISSIONS[index].name} complete — +$${amount}`);
    index += 1;
    if (index >= MISSIONS.length) {
      done = true;
      W.toast('Solmar Bay is yours, Lena. Free roam — keep the meter running.');
    } else {
      start(index);
      W.toast(`New mission: ${MISSIONS[index].name} — ${MISSIONS[index].brief}`);
    }
  }

  function fail(W, text) {
    W.toast(text);
    if (W.audio) W.audio.busted();
    resetMissionState();
    if (index === 1) timer = 75;
    if (index === 3) phase = 'pickup';
  }

  // Current navigation target for the marker / minimap, or null.
  function markerPos(W) {
    if (done) return null;
    if (index === 0) return stolen ? city.garage : null;
    if (index === 1) return city.diner;
    if (index === 2) return city.plaza;
    if (index === 3) return phase === 'pickup' ? pickup : dropoff;
    if (index === 4) return city.tower;
    return null;
  }

  function objectiveText(W) {
    if (done) return 'Free roam — Solmar Bay is yours.';
    if (index === 0) return stolen ? 'Deliver the car to Rosa\'s Garage' : 'Steal a car (walk up and press E)';
    if (index === 1) return `Reach the Pelican Diner — ${Math.max(0, Math.ceil(timer))}s left`;
    if (index === 2) return `Defeat the plaza thugs (${W.thugsLeft || 0} left)`;
    if (index === 3) return phase === 'pickup' ? `Pick up fare ${fare + 1} of 3` : `Drop off fare ${fare + 1} of 3`;
    if (index === 4) return 'Defeat Vic Marino at Meridian Tower';
    return '';
  }

  function newFarePoint(W) {
    const p = city.roadPoint();
    return { x: p.x, z: p.z };
  }

  function update(dt, W) {
    if (done) return;
    const hero = W.hero;
    const driving = W.driving;
    const car = W.car;
    if (index === 0) {
      if (driving) stolen = true;
      if (stolen && driving && car) {
        const d = Math.hypot(car.x - city.garage.x, car.z - city.garage.z);
        if (d < 9) {
          const bonus = car.damage < 5 ? 150 : 0;
          complete(W, 350 + bonus, 'Hot Wheels');
          if (bonus > 0) W.toast('Undamaged bonus +$150');
        }
      }
    } else if (index === 1) {
      timer -= dt;
      if (timer <= 0) {
        fail(W, 'Too slow — Diner Dash failed. Try again.');
        return;
      }
      const d = Math.hypot(hero.x - city.diner.x, hero.z - city.diner.z);
      if (d < 9) complete(W, 550, 'Diner Dash');
    } else if (index === 2) {
      if (!thugsSpawned) {
        thugsSpawned = true;
        for (let i = 0; i < 4; i += 1) {
          const a = (i / 4) * Math.PI * 2;
          W.people.spawnThug(city.plaza.x + Math.sin(a) * 7, city.plaza.z + Math.cos(a) * 7, { hp: 100, dmg: 6 });
        }
        W.toast('Four thugs at the plaza. F to punch.');
      }
      if (thugsSpawned && W.people.thugs.length === 0) {
        complete(W, 450, 'Plaza Brawl');
      }
    } else if (index === 3) {
      if (phase === 'pickup' && !pickup) {
        pickup = newFarePoint(W);
        W.toast(`Fare ${fare + 1}: passenger waiting — follow the gold marker.`);
      }
      if (phase === 'pickup' && pickup && driving && car) {
        const d = Math.hypot(car.x - pickup.x, car.z - pickup.z);
        if (d < 5) {
          pickup = null;
          dropoff = newFarePoint(W);
          phase = 'dropoff';
          W.toast('Passenger aboard — take them to the marker.');
        }
      }
      if (phase === 'dropoff' && dropoff && driving && car) {
        const d = Math.hypot(car.x - dropoff.x, car.z - dropoff.z);
        if (d < 5) {
          fare += 1;
          W.addCash(250, `Fare ${fare}`);
          W.toast(`Fare ${fare} of 3 paid +$250`);
          dropoff = null;
          if (fare >= 3) {
            complete(W, 0, 'Three Fares');
          } else {
            phase = 'pickup';
          }
        }
      }
    } else if (index === 4) {
      if (!bossSpawned) {
        bossSpawned = true;
        const t = city.tower;
        // Boss and crew stage on the road south of the tower (clear of the
        // tower itself — spawning inside it would trap them in the walls).
        W.people.spawnThug(t.x, t.z + 14, { hp: 300, dmg: 10, scale: 1.35, shirt: 0x111111, isBoss: true, name: 'Vic Marino', reward: 500 });
        W.people.spawnThug(t.x - 7, t.z + 16, { hp: 120, dmg: 8 });
        W.people.spawnThug(t.x + 7, t.z + 16, { hp: 120, dmg: 8 });
        W.people.spawnThug(t.x, t.z + 20, { hp: 120, dmg: 8 });
        W.toast('Vic Marino is at the tower. Take him down.');
      }
      if (bossSpawned && !W.people.boss) {
        complete(W, 5000, 'Kingfish Down');
      }
    }
  }

  return {
    update, start, markerPos, objectiveText,
    get index() { return index; },
    get done() { return done; },
    get name() { return done ? 'Free Roam' : MISSIONS[index].name; },
    get brief() { return done ? 'Solmar Bay is yours.' : MISSIONS[index].brief; },
    setIndex(i) { start(i); },
  };
}
