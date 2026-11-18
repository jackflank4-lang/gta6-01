// Story missions for Solmar Bay — Neon Heat.
// Five missions, $350 / $550 / $450 / $750 / $5,000, plus a $150 bonus for
// delivering the first car undamaged. The engine feeds this system events
// (car stolen, thug killed, boss killed); the system owns objectives,
// markers, timers and payouts.
export class MissionSystem {
  constructor(ctx) {
    this.ctx = ctx; // { city, people, traffic, onComplete, onToast, onObjective }
    this.index = -1; // -1 = no mission yet
    this.done = [false, false, false, false, false];
    this.objective = 'Press Start to begin.';
    this.marker = null; // { x, z, label }
    this.timer = 0;
    this.stolenCar = null;
    this.fareStage = 0; // 0 = heading to pickup, 1 = heading to drop-off
    this.fareIndex = 0;
    this.fares = [
      { pickup: { x: -22, z: 96, label: 'Pick up the fare at Pelican Diner' }, drop: { x: 110, z: -44, label: 'Drop the fare at Luna Casino' } },
      { pickup: { x: -66, z: 54, label: 'Pick up the fare at the park' }, drop: { x: 22, z: -2, label: 'Drop the fare at Meridian Tower' } },
      { pickup: { x: 164, z: -10, label: 'Pick up the fare at the beach' }, drop: { x: -110, z: 96, label: 'Drop the fare at the Hideout' } },
    ];
  }

  setObjective(text, marker) {
    this.objective = text;
    this.marker = marker || null;
    if (this.ctx.onObjective) this.ctx.onObjective(text, marker);
  }

  start(index) {
    this.index = index;
    this.fareStage = 0;
    this.fareIndex = 0;
    this.stolenCar = null;
    this.timer = 0;
    const city = this.ctx.city;
    if (index === 0) {
      this.setObjective('Steal a car and bring it to Rosa\u2019s Garage', { x: city.garage.x, z: city.garage.z, label: 'Rosa\u2019s Garage' });
    } else if (index === 1) {
      this.timer = 60;
      // Deliver to the casino forecourt, not the building centre: the
      // centre is inside the casino collider and unreachable.
      this.setObjective('Sunset delivery: reach Luna Casino in 60s', { x: city.casinoFront.x, z: city.casinoFront.z, label: 'Luna Casino' });
    } else if (index === 2) {
      this.ctx.people.spawnThugs(4, city.plaza, 9);
      this.setObjective('Plaza brawl: take down all 4 thugs', { x: city.plaza.x, z: city.plaza.z, label: 'Plaza' });
    } else if (index === 3) {
      const f = this.fares[0];
      this.setObjective(f.pickup.label + ' (get in a car first)', { x: f.pickup.x, z: f.pickup.z, label: 'Pickup' });
    } else if (index === 4) {
      this.ctx.people.spawnThugs(4, city.tower, 12);
      this.ctx.people.spawnBoss({ x: city.tower.x + 6, z: city.tower.z + 6 });
      this.setObjective('Neon Heat: defeat Vic Marino at Meridian Tower', { x: city.tower.x, z: city.tower.z, label: 'Vic Marino' });
    }
  }

  complete(payout, bonus) {
    const idx = this.index;
    this.done[idx] = true;
    if (this.ctx.onComplete) this.ctx.onComplete(idx, payout, bonus || 0);
    if (idx < 4) {
      this.start(idx + 1);
    } else {
      this.index = 5;
      this.setObjective('All missions complete. Solmar Bay is yours, Lena.', null);
    }
  }

  onCarStolen(car) {
    if (this.index === 0 && !this.stolenCar) {
      this.stolenCar = car;
      this.setObjective('Deliver the car to Rosa\u2019s Garage — undamaged pays +$150', { x: this.ctx.city.garage.x, z: this.ctx.city.garage.z, label: 'Rosa\u2019s Garage' });
    }
  }

  onThugKilled() {
    if (this.index === 2 && this.ctx.people.thugs.length === 0) {
      this.complete(450, 0);
    }
  }

  onBossKilled() {
    if (this.index === 4) {
      this.complete(5000, 0);
    }
  }

  update(dt, hero, inCar) {
    if (this.index < 0 || this.index > 4) return;
    const city = this.ctx.city;
    const dist = (p) => {
      const dx = hero.pos.x - p.x;
      const dz = hero.pos.z - p.z;
      return Math.sqrt(dx * dx + dz * dz);
    };
    if (this.index === 0 && this.stolenCar) {
      if (dist(city.garage) < 7) {
        const bonus = this.stolenCar.damage <= 0 ? 150 : 0;
        this.complete(350, bonus);
      }
    } else if (this.index === 1) {
      this.timer -= dt;
      if (dist(city.casinoFront) < 8) {
        this.complete(550, 0);
      } else if (this.timer <= 0) {
        if (this.ctx.onToast) this.ctx.onToast('Too slow — the delivery is still waiting. Try again.');
        this.start(1);
      }
    } else if (this.index === 3) {
      const fare = this.fares[this.fareIndex];
      if (!fare) return;
      if (this.fareStage === 0) {
        if (inCar && dist(fare.pickup) < 6) {
          this.fareStage = 1;
          this.setObjective(fare.drop.label, { x: fare.drop.x, z: fare.drop.z, label: 'Drop-off' });
          if (this.ctx.onToast) this.ctx.onToast('Fare picked up. Drive to the drop-off.');
        }
      } else if (inCar && dist(fare.drop) < 6) {
        this.fareIndex++;
        this.fareStage = 0;
        if (this.fareIndex >= this.fares.length) {
          this.complete(750, 0);
        } else {
          const next = this.fares[this.fareIndex];
          this.setObjective(next.pickup.label, { x: next.pickup.x, z: next.pickup.z, label: 'Pickup' });
          if (this.ctx.onToast) this.ctx.onToast('Fare delivered. Next pickup marked.');
        }
      }
    }
  }
}
