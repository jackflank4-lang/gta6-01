# Solmar Bay — Neon Heat: BUILD REPORT (v5, round 2)

Rebuilt from scratch for make.fun bounty **gta6-01 round 2** (recording r5,
`01a1ea99-0fdd-751f-a4eb-fba3a65ede09`). Round 1 was rejected on
`thinking_reproduces` (12.1% authored — the builder had read the old code
and rewritten it) and `transcripts_witnessed` (shots.json never touched).
Round 2 (v4) was rebuilt from scratch and verified, but its recorder died
mid-build, so the seal could not attach the builder's usage row and the
recording can never seal. This version was written entirely from the
builder's own design, from a prose brief only — no file under `gta6-01/`
was opened, read, or copied. Every counted file (main.ts,
game/index.html, game/src/*.js, README.md, shots.json,
.makefun/owner.json) was written fresh in-session. LICENSE, serve.ts,
vendor/makefun-game.ts, and game/vendor/three.min.js were left exactly
as they are.

## What was built

An open-world 3D crime game in Solmar Bay, starring Lena Cruz and the
Barracuda crew vs. Vic Marino. Three.js (vendored UMD) renders a dusk
city: an 8×8 block grid (30 m blocks, 14 m roads), a bay with a beach
and marina, a park, a plaza with a fountain, and landmarks — Meridian
Tower (92 m + beacon), Luna Casino, Rosa's Garage, Pelican Diner, and
the crew hideout. Seeded RNG (seed 777) drives the layout, traffic,
and pedestrians.

| File | Lines | What it does |
|---|---|---|
| main.ts | 76 | Copies game/ + screenshots/ to /output, validates screenshots, writes dossier.json |
| game/index.html | 91 | Canvas + full HUD DOM (cash, HP, stars, clock, speed, objective, toast, minimap, menus) |
| game/src/rng.js | 57 | SplitMix32 Rng (next/range/int/pick/chance/gauss/shuffle) + hashSeed |
| game/src/input.js | 77 | Keyboard (code-based, edge + held) and mouse-drag camera |
| game/src/audio.js | 242 | WebAudio synth only: engine, siren, shots, horn, crashes, 3 original radio tracks |
| game/src/city.js | 357 | Grid, ground texture, buildings with lit windows, landmarks, marina, lights, colliders |
| game/src/vehicles.js | 287 | Car meshes, traffic AI (14 cars, red-light stops), police pursuit, arcade car handling |
| game/src/people.js | 214 | Pedestrians (22, flee), hero/thug/boss figures, thug combat AI |
| game/src/missions.js | 217 | 5 story missions: steal + deliver, timed delivery, 4-thug fight, 3 fares, boss finale |
| game/src/hud.js | 186 | Cash/HP/stars/clock/speed/objective/toast, circular minimap, menus, save notes |
| game/src/engine.js | 741 | Renderer, state machine, wanted system, combat, coins, beacon, save/load, debug hooks |
| game/src/shots.js | 44 | Deterministic staging for the 4 screenshots |
| game/src/main.js | 41 | Bootstrap, error collection into window.__errors, ?shot= staging |
| README.md + shots.json | — | Player guide + the 4 screenshot descriptors |

**Counted total: 2,694 lines** (main.ts + index.html + game/src/*.js +
README.md + shots.json), all authored in this session.

Systems: walk/drive, car theft (+1 wanted), police pursuit (up to 4
cruisers, ramming, foot cops → busted), 5 missions with payouts
($350/$550/$450/$750/$5000 + $150 undamaged bonus on mission 1), combat
(punch thugs/cops, thugs fight back, boss 300 HP), 12 coins ($40),
wanted decay, 3 camera modes, headlights/horn/radio, day clock,
autosave every 30 s + on pause/mission complete, localStorage save/load,
and `?fx=low` (no shadows/antialiasing) for weak machines.

## Verification (all in headless Chrome 157, SwiftShader, file://)

Zero console errors and zero page exceptions in every run. The software
renderer runs ~2 fps at 720p with shadows and ~0.4 game-seconds per real
second at 800×450 low-fx, so the test driver uses long key holds and
settles; screenshot staging holds the car at cruise speed so staged
scenes stay composed.

**Full play-test (CDP driver, `cdp-r4.mjs playtest`):**
- Boot: WebGL true, 0 errors. Menu → START → playing, mission 1, $200, 100 HP.
- Walk: hero moved 6 m on W. Steal (E): inCar, wanted 1, 2 police cruisers spawned.
- Drive: 55 MPH straight along the road. H/L/N/C taps: no errors.
- **Mission 1 completed**: car delivered to Rosa's Garage → cash $200 → $700
  ($350 + $150 undamaged bonus), mission advanced to "Pelican Special".
- Exit + punch: hero out, one cruiser ram (HP 100 → 85). Jump: max height 0.99 m.
- Pause (P): state `paused`; save present, cash $700. Reload → Continue:
  restored cash $700, mission 1 (Pelican Special), hero position — save/load
  round-trip verified, including the mission index (a save-order bug found
  here is fixed below). Final errors: `[]`, CDP events: `[]`.

**Combat probe (mission 3, Plaza Brawl, `cdp-r5-combat.mjs`):**
- 4 thugs closed in and damaged the hero (100 → 52 HP in 8 s).
- Punch killed one thug: thugsAlive 4 → 3, cash $200 → $250 (+$50).
- Wasted path: hero HP set to 5, thugs finished the job → state `wasted`;
  respawn → cash $250 → $50 ($200 fine), HP 100, back at the hideout.
  Zero exceptions.

**Screenshots (real headless-Chrome captures, 1280×720, all ≤256 KiB,
viewed by the builder):**

| Shot | Size | Shows |
|---|---|---|
| 1-start.jpg | 56,345 B | Title menu over the dusk city |
| 2-drive.jpg | 64,210 B | Sports car on the boulevard, 27 MPH, minimap, mission objective |
| 3-chase.jpg | 57,708 B | Wanted 3, 45 MPH, cruisers with light bars ahead |
| 4-mission.jpg | 68,568 B | Lena facing Vic Marino + 6 thugs at the tower, red beacon |

**main.ts build:** `MAKEFUN_OUTPUT_DIR=/tmp/gta6-out-r5a node main.ts`
writes game/ + screenshots/ + dossier.json (419,111 bytes, schema with
cover/images/text, text under the 163,840 cap). Two runs produce
byte-identical output.

**Kit check:** `node cli/makefun.mjs check --kit . --repo <repo> --worktree`
→ **4 passed, 0 failed, 16 skipped, 5 checked at submission**
(competition_open, snapshot 24 files / 1,050,302 bytes, license_osi MIT,
entrypoint node22). The 5 at-submission checks (repo_public, repo_owner,
repo_created_after_open, commit_in_repo, duplicate_snapshot) are resolved
by pushing this commit and submitting it.

## Bugs found and fixed during testing
- Police cruisers rammed every frame while in contact, so the hero died
  in ~2 s on foot and a car was wrecked in ~1 s. Fixed with a 1.2 s ram
  cooldown per cruiser, plus a 7 m/s speed cap when closing on a hero on
  foot.
- Stealing a car kept the hero's heading, so the car drove off its road
  into a building. Fixed: a stolen car keeps the heading it was parked
  at, so it sits along its road (drive test went from 0 MPH into a wall
  to 55 MPH straight down the road).
- Mission completion saved the game before advancing the mission index,
  so Continue restored the old mission with the new cash. Fixed: the
  index advances before the completion save.
- Staged screenshot cars coasted to 0 MPH before the capture (no key
  held). Fixed with a cruise speed held by staged shots only (drive
  12 m/s, chase 20 m/s).
- The chase shot first staged the car at x=-20, which is inside a block,
  not on a road — it crashed into a building. Fixed: chase stages on
  the x=44 road with cruisers pacing ahead in the lane.
- The shot-ready wait was 45 frames (~22 real seconds at 2 fps), long
  enough for staged scenes to drift apart. Cut to 12 frames.
- Thug fight was unwinnable in a straight stand-up (4 thugs at 8 dmg /
  0.95 s): rebalanced to 6 dmg / 1.15 s cooldown, hero punch 25 → 34.

## Commits (v5)

- `f329b8c` rebuild from scratch — city, vehicles, people, missions, hud, engine
- `f475647` fix cruiser ram spam, steal keeps parked heading, mission save order
- `62be89e` balance thug fight (6 dmg, 1.15 s cooldown, punch 34)
- `d3de9f4` cruise speed for staged shots, chase on the x=44 road, faster shot-ready
- `14eacc1` screenshots (4 real captures, viewed) + combat probe driver
- (final) this report

Not submitted or pushed by this builder (no credentials in session) — the
parent agent handles seal, push, and submit.
