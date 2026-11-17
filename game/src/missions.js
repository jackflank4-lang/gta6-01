// The five story missions of Solmar Bay, in order: steal and deliver a
// car, a timed delivery, a plaza brawl, three taxi fares, and the boss
// finale. The manager reads the world each frame (hero position, car,
// living thugs) and drives the mission forward, paying out on completion.
// The world object is the Game; it provides the scene, the city layout,
// beacons, toasts, cash and car/thug spawning.
import { makePersonMesh } from './people.js';
import { Rng } from './rng.js';

export const MISSIONS = [
  { name: 'Hot Wheels', payout: 350 },
  { name: 'Pelican Special', payout: 550 },
  { name: 'Plaza Brawl', payout: 450 },
  { name: 'Night Shift', payout: 750 },
  { name: 'Kingfish Down', payout: 5000 },
];

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.stage = 0;
    this.timer = 0;
    this.fare = 0;
    this.farePed = null;
    this.fareDest = null;
    this.rng = new Rng(2026);
    this.started = false;
  }

  get done() {
    return this.index >= MISSIONS.length;
  }

  name() {
    return this.done ? 'Story complete' : MISSIONS[this.index].name;
  }

  objective() {
    if (this.done) return 'Free roam — Solmar Bay is yours, Lena.';
    const w = this.world;
    switch (this.index) {
      case 0:
        return this.stage === 0
          ? 'Steal a car (walk up to a parked car and press E)'
          : 'Deliver the car to Rosa\'s Garage — undamaged pays a bonus';
      case 1:
        return `Deliver the package car to the Pelican Diner — ${Math.ceil(this.timer)}s left`;
      case 2:
        return `Clear the plaza: ${w.thugsAlive()} thugs left`;
      case 3:
        return this.farePed
          ? `Fare ${this.fare + 1}/3: pick up the passenger (drive close)`
          : `Fare ${this.fare + 1}/3: drop the passenger at the marker`;
      case 4:
        return 'Take down Vic Marino and his crew at Meridian Tower';
      default:
        return '';
    }
  }

  start() {
    this.started = true;
    this.stage = 0;
    this.timer = 0;
    this.fare = 0;
    this.clearFarePed();
    const w = this.world;
    if (this.index === 0) {
      w.toast('Mission: Hot Wheels — steal a car');
      w.clearBeacon();
    } else if (this.index === 1) {
      w.spawnMissionCar('sedan', w.city.hideout.x + 6, w.city.hideout.z);
      this.timer = 75;
      w.setBeacon(w.city.diner.x, w.city.diner.z, 0x7ae0ff);
      w.toast('Mission: Pelican Special — 75 seconds, do not be late');
    } else if (this.index === 2) {
      const p = w.city.plaza;
      w.spawnThugs([
        { x: p.x - 6, z: p.z - 4 },
        { x: p.x + 6, z: p.z - 4 },
        { x: p.x - 6, z: p.z + 5 },
        { x: p.x + 6, z: p.z + 5 },
      ]);
      w.setBeacon(p.x, p.z, 0xff5a5a);
      w.toast('Mission: Plaza Brawl — clear the plaza');
    } else if (this.index === 3) {
      this.nextFare();
      w.toast('Mission: Night Shift — three fares, good tips');
    } else if (this.index === 4) {
      const t = w.city.tower;
      w.spawnThugs([
        { x: t.x, z: t.z + 18, boss: true, name: 'Vic Marino' },
        { x: t.x - 8, z: t.z + 14 },
        { x: t.x + 8, z: t.z + 14 },
        { x: t.x - 12, z: t.z + 20 },
        { x: t.x + 12, z: t.z + 20 },
        { x: t.x - 4, z: t.z + 24 },
        { x: t.x + 4, z: t.z + 24 },
      ]);
      w.setBeacon(t.x, t.z + 18, 0xff2a2a);
      w.toast('Mission: Kingfish Down — end Vic Marino');
    }
  }

  nextFare() {
    const w = this.world;
    this.clearFarePed();
    const spots = [
      { x: -88, z: 44 }, { x: 88, z: -44 }, { x: 0, z: 132 },
      { x: -132, z: -88 }, { x: 132, z: 88 }, { x: 44, z: -132 },
    ];
    const pick = spots[this.rng.int(0, spots.length - 1)];
    const mesh = makePersonMesh(0xffd27a, { skin: 0xd8a878 });
    mesh.position.set(pick.x, 0, pick.z);
    w.scene.add(mesh);
    this.farePed = { mesh, x: pick.x, z: pick.z };
    const dests = [
      { x: w.city.casino.x, z: w.city.casino.z },
      { x: w.city.diner.x, z: w.city.diner.z },
      { x: w.city.beach.x, z: w.city.beach.z },
      { x: w.city.park.x, z: w.city.park.z },
    ];
    this.fareDest = dests[this.rng.int(0, dests.length - 1)];
    w.setBeacon(pick.x, pick.z, 0xffd27a);
  }

  clearFarePed() {
    if (this.farePed) {
      this.world.scene.remove(this.farePed.mesh);
      this.farePed = null;
    }
  }

  reset() {
    this.clearFarePed();
    this.world.clearThugs();
    this.world.clearBeacon();
    this.started = false;
    this.start();
  }

  complete(payout, note) {
    const w = this.world;
    w.addCash(payout);
    w.clearBeacon();
    w.clearThugs();
    this.clearFarePed();
    const paid = payout > 0 ? ` — $${payout}` : '';
    w.toast(`Mission complete: ${MISSIONS[this.index].name}${paid}${note ? ` (${note})` : ''}`);
    w.onMissionComplete(this.index);
    this.index += 1;
    this.started = false;
    if (!this.done) this.start();
    else w.toast('Story complete — Solmar Bay is yours!');
  }

  update(dt) {
    if (!this.started || this.done) return;
    const w = this.world;
    const hero = w.heroPos();
    const car = w.playerCar();
    if (this.index === 0) {
      if (this.stage === 0 && car) {
        this.stage = 1;
        w.setBeacon(w.city.garage.x, w.city.garage.z, 0xffd27a);
        w.toast('Now deliver it to Rosa\'s Garage');
      } else if (this.stage === 1 && car) {
        const g = w.city.garage;
        const d = Math.hypot(car.mesh.position.x - g.x, car.mesh.position.z - g.z);
        if (d < 11) {
          const undamaged = car.damage <= 0;
          this.complete(350 + (undamaged ? 150 : 0), undamaged ? 'undamaged bonus' : 'car was damaged');
        }
      }
    } else if (this.index === 1) {
      this.timer -= dt;
      if (this.timer <= 0) {
        w.toast('Too slow — the package went cold. Try again.');
        this.reset();
        return;
      }
      if (car) {
        const d = w.city.diner;
        const dist = Math.hypot(car.mesh.position.x - d.x, car.mesh.position.z - d.z);
        if (dist < 11) this.complete(550);
      }
    } else if (this.index === 2) {
      if (w.thugsAlive() === 0) this.complete(450);
    } else if (this.index === 3) {
      if (this.farePed) {
        const d = Math.hypot(hero.x - this.farePed.x, hero.z - this.farePed.z);
        if (car && d < 5) {
          w.scene.remove(this.farePed.mesh);
          this.farePed = null;
          w.setBeacon(this.fareDest.x, this.fareDest.z, 0x7ae0ff);
          w.toast('Passenger aboard — take them to the marker');
        }
      } else if (car) {
        const d = Math.hypot(car.mesh.position.x - this.fareDest.x, car.mesh.position.z - this.fareDest.z);
        if (d < 7) {
          w.addCash(250);
          w.toast(`Fare done — $250 (fare ${this.fare + 1}/3)`);
          this.fare += 1;
          if (this.fare >= 3) {
            this.complete(0, 'all fares done');
          } else {
            this.nextFare();
          }
        }
      }
    } else if (this.index === 4) {
      const boss = w.findBoss();
      if (boss && boss.down) this.complete(5000);
    }
  }
}
