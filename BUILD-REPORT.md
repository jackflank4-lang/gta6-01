# Solmar Bay — Neon Heat · BUILD REPORT (rebuild r3)

Rebuilt from scratch under a fresh make.fun recording after the v1
recording died unsealed and the v2 seal failed on a chunk mismatch.
Same game, same story — every counted file rewritten in-session with
real changes, and the title screen fixed so it fits a 720p frame.

## What it is

A 3D open-world crime game in the spirit of GTA 6, playable offline in a
desktop browser from static files (`game/index.html`). You are Dax Marlowe,
back in the fictional coastal city of Solmar Bay with empty pockets and a
debt to the Kingfish crew. 5 story missions, then free roam.

## What changed vs v2

- **Jump** — SPACE on foot now launches Dax with real gravity (jump
  speed 9.5, gravity 26); the renderer lifts the player mesh by `p.y`.
  SPACE in a car is still the handbrake.
- **Car horn** — H while driving honks a two-tone horn; traffic ahead
  speeds up for 2 seconds and nearby pedestrians jump aside. H at the
  Chop Shop still repairs (hold to repair, tap to honk).
- **Headlights** — L toggles a real spotlight beam on the player's car,
  saved with the save file. The HUD hint line teaches the new keys.
- **Third radio track** — N now cycles NEON DRIVE / KINGFISH BLUES /
  SUNSET CRUISE (a slower groove with a detuned lead line).
- **Casino Royale** — a seventh landmark (plot 0,-4, magenta rooftop
  sign), marked on the minimap; a health pickup sits outside it.
- **Marina** — five boats bob in the water south of the beach, marked as
  white dots on the minimap.
- **New seed 2026** — the procedural city lays out differently (xorshift32
  RNG replaces mulberry32; djb2 string hash; Box-Muller gaussian).
- **Retune** — faster feet (10/16) and cars (52 top), 12 neon coins at
  $40 each, mission rewards $350/$550/$450/$650/$5,000, undamaged bonus
  $150, boss 300 HP, start money $200, 30 starting ammo, 18 traffic cars,
  30 peds, dusk cycle 300 s, pinker dusk sky.
- **Coins are octahedron gems** now (spinning, bobbing), not torus rings.
- **Title screen** — pink/teal menu, smaller type so the whole menu fits
  a 720p frame without clipping the title.
- **Kept from v2**: Chop Shop radius 16 and diner pickup radius 14
  (both measured against building collision — the v2 bugfixes).

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

## Verification (headless Chrome 157, SwiftShader, seed 2026 / shot seed 1337)

All runs: **zero console errors, zero page exceptions.**

- Screenshots (viewed): 1-title menu, pink title, full controls list
  with the new keys, START ENGINE button; 2-drive east through the city
  (HUD complete: money, health, CAR 100%, COINS 0/12 · 3:00 PM, mission
  banner, minimap, 54 MPH); 3-chase with a cruiser ramming the player car
  (CAR 61%, 3 gold stars, "WANTED — LOSE THE COPS", second cruiser ahead);
  4-mission finale with beacon, 6 thugs, Dax at the tower.
- Play-test (menu → start → walk → jump → steal car → drive → horn →
  headlights → mission 1 → wanted → punch → mission 4 → mission 5 →
  pause/resume): walk moved the player (speed 10); jump left the ground
  (y 0.41 mid-air, grounded false, then landed); entering a parked car
  advanced mission 1 to stage 1; driving reached speed 12 (headless
  ~10 fps, and the parked car sat off-road against a building); H honked;
  L turned the headlights on; delivering the undamaged car to the Chop
  Shop paid $200 → $700 ($350 reward + $150 undamaged bonus, +30 ammo)
  and started mission 2; wanted 2 spawned 3 police cars + 2 foot cops on
  exit; one punch took a foot cop 80 → 52 hp; reaching the Diner started
  mission 4 stage 1 with the 90 s timer (radius 14 works); mission 5
  staging put 6 thugs at the tower and one shot spent 1 ammo (60 → 59);
  P paused and resumed (verified with dispatched key events — the
  synthetic `__game.press` helper cannot fire the window keydown
  listener, so pause was checked with `window.dispatchEvent`); C cycled
  FOLLOW → SHOULDER; N switched NEON DRIVE → KINGFISH BLUES.
- Save/load: `save()` writes `solmarbay.save.v1` (money, health, ammo,
  mission, position, coins, camera mode, headlights); `load()` returns
  it — headlights state is now stored too.
- `MAKEFUN_OUTPUT_DIR=/tmp/gta6-out-r3 node main.ts` produces `/output`
  with `game/`, `screenshots/` and `dossier.json` (597,261 B).

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
