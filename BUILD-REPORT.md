# Solmar Bay — Neon Heat — v8 Build Report (round 6, recording r10)

Open-world 3D crime game for make.fun gta6-01. Hero Lena Cruz (Barracuda
crew) vs boss Vic Marino. Seeded 8x8-block procedural city, bay/beach/marina,
landmarks (Meridian Tower 92 m, Luna Casino, Rosa's Garage, Pelican Diner,
hideout). On foot + driving (E enter/exit, stealing adds a star), traffic AI
(~14 cars), pedestrian AI (~22), wanted 0-5 stars + police pursuit/bust,
5 story missions ($350/$550/$450/$750/$5,000 + $150 mission-1 undamaged
bonus, start $200/100 HP), 12 neon coins @ $40, combat (punch F), HUD +
circular minimap, start/pause/save (localStorage), WebAudio synth sound
(3 radio tracks), deterministic RNG seed 777 (SplitMix32), controls
WASD/E/F/Space/H horn/L headlights/N radio/C camera (3 modes)/P pause,
low-fx mode (?fx=low), deterministic screenshot staging via ?shot= queries.

## Files (2,796 counted lines)

| file | lines |
| --- | --- |
| game/src/rng.js | 62 |
| game/src/input.js | 64 |
| game/src/audio.js | 239 |
| game/src/city.js | 407 |
| game/src/vehicles.js | 298 |
| game/src/people.js | 368 |
| game/src/missions.js | 131 |
| game/src/hud.js | 199 |
| game/src/engine.js | 634 |
| game/src/shots.js | 90 |
| game/src/main.js | 40 |
| game/index.html | 87 |
| main.ts | 103 |
| README.md | 73 |
| shots.json | 1 (213 bytes, single line) |

Kit/starter files left untouched: LICENSE, serve.ts, vendor/makefun-game.ts,
game/vendor/three.min.js.

## Screenshots (seed=9, 1280x720 JPEG, all <= 256 KiB)

| file | bytes | scene |
| --- | --- | --- |
| screenshots/1-start.jpg | 84,632 | Title screen over the plaza, high camera |
| screenshots/2-drive.jpg | 73,771 | Red sedan cruising the boulevard, taxi ahead |
| screenshots/3-chase.jpg | 78,101 | Wanted 3: red sports car, two cruisers in pursuit |
| screenshots/4-mission.jpg | 73,961 | Mission 5 finale: Lena vs Vic Marino + 4 thugs |

All four viewed. shots.json lists exactly these four files with seed=9
queries; its bytes differ from the v7 seed=7 manifest (4x seed=9, 0x seed=7,
sha256 6e4b8561374813c979a03c9e174ce03b2bc492dc15f04000a36def1ad9efccd3).

## Verification (headless Chromium, file://, SwiftShader, ~2-8 fps)

- Boot: zero console errors/exceptions, menu state, cash $200, HP 100,
  wanted 0, mission -1, coins 0/12, clock 18:30, camMode 1.
- Play test: walked, stole parked car (wanted 1), drove 25 MPH,
  mission 1 completed: cash $590 ($200 + $350 + $40 coin; no $150 bonus,
  car damaged 34), mission -> 1, jump peak 0.9067 m, paused, save present
  in localStorage (solmar-bay-save-v1), resumed, final errors [].
- Combat probe: 3 thugs spawned, all punched dead, hero HP 100 -> 4,
  cash $200 -> $350 (3 x $50 kills), kills 3, errors [].
- Missions chain: m1 $740, m2 $1,330, m3 $1,980, m4 $2,770 (boss HP 300),
  m5 $7,970, "All missions complete. Solmar Bay is yours, Lena.", errors [].
- main.ts: two runs on the same inputs byte-identical (diff -r clean).
  Dossier 510,381 bytes; text 93,021 bytes (< 163,840 cap); 4 screenshots.
- Screenshots: all four captured with zero errors; drive 14.5 MPH at
  capture, chase 19.9 MPH, wanted 3; mission hero at full HP at capture.

## Bugs found and fixed during this build

- WebGL flag: Chrome refused to start without BOTH
  --hatch-webgl-allowed-domains-file and --hatch-webgl-allowed-domains-sha256.
- three.js UMD, not ESM: game/vendor/three.min.js is a global script, not a
  module. Loaded via a classic script tag, used as window.THREE.
- Input edge double-fire: update() runs once per substep, so one E press
  toggled enter->exit in a single frame, and cruiser ram fired every
  substep. Fixed by clearing input.pressed / input.clicked at the end of
  update(), and a per-cruiser ram cooldown (1.0 s).
- Jump was NOT broken: at ~2 fps a 0.59 s jump completes inside one frame's
  substeps, so external polling never sees y > 0. Proved by an atomic
  in-page test (one people.update() with Space pressed: y 0.102, vy 6.13,
  grounded false). Driver tracks __maxYSeen inside a people.update wrapper.
- Combat tuning: thug HP 60 -> 50 (2 punches at 25 dmg), thug attack
  8 -> 6 dmg, attack cooldown 0.9 -> 1.1 s. Rapid F taps collapse into one
  pressed edge per frame at ~2 fps, so the combat probe calls heroPunch()
  directly every 380 ms; the F-key path itself was proven by play test.
- Mission 2 unreachable target: objective/dist used the casino centre
  (inside the casino collider). Added city.casinoFront {x:110, z:-44};
  missions.js now uses casinoFront.
- Shots staging: first version placed hero/cars on block centres (inside
  buildings). Rewritten to road lines / open ground.
- Shot framing: at ~5 fps the chase camera lags ~10 m behind a moving car
  (lerp 0.12/frame). Driver now re-snaps the camera right before capture;
  camera lerp tightened 0.12 -> 0.18. Rolling drag reduced 1.6 -> 0.5/s so
  staged speed persists for the chase shot.
- Shot cars: giveCar/addCar now take an explicit colour so the drive and
  chase shots use a bright red sedan/sports car (was random dark 0x2a2a30).
- Mission shot: hero repositioned (16, 10) facing north-northwest so the
  boss shows past Lena; crew staged 14 m out so the fight reads but Lena
  is not swarmed before the capture.
- main.ts: buildDossier returns a Uint8Array, not a string — JSON.parse
  needed a TextDecoder decode first. Dossier schema fields are cover /
  images / schema / text (no d.game / d.screenshots / d.text_bytes).
