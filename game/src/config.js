// Solmar Bay — tuning, palette and city constants. All original.
(function () {
  'use strict';
  window.SB = window.SB || {};
  SB.CFG = {
    seed: 1337,
    // city grid
    block: 64,          // building block side (units)
    road: 16,           // road width
    pitch: 80,          // block + road
    halfBlocks: 4,      // blocks from centre to edge: city spans -4..+4 blocks
    cityHalf: 4 * 80 + 32, // ~352: half-width of the drivable city
    // player on foot
    walkSpeed: 9,
    runSpeed: 14,
    playerRadius: 1.1,
    playerHealth: 100,
    // car
    carAccel: 26,
    carBrake: 40,
    carMaxSpeed: 46,    // ~100 mph feel
    carMaxReverse: 14,
    carTurn: 1.9,
    carRadius: 2.2,
    // combat
    punchDamage: 25,
    punchRange: 2.6,
    gunDamage: 34,
    gunRange: 90,
    gunAmmoStart: 24,
    // wanted
    wantedDecayDist: 70,   // no cop within this for decay
    wantedDecayTime: 9,    // seconds unseen to drop a star
    bustDist: 2.4,
    bustTime: 1.6,
    // economy
    startMoney: 150,
    bustFine: 200,
    wastedFine: 150,
    // missions
    missionRewards: [300, 500, 400, 600, 5000],
    // traffic / peds
    trafficCars: 14,
    peds: 22,
    pedSpeed: 2.2,
    trafficSpeed: 13,
    // world
    dayLength: 1, // fixed warm afternoon; lighting does not cycle
  };
  SB.PALETTE = {
    sky: 0x87b5e0, fog: 0x9fc3e8,
    ground: 0x3a3f46, sidewalk: 0x8d9299, roadLine: 0xf5d76e,
    grass: 0x4f8f3a, sand: 0xe0c98f, water: 0x1e6f9e,
    building: [0x9a7b5f, 0x7f8ea3, 0xa39a7f, 0x6f7f8a, 0xb08a6a, 0x8a6f8a, 0x5f7f6f, 0xc0a080],
    roof: [0x4a3f35, 0x5a5a5a, 0x3f4a3f],
    car: [0xd23c2e, 0x2e6fd2, 0xe8c832, 0x3ac06a, 0xe8e8e8, 0x222222, 0x8a4fd2, 0xe07b2e],
    police: 0x1a2a4a, policeLight: 0xff2d2d,
    playerShirt: 0xffe14d, playerPants: 0x2a3a5a, playerSkin: 0xc98a5a,
    pedShirt: [0xd26a6a, 0x6ad28a, 0x6a8ad2, 0xd2c06a, 0xb06ad2, 0x6ad2c8, 0xe8e8e8, 0x444444],
  };
})();
