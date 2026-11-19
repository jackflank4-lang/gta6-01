// The five story missions, in order: steal-and-deliver, a timed run, a plaza
// fight, three taxi fares, and the boss finale. The runner owns the current
// mission's state, its objective text and its map marker; the engine feeds it
// the player's position and car and it calls back for cash, toasts and saves.

export const MISSION_DEFS = [
  { name: 'First Wheels', payout: 350, blurb: 'Steal a car and bring it to Rosa\u2019s Garage.' },
  { name: 'Neon Dash', payout: 550, blurb: 'Race the casino\u2019s package to the Pelican Diner — 75 seconds.' },
  { name: 'Plaza Brawl', payout: 450, blurb: 'Four of Marino\u2019s thugs own the plaza. Take it back.' },
  { name: 'Night Cabbie', payout: 750, blurb: 'Three fares, one night. Keep the meter running.' },
  { name: 'Kingfish', payout: 5000, blurb: 'Vic Marino waits at the Meridian Tower. End it.' },
];

const UNDAMAGED_BONUS = 150;

export class MissionRunner {
  constructor(spots, people, hooks) {
    this.spots = spots;
    this.people = people;
    this.hooks = hooks; // { toast, addCash, setObjective, setMarker, jingle, fail, save }
    this.index = 0;
    this.done = false;
    this.state = {};
    this.marker = null;
  }

  get def() {
    return MISSION_DEFS[this.index];
  }

  get objectiveText() {
    if (this.done) return 'Solmar Bay is yours, Lena. Free roam — collect coins, cause chaos.';
    const m = this.def;
    switch (this.index) {
      case 0: return this.state.hasCar ? 'Deliver the car to Rosa\u2019s Garage.' : 'Steal a car (press E near one).';
      case 1: return `Deliver the package to the Pelican Diner — ${Math.max(0, Math.ceil(this.state.timeLeft))}s left.`;
      case 2: return `Plaza Brawl: ${this.state.remaining} thug${this.state.remaining === 1 ? '' : 's'} left.`;
      case 3: return this.state.phase === 'pickup'
        ? `Night Cabbie: pick up fare ${this.state.fare} of 3.`
        : `Night Cabbie: drop fare ${this.state.fare} of 3 at the marker.`;
      case 4: return this.state.bossDead ? 'Kingfish down. Get out of there.' : 'Defeat Vic Marino at the Meridian Tower.';
      default: return m.blurb;
    }
  }

  start(index = 0) {
    this.index = index;
    this.done = false;
    this.state = {};
    const spots = this.spots;
    if (index === 0) {
      this.hooks.setObjective(this.objectiveText);
      this.hooks.setMarker(null);
    } else if (index === 1) {
      this.state.timeLeft = 75;
      this.state.from = { ...spots.casino };
      this.hooks.setMarker({ ...spots.diner });
      this.hooks.toast('Neon Dash: 75 seconds to the diner!');
    } else if (index === 2) {
      const thugs = this.people.spawnMissionThugs(spots.plaza, 4);
      this.state.thugs = thugs;
      this.state.remaining = 4;
      this.hooks.setMarker({ ...spots.plaza });
      this.hooks.toast('Plaza Brawl: four thugs. No mercy.');
    } else if (index === 3) {
      this.state.fare = 1;
      this.state.phase = 'pickup';
      this.state.pickup = this.hooks.randomRoadPoint();
      this.hooks.setMarker({ ...this.state.pickup });
    } else if (index === 4) {
      // The boss waits on the open ground SOUTH of the tower (its centre is
      // inside the building itself — spawning there would hide him in it).
      const arena = { x: spots.tower.x, z: spots.tower.z + 14 };
      this.people.spawnBoss(arena);
      this.state.bossDead = false;
      this.hooks.setMarker({ ...spots.tower });
      this.hooks.toast('Kingfish: Vic Marino is waiting. End this.');
    }
    this.hooks.setObjective(this.objectiveText);
  }

  // Advance after a mission completes: pay out, jingle, save, start next.
  complete(bonus = 0) {
    const m = this.def;
    const total = m.payout + bonus;
    this.hooks.addCash(total);
    this.hooks.jingle();
    this.hooks.toast(`${m.name} complete! +$${total}${bonus ? ` (includes $${bonus} bonus)` : ''}`);
    this.people.clearThugs();
    this.hooks.setMarker(null);
    this.index++;
    if (this.index >= MISSION_DEFS.length) {
      this.done = true;
      this.hooks.setObjective(this.objectiveText);
      this.hooks.toast('All missions complete — Solmar Bay is yours!');
      this.hooks.save();
      return;
    }
    this.hooks.save();
    this.start(this.index);
  }

  fail(reason) {
    this.hooks.fail();
    this.hooks.toast(reason);
    // A failed timed run restarts the same mission; a lost fight respawns it.
    this.people.clearThugs();
    this.start(this.index);
  }

  // Called every frame with the live player/car state.
  update(dt, player, car) {
    if (this.done) return;
    this.hooks.setObjective(this.objectiveText);
    if (this.index === 0) {
      const hasCar = !!car;
      if (hasCar && !this.state.hasCar) {
        this.state.hasCar = true;
        this.hooks.setMarker({ ...this.spots.garage });
        this.hooks.toast('Nice wheels. Now get it to Rosa\u2019s Garage.');
      }
      if (hasCar) {
        const d = Math.hypot(car.x - this.spots.garage.x, car.z - this.spots.garage.z);
        if (d < 9) {
          const bonus = car.damage < 0.05 ? UNDAMAGED_BONUS : 0;
          if (bonus) this.hooks.toast('Delivered undamaged — bonus!');
          this.complete(bonus);
        }
      }
    } else if (this.index === 1) {
      this.state.timeLeft -= dt;
      if (this.state.timeLeft <= 0) {
        this.fail('Too slow! The package is cold — run it again.');
        return;
      }
      const d = Math.hypot(player.x - this.spots.diner.x, player.z - this.spots.diner.z);
      if (d < 8) this.complete();
    } else if (this.index === 2) {
      const alive = this.state.thugs.filter((t) => !t.dead).length;
      this.state.remaining = alive;
      if (alive === 0) this.complete();
    } else if (this.index === 3) {
      const target = this.state.phase === 'pickup' ? this.state.pickup : this.state.dropoff;
      const d = Math.hypot(player.x - target.x, player.z - target.z);
      if (this.state.phase === 'pickup') {
        if (car && d < 7) {
          this.state.phase = 'dropoff';
          this.state.dropoff = this.hooks.randomRoadPoint();
          this.hooks.setMarker({ ...this.state.dropoff });
          this.hooks.toast(`Fare ${this.state.fare} aboard — drive!`);
        }
      } else if (car && d < 7) {
        this.hooks.toast(`Fare ${this.state.fare} delivered.`);
        if (this.state.fare >= 3) {
          this.complete();
        } else {
          this.state.fare++;
          this.state.phase = 'pickup';
          this.state.pickup = this.hooks.randomRoadPoint();
          this.hooks.setMarker({ ...this.state.pickup });
        }
      }
    } else if (this.index === 4) {
      const boss = this.people.boss;
      if (boss && boss.dead && !this.state.bossDead) {
        this.state.bossDead = true;
        this.complete();
      }
    }
  }
}
