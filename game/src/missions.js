// The story of Solmar Bay: Lena Cruz, a driver fresh out of the county lockup,
// owes the Barracudas nothing and wants everything. Five missions take her from
// a stolen sedan to the top of the Meridian Tower, where Vic Marino waits.
// The director is a small state machine: each mission is a list of stages, and
// a stage is done when the player reaches its beacon, steals a car, or takes
// down the thugs it names. The engine reads the current objective and beacon
// every frame for the HUD and the minimap.

const MISSION_PAY = [350, 550, 450, 750, 5000];

export class Missions {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.stage = 0;
    this.timer = 0;
    this.done = false;
    this.allDone = false;
    this.killTarget = 0;
    this.killCount = 0;
    this.undamagedBonus = 0;
    this.fares = [];
    this.fareIndex = 0;
  }

  get current() {
    return MISSIONS[this.index];
  }

  get title() {
    return this.allDone ? 'FREE ROAM' : MISSIONS[this.index].title;
  }

  start() {
    this.index = 0;
    this.stage = 0;
    this.done = false;
    this.allDone = false;
    this.enterStage();
  }

  enterStage() {
    const mission = MISSIONS[this.index];
    const stage = mission.stages[this.stage];
    this.timer = stage.time || 0;
    if (stage.spawnThugs) {
      this.killTarget = stage.spawnThugs.count;
      this.killCount = 0;
      this.world.spawnThugs(stage.spawnThugs.at, stage.spawnThugs.count, stage.spawnThugs.boss);
    }
    if (stage.fares) {
      this.fares = stage.fares;
      this.fareIndex = 0;
    }
    if (stage.kind === 'steal') this.undamagedBonus = 0;
  }

  objectiveText() {
    if (this.allDone) return 'Story complete — Solmar Bay is yours. Free roam, collect coins, cause chaos.';
    const stage = MISSIONS[this.index].stages[this.stage];
    if (stage.kind === 'fare') {
      const fare = this.fares[this.fareIndex];
      return fare.picked
        ? `Drop ${fare.name} off at ${fare.toName} — $${fare.pay}`
        : `Pick up ${fare.name} at ${fare.fromName}`;
    }
    if (stage.kind === 'kill') {
      return `${stage.text} — ${this.killCount}/${this.killTarget} down`;
    }
    if (this.timer > 0) return `${stage.text} — ${Math.ceil(this.timer)}s left`;
    return stage.text;
  }

  beaconPos() {
    if (this.allDone) return null;
    const stage = MISSIONS[this.index].stages[this.stage];
    if (stage.kind === 'fare') {
      const fare = this.fares[this.fareIndex];
      return fare.picked ? fare.to : fare.from;
    }
    if (stage.kind === 'kill') return stage.at;
    return stage.at || null;
  }

  onKill() {
    this.killCount += 1;
  }

  onSteal() {
    const stage = MISSIONS[this.index].stages[this.stage];
    if (stage && stage.kind === 'steal') this.advance();
  }

  update(dt) {
    if (this.allDone || this.done) return;
    const mission = MISSIONS[this.index];
    const stage = mission.stages[this.stage];
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        // Timed stages fail soft: back to the mission's first stage, no fine.
        this.world.toast('Too slow — try that one again');
        this.stage = 0;
        this.enterStage();
        return;
      }
    }
    if (stage.kind === 'kill') {
      if (this.killCount >= this.killTarget) this.advance();
      return;
    }
    if (stage.kind === 'steal') return; // advanced by onSteal()
    if (stage.kind === 'fare') {
      const fare = this.fares[this.fareIndex];
      const target = fare.picked ? fare.to : fare.from;
      const pos = this.world.playerFootPos();
      const d = Math.hypot(target.x - pos.x, target.z - pos.z);
      if (d < (stage.radius || 8)) {
        if (!fare.picked) {
          fare.picked = true;
          this.world.toast(`${fare.name} is in — drive them to ${fare.toName}`);
          this.world.sound.pickup();
        } else {
          this.world.addCash(fare.pay);
          this.world.toast(`Fare complete — +$${fare.pay}`);
          this.world.sound.coin();
          this.fareIndex += 1;
          if (this.fareIndex >= this.fares.length) this.advance();
        }
      }
      return;
    }
    // Plain reach stage: arrive at the beacon.
    const pos = this.world.playerFootPos();
    const d = Math.hypot(stage.at.x - pos.x, stage.at.z - pos.z);
    if (d < (stage.radius || 9)) this.advance();
  }

  advance() {
    const mission = MISSIONS[this.index];
    this.stage += 1;
    if (this.stage >= mission.stages.length) {
      // Mission complete: pay out, with an undamaged bonus on the first job.
      let pay = MISSION_PAY[this.index];
      if (this.index === 0 && this.world.carDamage() <= 20) {
        pay += 150;
        this.world.toast('Undamaged delivery — +$150 bonus');
      }
      this.world.addCash(pay);
      this.world.sound.missionDone();
      this.world.toast(`${mission.title} complete — +$${pay}`);
      this.index += 1;
      this.stage = 0;
      if (this.index >= MISSIONS.length) {
        this.allDone = true;
        this.world.toast('STORY COMPLETE — Lena Cruz owns Solmar Bay');
        return;
      }
      this.world.toast(`New mission: ${MISSIONS[this.index].title}`);
      this.enterStage();
      return;
    }
    this.enterStage();
  }
}

// The five jobs. Positions are filled in by the engine at boot, once the
// city exists — see bindPlaces() below.
const MISSIONS = [
  {
    title: 'Grand Theft, Baby',
    stages: [
      { kind: 'steal', text: 'Steal any car — walk up to one and press E' },
      { kind: 'reach', text: 'Deliver the car to Rosa\'s Garage', at: null, radius: 10 },
    ],
  },
  {
    title: 'Pelican Special',
    stages: [
      { kind: 'reach', text: 'Pick up the package at the Pelican Diner', at: null, radius: 8 },
      { kind: 'reach', text: 'Deliver it to the Marina dock — fast', at: null, radius: 9, time: 75 },
    ],
  },
  {
    title: 'Vipers in the Plaza',
    stages: [
      { kind: 'kill', text: 'Take down the Barracuda thugs in the plaza', at: null, spawnThugs: { count: 4, boss: false } },
    ],
  },
  {
    title: 'Night Fare',
    stages: [
      {
        kind: 'fare', text: 'Night fares — pick up and drop off',
        fares: [
          { name: 'Milo', fromName: 'the hotel', toName: 'the Luna Casino', from: null, to: null, pay: 250 },
          { name: 'Ada', fromName: 'the casino', toName: 'the Meridian Tower', from: null, to: null, pay: 250 },
          { name: 'Rosa', fromName: 'the tower', toName: 'the marina', from: null, to: null, pay: 250 },
        ],
      },
    ],
  },
  {
    title: 'King of the Bay',
    stages: [
      { kind: 'kill', text: 'Take down Vic Marino and his crew at the tower', at: null, spawnThugs: { count: 7, boss: true } },
      { kind: 'reach', text: 'Escape to the hideout — it is over', at: null, radius: 10 },
    ],
  },
];

// Fill the null positions from the city's named places. Called once by the
// engine after the city is built.
export function bindPlaces(missions, city) {
  const at = (place) => ({ x: place.x, z: place.z });
  MISSIONS[0].stages[1].at = at(city.garage);
  MISSIONS[1].stages[0].at = at(city.diner);
  MISSIONS[1].stages[1].at = at(city.marina);
  MISSIONS[2].stages[0].at = at(city.plaza);
  MISSIONS[2].stages[0].spawnThugs.at = at(city.plaza);
  MISSIONS[3].stages[0].fares[0].from = at(city.diner);
  MISSIONS[3].stages[0].fares[0].to = at(city.casino);
  MISSIONS[3].stages[0].fares[1].from = at(city.casino);
  MISSIONS[3].stages[0].fares[1].to = at(city.tower);
  MISSIONS[3].stages[0].fares[2].from = at(city.tower);
  MISSIONS[3].stages[0].fares[2].to = at(city.marina);
  MISSIONS[4].stages[0].at = at(city.tower);
  MISSIONS[4].stages[0].spawnThugs.at = at(city.tower);
  MISSIONS[4].stages[1].at = at(city.hideout);
}
