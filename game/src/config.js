// Solmar Bay — tuning, palette, and city constants (rebuild r2).
// Every number below was re-tuned for the rebuild: faster on-foot sprint,
// heavier cars, tougher boss, foot cops, car damage, and a dusk cycle.
(function () {
  'use strict';
  window.SB = window.SB || {};

  // --- gameplay tuning -------------------------------------------------------
  const CFG = {
    seed: 1337,
    // city grid
    block: 64,          // building block side (units)
    road: 16,           // road width
    pitch: 80,          // block + road
    halfBlocks: 4,      // blocks from centre to edge: city spans -4..+4
    cityHalf: 4 * 80 + 32, // ~352: half-width of the drivable city
    // player on foot
    walkSpeed: 9,
    runSpeed: 15,
    playerRadius: 1.1,
    playerHealth: 100,
    // car
    carAccel: 28,
    carBrake: 42,
    carMaxSpeed: 48,    // ~105 mph feel
    carMaxReverse: 15,
    carTurn: 2.0,
    carRadius: 2.2,
    carMaxDamage: 100,  // car health; smoke below 40, limp below 20
    repairCost: 150,    // Chop Shop full repair
    // combat
    punchDamage: 25,
    punchRange: 2.6,
    gunDamage: 34,
    gunRange: 90,
    gunAmmoStart: 24,
    bossHp: 250,
    // wanted + police
    wantedDecayDist: 70,   // no cop within this for decay
    wantedDecayTime: 9,    // seconds unseen to drop a star
    bustDist: 2.4,
    bustTime: 1.6,
    footCopSpeed: 6.4,     // foot cops run the player down on foot
    footCopPunch: 8,
    // economy
    startMoney: 150,
    bustFine: 200,
    wastedFine: 150,
    coinValue: 50,         // neon coins hidden around the city
    coinsTotal: 10,
    undamagedBonus: 100,   // mission 1 bonus for a scratch-free delivery
    // missions
    missionRewards: [300, 500, 400, 600, 5000],
    // traffic / peds
    trafficCars: 16,
    peds: 26,
    pedSpeed: 2.2,
    trafficSpeed: 13,
    honkDist: 12,          // traffic honks at a stopped car ahead
    // world / sky
    duskCycle: 240,        // seconds for a full afternoon -> dusk sweep
    dayLength: 240,
  };

  // --- palette ---------------------------------------------------------------
  const PALETTE = {
    sky: 0x87b5e0, skyDusk: 0xe08a5a, fog: 0x9fc3e8, fogDusk: 0xd89a72,
    ground: 0x3a3f46, sidewalk: 0x8d9299, roadLine: 0xf5d76e,
    grass: 0x4f8f3a, sand: 0xe0c98f, water: 0x1e6f9e,
    building: [0x9a7b5f, 0x7f8ea3, 0xa39a7f, 0x6f7f8a, 0xb08a6a, 0x8a6f8a, 0x5f7f6f, 0xc0a080],
    roof: [0x4a3f35, 0x5a5a5a, 0x3f4a3f],
    car: [0xd23c2e, 0x2e6fd2, 0xe8c832, 0x3ac06a, 0xe8e8e8, 0x222222, 0x8a4fd2, 0xe07b2e],
    police: 0x1a2a4a, policeLight: 0xff2d2d,
    playerShirt: 0xffe14d, playerPants: 0x2a3a5a, playerSkin: 0xc98a5a,
    pedShirt: [0xd26a6a, 0x6ad28a, 0x6a8ad2, 0xd2c06a, 0xb06ad2, 0x6ad2c8, 0xe8e8e8, 0x444444],
    coin: 0xffe14d,
    trafficLight: { red: 0xff2d2d, amber: 0xffb02d, green: 0x37d67a },
  };

  SB.CFG = CFG;
  SB.PALETTE = PALETTE;
})();
