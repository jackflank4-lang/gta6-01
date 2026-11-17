// Solmar Bay — tuning, palette and city constants (rebuild r3).
// Re-tuned for the third build: a new seed (2026) so the procedural city
// lays out differently, faster feet and cars, a jump, car horns, headlights,
// 12 neon coins, a third radio track, and a tougher Kingfish boss.
(function () {
  'use strict';
  window.SB = window.SB || {};

  // --- gameplay tuning -------------------------------------------------------
  const CFG = {
    seed: 2026,
    // city grid
    block: 64,          // building block side (units)
    road: 16,           // road width
    pitch: 80,          // block + road
    halfBlocks: 4,      // blocks from centre to edge: city spans -4..+4
    cityHalf: 4 * 80 + 32, // ~352: half-width of the drivable city
    // player on foot
    walkSpeed: 10,
    runSpeed: 16,
    jumpSpeed: 9.5,     // on-foot jump (SPACE), vertical velocity
    gravity: 26,        // pulls a jumping player back down
    playerRadius: 1.1,
    playerHealth: 100,
    // car
    carAccel: 30,
    carBrake: 46,
    carMaxSpeed: 52,    // ~115 mph feel
    carMaxReverse: 16,
    carTurn: 2.1,
    carRadius: 2.2,
    carMaxDamage: 100,  // car health; smoke below 40, limp below 20
    repairCost: 150,    // Chop Shop full repair
    hornRange: 30,      // honking startles traffic ahead within this range
    // combat
    punchDamage: 28,
    punchRange: 2.6,
    gunDamage: 36,
    gunRange: 90,
    gunAmmoStart: 30,
    bossHp: 300,
    // wanted + police
    wantedDecayDist: 70,   // no cop within this for decay
    wantedDecayTime: 9,    // seconds unseen to drop a star
    bustDist: 2.4,
    bustTime: 1.6,
    footCopSpeed: 6.8,     // foot cops run the player down on foot
    footCopPunch: 8,
    // economy
    startMoney: 200,
    bustFine: 250,
    wastedFine: 150,
    coinValue: 40,         // neon coins hidden around the city
    coinsTotal: 12,
    undamagedBonus: 150,   // mission 1 bonus for a scratch-free delivery
    // missions
    missionRewards: [350, 550, 450, 650, 5000],
    // traffic / peds
    trafficCars: 18,
    peds: 30,
    pedSpeed: 2.4,
    trafficSpeed: 14,
    honkDist: 12,          // traffic honks at a stopped car ahead
    // world / sky
    duskCycle: 300,        // seconds for a full afternoon -> dusk sweep
    dayLength: 300,
  };

  // --- palette ---------------------------------------------------------------
  // Warmer sunset than the last build: pink dusk, teal water, brighter neon.
  const PALETTE = {
    sky: 0x8fb8e8, skyDusk: 0xff7e5f, fog: 0xa8c6ea, fogDusk: 0xe08a6a,
    ground: 0x3a3f46, sidewalk: 0x93989f, roadLine: 0xffd76e,
    grass: 0x558f3e, sand: 0xe6cf95, water: 0x1a6f8e,
    building: [0xa67b5f, 0x7f9aa3, 0xa89a7f, 0x7f8a9a, 0xc08a6a, 0x9a6f9a, 0x6f8f7f, 0xc8a878, 0x5f7f9f],
    roof: [0x3f3833, 0x555555, 0x39443f],
    car: [0xe04030, 0x2e7fd2, 0xf0d832, 0x40c06a, 0xf0f0f0, 0x2a2a2a, 0x9a4fd2, 0xf08b2e, 0x2ed2c8],
    police: 0x16223e, policeLight: 0xff2d2d,
    playerShirt: 0xffd23c, playerPants: 0x2a3a5a, playerSkin: 0xd08a5a,
    pedShirt: [0xe06a6a, 0x6ad28a, 0x6a9ad2, 0xd2c06a, 0xc06ad2, 0x6ad2c8, 0xf0f0f0, 0x555555],
    coin: 0xffd23c,
    trafficLight: { red: 0xff2d2d, amber: 0xffb02d, green: 0x37d67a },
    casino: 0x7a2a5a,
  };

  SB.CFG = CFG;
  SB.PALETTE = PALETTE;
})();
