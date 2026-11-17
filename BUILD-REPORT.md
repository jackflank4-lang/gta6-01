# Solmar Bay — Neon Heat: BUILD REPORT (v4, round 2)

Rebuilt from scratch for make.fun bounty **gta6-01 round 2** (recording r4,
`01a1ea6b-b49f-71b5-8d77-dcf739ca0811`). Round 1 was rejected on
`thinking_reproduces` (12.1% authored) and `transcripts_witnessed`
(`shots.json` never touched), so this version was written entirely from the
builder's own design — no old file under `gta6-01/` was opened, read, or
copied. Every counted file (main.ts, game/index.html, game/src/*.js,
README.md, shots.json, .makefun/owner.json) was written fresh in-session.
LICENSE, serve.ts, vendor/makefun-game.ts, and game/vendor/three.min.js were
left exactly as they are.

## What was built

An open-world 3D crime game in Solmar Bay, starring Lena Cruz and the
Barracuda crew vs. Vic Marino. Three.js (vendored UMD r150+) renders a dusk
city: an 8×8 block grid (30 m blocks, 14 m roads), a bay with beach and
marina, a park, a plaza, and landmarks — Meridian Tower (92 m + beacon),
Luna Casino, Rosa's Garage, Pelican Diner, and the hideout. Seeded RNG
(seed 777) drives the layout, traffic, and pedestrians.

| File | Lines | What it does |
|---|---|---|
| main.ts | 63 | Copies game/ + screenshots/ to /output, validates shots, writes dossier.json |
| game/index.html | 125 | Canvas + full HUD DOM (cash, HP, stars, clock, speed, objective, toast, minimap, menus) |
| game/src/rng.js | 63 | SplitMix32 Rng (next/range/int/pick/chance/gauss/shuffle) + hashSeed |
| game/src/input.js | 98 | Keyboard (code-based, WASD/arrows, edge + held) and mouse-drag camera |
| game/src/audio.js | 220 | WebAudio synth only: engine, siren, shots, horn, crashes, 3 original radio tracks |
| game/src/city.js | 385 | Grid, ground texture, buildings with lit windows, landmarks, marina, lights, colliders |
| game/src/vehicles.js | 454 | Car meshes, traffic AI (14 cars, red-light stops), police pursuit, arcade car handling |
| game/src/people.js | 332 | Pedestrians (22, flee), hero (walk/sprint/jump/punch), thugs + boss (300 HP) |
| game/src/missions.js | 230 | 5 story missions: steal + deliver, timed delivery, 4-thug fight, 3 fares, boss finale |
| game/src/hud.js | 190 | Cash/HP/stars/clock/speed/objective/toast, circular minimap, menus, save notes |
| game/src/engine.js | 638 | Renderer, state machine, wanted system, combat, coins, beacon, save/load, debug hooks |
| game/src/shots.js | 89 | Deterministic staging for the 4 screenshots |
| game/src/main.js | 35 | Bootstrap, error collection into window.__errors, ?shot= staging |
| README.md + shots.json | — | Player guide + the 4 screenshot descriptors |

**Counted total: 2,990 lines** (main.ts + index.html + game/src/*.js +
README.md + shots.json), all authored in this session.

Systems: walk/drive, car theft (+1 wanted), police pursuit (up to 4
cruisers, ramming, foot cops → busted), 5 missions with payouts
($350/$550/$450/$750/$5000 + undamaged bonus), combat (punch thugs/cops,
thugs fight back), 12 coins ($40), wanted decay, 3 camera modes,
headlights/horn/radio, day clock, autosave every 30 s + on pause/mission
complete, localStorage save/load, and `?fx=low` (no shadows/antialiasing)
for weak machines.

## Verification (all in headless Chrome 157, SwiftShader, file://)

Zero console errors and zero page exceptions in every run. The software
renderer runs ~2–8 fps, so the test driver uses 400 ms key holds, 1.2 s
settles, and an 800×450 `?fx=low` window for the play-test; screenshots are
full-quality 1280×720.

**Full play-test (CDP driver, `~/workspace/makefun/cdp-r4.mjs playtest`):**
- Boot: WebGL true, 0 errors. Menu → START → playing, mission 1, $200, 100 HP.
- Walk: hero moved 6 m on W. Steal (E): inCar, wanted 1, mission stage 1,
  1 police cruiser spawned. Drive: 31 MPH. H/L/N/C taps: no errors.
- **Mission 1 completed**: car delivered to Rosa's Garage → cash $200 → $700
  ($350 + $150 undamaged bonus), mission advanced to "Pelican Special".
- Exit + punch: hero out, no errors. Jump: max height 1.10 m.
- Pause (P): state `paused`; save present, cash $700. Reload → Continue:
  restored cash $700, mission 1, hero position (-159, -11) — save/load
  round-trip verified. Final errors: `[]`, CDP events: `[]`.

**Combat probe (mission 3, Vipers in the Plaza):** 4 thugs spawned; they
damaged the hero (100 → 4 HP); a punch killed one (+$50, 1/4 down, thugsAlive
4 → 3); the hero was then beaten to `wasted` with a $200 fine (cash $250 →
$50). Combat, kill payout, and the wasted path all verified. Zero exceptions.

**Bugs found and fixed during testing:**
- Input edges were cleared after rendering, so keys pressed during a long
  SwiftShader frame were swallowed (Space/P lost). Fixed with a per-frame
  pressed snapshot (`Input.beginFrame`, called at the start of the loop);
  P/Escape now also toggles pause from the paused state.
- Exiting a car then calling `crowd.scare(playerCar.pos)` threw
  (pos is null once the mesh is abandoned) and killed the frame loop. Fixed
  by skipping the driving-only tail after an exit, plus a null guard in
  `scare()`. Honk/headlight/repair/update were already null-safe.
- `?fx=low` mode and a minimap repaint throttle (every 3rd frame) were added
  for software renderers.
- Screenshot driver: Chrome 157 wants JPEG `quality` as an int (85), not 0.85.
- Chase/mission staging: cruisers are now staged ahead of the car (in frame)
  and the mission-5 crew is restaged in a visible line in front of the tower
  (they spawn inside the tower footprint).

**Screenshots (real headless-Chrome captures, 1280×720, all ≤256 KiB,
viewed by the builder):**

| Shot | Size | Shows |
|---|---|---|
| 1-start.jpg | 74,446 B | Title menu over the dusk city |
| 2-drive.jpg | 109,642 B | Sports car on the boulevard, 26 MPH, minimap |
| 3-chase.jpg | 107,588 B | Wanted 3, three cruisers closing in, 44 MPH |
| 4-mission.jpg | 72,164 B | Lena facing Vic Marino + 6 thugs at the tower |

**main.ts build:** `MAKEFUN_OUTPUT_DIR=/tmp/gta6-out-r4a node main.ts` writes
game/ (755,474 bytes, 12 source files + 1 vendored three.min.js) +
screenshots/ + dossier.json (593,625 bytes, schema makefun/dossier/v1, text
104,685 bytes — all under the caps). Two runs produce byte-identical output.

## Commits (v4)

- `dd0a658` rebuild from scratch — new city, systems, missions, HUD
- `59f6e40` low-fx mode, minimap throttle, stage chase cruisers close
- `68eb64d` clear input edges right after update, not after render
- `eb5f1b5` snapshot input edges per frame; P/Escape toggles pause in loop
- `28bb8e6` fix loop-killing scare(null) on car exit; null-guard scare
- `66b49ce` stage chase cruisers ahead, mission thugs in front of tower
- (final) screenshots + this report

Not submitted or pushed by this builder (no credentials in session) — the
parent agent handles seal, push, and submit.
