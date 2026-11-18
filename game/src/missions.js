// missions.js — Lena's five jobs for the Barracuda crew.
// 1 Hot Wheels: steal any car, deliver it to Rosa's Garage.
// 2 High Roller: timed delivery to the Luna Casino (90 s).
// 3 Plaza Brawl: clear four Barracuda thugs off the plaza.
// 4 Cab Hustle: three taxi fares across the city.
// 5 Neon Heat: the finale — four thugs plus boss Vic Marino (300 HP)
//    at the Meridian Tower plaza. Pays $5,000.
const FARES = [
  { pickup: [-22, 88], drop: [110, -44] },
  { pickup: [-66, 44], drop: [22, 0] },
  { pickup: [132, 66], drop: [-88, 132] },
];

export const MISSION_NAMES = ['Hot Wheels', 'High Roller', 'Plaza Brawl', 'Cab Hustle', 'Neon Heat'];
// Completion bonus per mission. Cab Hustle pays $0 here because its
// three fares already pay $250 each as they are delivered.
export const MISSION_PAY = [350, 550, 450, 0, 5000];

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0; // active mission, 0..4; 5 = story complete
    this.objective = '';
    this.timer = 0;
    this.fareIndex = 0;
    this.fareStage = 'pickup'; // 'pickup' | 'drop'
    this.started = false;
    this._announce();
  }

  _announce() {
    const g = this.game;
    if (this.index >= 5) {
      this.objective = 'All missions complete. Solmar Bay is yours, Lena.';
      g.setObjective(this.objective);
      return;
    }
    switch (this.index) {
      case 0:
        this.objective = 'Mission 1 — Hot Wheels: steal a car and deliver it to Rosa\'s Garage.';
        break;
      case 1:
        this.timer = 90;
        this.objective = 'Mission 2 — High Roller: deliver the car to the Luna Casino. 90s on the clock.';
        break;
      case 2:
        this.objective = 'Mission 3 — Plaza Brawl: clear the Barracudas off the plaza.';
        g.people.spawnThugs(4, 22, 22);
        break;
      case 3:
        this.fareIndex = 0;
        this.fareStage = 'pickup';
        this.objective = 'Mission 4 — Cab Hustle: pick up fare 1 of 3.';
        break;
      case 4:
        this.objective = 'Mission 5 — Neon Heat: take down Vic Marino at Meridian Tower.';
        g.people.spawnThugs(4, 22, 0);
        g.people.spawnBoss(22, -6);
        break;
    }
    g.setObjective(this.objective);
  }

  _complete() {
    const g = this.game;
    const pay = MISSION_PAY[this.index];
    let bonus = 0;
    let note = '';
    if (this.index === 0) {
      const car = g.vehicles.playerCar;
      if (car && car.damage === 0) { bonus = 150; note = ' Undamaged delivery: +$150.'; }
    }
    g.addCash(pay + bonus, MISSION_NAMES[this.index]);
    g.audio.mission();
    const payText = pay + bonus > 0 ? ` +$${pay + bonus}` : '';
    g.toast(`Mission complete: ${MISSION_NAMES[this.index]}${payText}.${note}`);
    this.index++;
    this._announce();
    if (this.index >= 5) g.onStoryComplete();
  }

  _dist2(x, z, tx, tz) {
    const dx = x - tx, dz = z - tz;
    return dx * dx + dz * dz;
  }

  update(dt) {
    const g = this.game;
    if (this.index >= 5 || !g.playing) return;
    const car = g.vehicles.playerCar;
    const hero = g.people.hero;
    const px = car ? car.pos.x : hero.pos.x;
    const pz = car ? car.pos.z : hero.pos.z;
    switch (this.index) {
      case 0: {
        if (car) {
          const lm = g.city.landmarks.garage;
          if (this._dist2(px, pz, lm.x, lm.z) < lm.radius * lm.radius) this._complete();
        }
        break;
      }
      case 1: {
        this.timer -= dt;
        const lm = g.city.landmarks.casino;
        if (car && this._dist2(px, pz, lm.x, lm.z) < lm.radius * lm.radius) {
          this._complete();
          break;
        }
        if (this.timer <= 0) {
          this.timer = 90;
          g.toast('Too slow — the casino job is still open. Try again.');
          this.objective = 'Mission 2 — High Roller: deliver the car to the Luna Casino. 90s on the clock.';
          g.setObjective(this.objective);
        } else {
          const s = Math.ceil(this.timer);
          g.setObjective(`Mission 2 — High Roller: reach the Luna Casino. ${s}s left.`);
        }
        break;
      }
      case 2: {
        if (g.people.thugs.length === 0) this._complete();
        break;
      }
      case 3: {
        const fare = FARES[this.fareIndex];
        const target = this.fareStage === 'pickup' ? fare.pickup : fare.drop;
        if (car && this._dist2(px, pz, target[0], target[1]) < 144) { // within 12 m
          if (this.fareStage === 'pickup') {
            this.fareStage = 'drop';
            g.toast('Passenger aboard. Drop them off.');
            g.setObjective(`Mission 4 — Cab Hustle: drop fare ${this.fareIndex + 1} of 3 at (${fare.drop[0]}, ${fare.drop[1]}).`);
          } else {
            g.addCash(250, 'Taxi fare');
            g.audio.coin();
            this.fareIndex++;
            this.fareStage = 'pickup';
            if (this.fareIndex >= FARES.length) {
              this._complete();
            } else {
              g.toast(`Fare paid: +$250. Fare ${this.fareIndex + 1} of 3 next.`);
              g.setObjective(`Mission 4 — Cab Hustle: pick up fare ${this.fareIndex + 1} of 3.`);
            }
          }
        } else if (this.fareStage === 'pickup') {
          g.setObjective(`Mission 4 — Cab Hustle: pick up fare ${this.fareIndex + 1} of 3 at (${fare.pickup[0]}, ${fare.pickup[1]}).`);
        }
        break;
      }
      case 4: {
        const p = g.people;
        if (p.thugs.length === 0 && !p.boss) this._complete();
        break;
      }
    }
  }
}
