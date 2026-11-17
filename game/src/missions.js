// Story missions for Solmar Bay. Five in order: Hotwire, Timed Drop, Plaza
// Brawl, Taxi (3 fares) and the Kingfish finale. The engine owns the hero,
// cash and combat; this class owns the mission state, objectives, timers
// and spawns. update() returns an event when a mission completes or fails.
export class Missions {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.done = false;
    this.name = '';
    this.objective = '';
    this.marker = null; // {x, z} for the beacon + minimap, or null
    this.timer = 0;
    this.fare = 0;
    this.fareStage = 'pickup';
    this.spawned = false;
    this.start(0);
  }

  get all() {
    return [
      { name: 'Hotwire', payout: 350 },
      { name: 'Timed Drop', payout: 550 },
      { name: 'Plaza Brawl', payout: 450 },
      { name: 'Taxi', payout: 750 },
      { name: 'Kingfish', payout: 5000 },
    ];
  }

  start(i) {
    this.index = i;
    this.spawned = false;
    this.timer = 0;
    const w = this.world;
    if (i === 0) {
      this.name = 'Hotwire';
      this.objective = 'Steal a car and deliver it to Rosa\'s Garage undamaged';
      this.marker = { x: w.city.garage.x, z: w.city.garage.z };
    } else if (i === 1) {
      this.name = 'Timed Drop';
      this.objective = 'Deliver the package to the Pelican Diner in 75 seconds';
      this.marker = { x: w.city.diner.x, z: w.city.diner.z };
      this.timer = 75;
    } else if (i === 2) {
      this.name = 'Plaza Brawl';
      this.objective = 'Take down all four thugs in the plaza';
      this.marker = { x: w.city.plaza.x, z: w.city.plaza.z };
    } else if (i === 3) {
      this.name = 'Taxi';
      this.fare = 0;
      this.fareStage = 'pickup';
      this.objective = 'Taxi fare 1 of 3: pick up the passenger';
      this.marker = { x: 0, z: -88 };
    } else if (i === 4) {
      this.name = 'Kingfish';
      this.objective = 'Take down Vic Marino at the Meridian Tower';
      this.marker = { x: w.city.tower.x, z: w.city.tower.z };
    }
  }

  _farePoints() {
    return [
      { pickup: { x: 0, z: -88 }, drop: { x: 110, z: -110 } },
      { pickup: { x: -88, z: 44 }, drop: { x: 66, z: 110 } },
      { pickup: { x: 88, z: -44 }, drop: { x: -22, z: -22 } },
    ];
  }

  _dist(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  update(dt) {
    const w = this.world;
    const hero = w.hero;
    if (this.done) return null;

    if (this.index === 0) {
      // Hotwire: hero in a car inside the garage beacon.
      if (hero.inCar && hero.car && this._dist(hero, this.world.city.garage) < 16) {
        const undamaged = hero.car.damage <= 0;
        const payout = 350 + (undamaged ? 150 : 0);
        this._advance();
        return { done: true, payout, bonus: undamaged ? 150 : 0, message: undamaged ? 'Delivered undamaged — bonus $150!' : 'Car delivered' };
      }
      return null;
    }

    if (this.index === 1) {
      this.timer -= dt;
      if (this._dist(hero, this.world.city.diner) < 12) {
        this._advance();
        return { done: true, payout: 550, bonus: 0, message: 'Package delivered on time' };
      }
      if (this.timer <= 0) {
        this.timer = 75;
        return { failed: true, message: 'Too slow — the drop timed out. Try again.' };
      }
      return null;
    }

    if (this.index === 2) {
      if (!this.spawned) {
        w.people.spawnThugs(w.city.plaza.x, w.city.plaza.z, 4);
        this.spawned = true;
      }
      const alive = w.people.thugs.filter((t) => t.alive).length;
      if (alive === 0) {
        this._advance();
        return { done: true, payout: 450, bonus: 0, message: 'Plaza cleared' };
      }
      return null;
    }

    if (this.index === 3) {
      const fares = this._farePoints();
      const f = fares[this.fare];
      const target = this.fareStage === 'pickup' ? f.pickup : f.drop;
      this.marker = target;
      if (this._dist(hero, target) < 8) {
        if (this.fareStage === 'pickup') {
          this.fareStage = 'drop';
          this.objective = `Taxi fare ${this.fare + 1} of 3: drop the passenger off`;
          return { progress: true, message: 'Passenger picked up' };
        }
        this.fare += 1;
        if (this.fare >= 3) {
          this._advance();
          return { done: true, payout: 750, bonus: 0, message: 'All fares done' };
        }
        this.fareStage = 'pickup';
        this.objective = `Taxi fare ${this.fare + 1} of 3: pick up the passenger`;
        this.marker = fares[this.fare].pickup;
        return { progress: true, payout: 250, message: `Fare ${this.fare} done — $250` };
      }
      return null;
    }

    if (this.index === 4) {
      if (!this.spawned) {
        w.people.spawnBoss(w.city.tower.x + 6, w.city.tower.z + 6);
        w.people.spawnThugs(w.city.tower.x, w.city.tower.z, 6);
        this.spawned = true;
      }
      if (w.people.boss && !w.people.boss.alive) {
        this.done = true;
        this.name = 'Kingfish';
        this.objective = 'Solmar Bay is yours, Lena.';
        this.marker = null;
        return { done: true, payout: 5000, bonus: 0, message: 'Vic Marino is down. Solmar Bay is yours.' };
      }
      return null;
    }
    return null;
  }

  _advance() {
    const next = this.index + 1;
    if (next >= this.all.length) {
      this.done = true;
      return;
    }
    this.start(next);
  }
}
