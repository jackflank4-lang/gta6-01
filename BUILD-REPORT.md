# Solmar Bay — Neon Heat · BUILD REPORT (rebuild r2)

Rebuilt from scratch under a fresh make.fun recording after the v1
recording died unsealed. Same game, same story — every counted file
rewritten in-session with real changes, and two mission-blocking bugs
found and fixed during verification (see below).

## What it is

A 3D open-world crime game in the spirit of GTA 6, playable offline in a
desktop browser from static files (`game/index.html`). You are Dax Marlowe,
back in the fictional coastal city of Solmar Bay with empty pockets and a
debt to the Kingfish crew. 5 story missions, then free roam.

## What changed vs v1

- **Foot cops** — 1 per wanted star (max 4) spawn while you are on foot,
  chase you, punch (8 dmg), and can corner you into a bust. Wanted level
  no longer decays while a foot cop is alive.
- **Car damage + Chop Shop repair** — crashes dent your car (0–100).
  Past 60 the car smokes and limps; past 85 it crawls. Hold H at the
  Chop Shop to repair at $1.50 per point. Damage bar on the HUD.
- **Traffic that honks and overtakes** — a car stuck behind a slow car
  honks, then pulls out to overtake; the lead car is no longer pushed
  through intersections.
- **Neon coins** — 10 collectibles around the city, $50 each, shown as
  gold dots on the minimap and counted in the HUD.
- **Boss reinforcements** — in mission 5 the Kingfish boss calls 2 more
  thugs at half health, and the wanted level rises by 2.
- **Mission 1 undamaged bonus** — deliver the car to the Chop Shop
  undamaged for +$100 on top of the $300.
- **Three camera modes** — C cycles FOLLOW / SHOULDER / HIGH; mouse wheel
  zooms. Shoulder mode re-aims the crosshair when you shoot.
- **Two-track radio** — N switches between "Neon Drive" and "Kingfish
  Blues". All sound is synthesised WebAudio (engine hum, sirens, horns,
  gunshots, punches, coins, repair).
- **Dusk clock** — the HUD shows the time drifting 3:00 PM → 7:00 PM as
  the sun sets; the sky and lighting follow.
- **City** — paved plazas, traffic lights that cycle, neon billboards on
  Neon Row, a boardwalk, and a helipad on Kingfish Tower.
- **Save** now also stores coins collected and the camera mode.
- **Mission 5 beacon** moved to the tower front so the yellow column is
  visible instead of hidden inside the building.

## Files

- `game/` — the game: `index.html` + `src/` (config, seeded RNG, input,
  synthesised sound, procedural city, three.js renderer, world rules,
  main loop) + `vendor/three.min.js` (three.js r158, vendored).
- `main.ts` — entrypoint: copies `game/` and `screenshots/` to `/output`
  and writes `/output/dossier.json` via the vendored make.fun library.
- `screenshots/` — 4 real renders of the rebuilt game (title, driving,
  police chase, tower finale), staged by `?shot=` scenes.
- `shots.json` — how each screenshot was staged.
- `.makefun/owner.json` — the owner's wallet for this entry.

## Verification (headless Chrome 157, SwiftShader, seed 1337)

All runs: **zero console errors, zero page exceptions.**

- Screenshots: all 4 are real renders of the rebuilt game. Chase frame
  shows 2 cruisers ramming the player car (damage 82, smoke, CAR 27%),
  3 gold stars, "WANTED — LOSE THE COPS". Mission frame shows the
  beacon, 6 thugs and Dax at the tower.
- Play-test (menu → start → walk → steal car → drive → damage → repair
  → exit → camera/radio → wanted → punch → shoot → mission 5 → pause):
  walk moved the player; entering a parked car advanced mission 1;
  driving reached 16.8 u/s; `damageCar` set 40; holding H at the Chop
  Shop repaired 46 → 34 for $17 ($1.50/point); C cycled
  FOLLOW → SHOULDER → HIGH; N switched the track to KINGFISH BLUES;
  wanted 2 spawned 3 police cars + 2 foot cops; 2 punches took a foot
  cop 80 → 55 hp; shooting spent 1 ammo; damaging the boss (250 → 50)
  triggered +2 reinforcement thugs (6 → 8); P paused and resumed.
- Busted flow: cornered by foot cops → BUSTED screen, fine taken
  ($133 of $133), respawn at the Hideout with full health.
- **Bugs found by testing and fixed:**
  - Mission 1 could never complete: a car can only close to ~11 of the
    Chop Shop centre (building collision) but the radius was 10.
    Radius widened to 16. Re-tested: undamaged delivery pays
    $150 → $550 and starts mission 2 with 3 thugs at the docks.
  - Mission 4 pickup could never trigger: on foot you stop ~10 from
    the Diner centre but the radius was 8. Radius widened to 14.
    Re-tested: pickup advances the stage, 90 s timer starts, pier
    delivery pays +$600 and starts mission 5.
  - Approach distances were measured with the game's own collision
    code (16 angles, foot + car) for every landmark before choosing
    the new radii.
- Save/load: `save()` writes `solmarbay.save.v1` (money, health, ammo,
  mission, position, coins, camera mode); `load()` returns it —
  verified with $600 after The Drop. A loaded save also resumes the
  menu note, mission, thugs and camera mode.
- `MAKEFUN_OUTPUT_DIR=/tmp/gta6-out node main.ts` produces `/output`
  with `game/`, `screenshots/` and `dossier.json`.

## Known quirks

- Headless SwiftShader renders at ~10 fps, so in the capture the game
  clock runs at roughly half real time; on a real machine it runs at
  full speed. The repair rate is per-frame, so it looks slow in the
  headless test — it is ~40 points/s at 60 fps.
- The chase screenshot's police cars spawn 70–110 units away and are
  slower than a car at full speed, so the shot stages two cruisers
  oncoming ahead of the player and one alongside.
- Deterministic: same seed → same city, traffic, and mission layout.
  `?seed=` overrides the seed; `?shot=` stages a screenshot scene.
