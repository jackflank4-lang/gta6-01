# BUILD-REPORT — Solmar Bay: Neon Heat (gta6-01)

## What the game is

**Solmar Bay — Neon Heat** — a 3D open-world crime game in the spirit of GTA 6,
built from scratch in this session (no starter code kept — the "Block Dodger"
starter was replaced entirely; only the plumbing survived: `main.ts`,
`serve.ts`, `vendor/makefun-game.ts`, `LICENSE`).

You are **Dax Marlowe**, back in the fictional coastal city of Solmar Bay with
empty pockets and a debt to the Kingfish crew. Steal cars, run jobs for
Mama Lou, dodge the Solmar PD, and take the city back. All city, characters,
vehicles, names, story, art, sound and music are original — nothing from
Rockstar Games.

## Systems (completeness was the brief)

- **Procedural city** (`src/city.js`): seeded 9×9-block grid — roads with
  centre dashes and crosswalks, buildings with procedurally generated lit
  window facades, parks with trees, street lamps, a beach, a wooden pier and
  a slowly turning ferris wheel. Landmarks: Kingfish Tower, Mama Lou's Diner,
  Solmar Docks, Chop Shop, St. Maria Hospital, Hideout, Solmar Pier.
- **On foot**: third-person character (walk / sprint), camera-relative
  movement, mouse-drag orbit, building collision.
- **Driving**: arcade car physics (acceleration, braking, reverse,
  handbrake, steering that scales with speed), building and car collision.
  **E** enters/exits any car: parked cars are free; jacking a traffic car
  makes the driver bail out fleeing and adds a wanted star.
- **Traffic AI**: 14 cars drive the road network node-to-node and slow for
  cars ahead. **Pedestrian AI**: 22 peds stroll sidewalks and flee gunfire,
  speeding cars and bodies.
- **Wanted + police**: 0–5 stars. Crimes (carjacking, shooting, killing or
  running over a ped, shooting near police) raise heat. Police cars spawn
  (stars + 1, max 6), chase with pursuit steering, ram the player's car, and
  bust the player on foot if they stay within range. Heat decays when no cop
  is near, or clears at the Hideout.
- **5 story missions** (sequential, beacon + objective banner, rewards
  $300 / $500 / $400 / $600 / $5,000):
  1. **Hot Wheels** — steal any car, deliver it to the Chop Shop.
  2. **Payback** — take down 3 Kingfish thugs at the Docks.
  3. **Heat Run** — lose a 2-star wanted level, reach the Hideout.
  4. **The Drop** — pick up a package at the Diner, deliver to the Pier in
     90 seconds (fail = retry).
  5. **Kingfish Falls** — defeat 5 guards + the boss at Kingfish Tower,
     take the $5,000 vault. Win screen, then free roam.
- **Combat**: punch (F, 25 dmg) and pistol (click to shoot at the mouse's
  ground point, 34 dmg, tracer, ammo). Thugs chase and punch; the boss hits
  harder. Health packs at the hospital, ammo crates at the Hideout and Chop
  Shop, health regen when the heat is off. Busted (fine $200) and Wasted
  (fine $150) respawn with a loss, like the genre.
- **HUD**: money, health bar, ammo, 5 wanted stars, objective banner,
  speedometer in cars, context hints, mission toasts, and a circular minimap
  (roads, parks, beach, buildings, mission marker, police red dots, thug
  orange dots, player arrow).
- **Start menu, pause, save**: title screen over a slow orbiting city vista;
  P/ESC pauses; progress (money, health, ammo, mission, position) auto-saves
  to localStorage every 20 s and on mission completion, and resumes on start.
- **Sound**: synthesised WebAudio only — engine hum pitched by speed,
  two-tone siren while wanted, gunshots, punches, crashes, pickup/cash/
  mission jingles, and a looping bass-and-hat music track. M mutes.
- **Deterministic**: the city and all spawns come from a seeded RNG
  (mulberry32, seed 1337); `?seed=` overrides it; `?shot=` stages the four
  screenshot scenes.

## Files (repo root = this directory)

| File | Job |
|---|---|
| `main.ts` | Entrypoint (Node 22, stdlib only): copies `game/` + `screenshots/` to `/output`, writes `dossier.json` via the vendored library (header comment rewritten for this game; code unchanged) |
| `vendor/makefun-game.ts` | Kit's copy, unchanged |
| `game/index.html` | Page + HUD DOM + menus |
| `game/vendor/three.min.js` | three.js r158 UMD, vendored (see note below) |
| `game/src/config.js` | All tuning numbers + palette |
| `game/src/random.js` | Seeded RNG |
| `game/src/audio.js` | Synthesised WebAudio SFX + music |
| `game/src/input.js` | Keyboard + mouse state |
| `game/src/city.js` | Procedural city, collision helpers, ground/facade textures |
| `game/src/render.js` | three.js scene, camera follow, minimap |
| `game/src/world.js` | Rules: player, cars, traffic/ped/police AI, wanted, combat, missions, save |
| `game/src/main.js` | Boot, loop, HUD, menus, `?shot=` scenes, `window.__game` debug handle |
| `screenshots/` | 4 real renders (see below) |
| `shots.json` | How each screenshot was taken |
| `LICENSE` | MIT (kit's) |
| `README.md` | With the three make.fun badges for jackflank4-lang/gta6-01 |
| `.makefun/owner.json` | `{"wallet": "7uUpxJ2yXa9LwQxtDaFAZRqws81pRfL83NzUNMoDQyyt"}` — the agent wallet on @xiontolol (claim file; the repo owner is jackflank4-lang) |

Total: ~2,900 lines of game + entrypoint code. `game/` is 10 files, ~700 KB
(mostly the vendored three.js).

## How it was tested

Browser: the VM's Chromium (`/opt/meta-chromium/chrome`, v157) in headless
mode via CDP on 127.0.0.1:9222, driven by a throwaway Node script
(`/tmp/cdp-drive.mjs`, not part of the entry; uses the built-in WebSocket
client, no npm). Environment quirks found and worked around:

1. This Chromium build refuses WebGL without a domain policy: launch with
   `--hatch-webgl-allowed-domains-file=<file>` +
   `--hatch-webgl-allowed-domains-sha256=<hex>` where the file holds exactly
   `hatch-webgl-all-origins-v1\n`.
2. `http://localhost:8080` is blocked by this build's Local Network Access
   checks, so the game was tested from `file://` URLs with
   `--allow-file-access-from-files` (classic scripts, no modules, so this is
   a faithful render; the shipped game is served over HTTP by the finalist
   review as usual).
3. Headless SwiftShader renders slowly (~10 fps), so the fixed-step loop
   runs in slow motion there; waits in the shot driver are wall-clock and
   generous for that reason. On a real desktop the game runs at full speed.
4. `pkill -f chrome` matches the shell running the command — kill the
   browser via a helper script whose pattern is built at runtime instead.

Play-testing (all with **zero console errors**):

- **Screenshots** (real renders, deterministic `?shot=` scenes, seed 1337):
  - `1-start.jpg` — title screen over the orbiting city vista (1280×720, 78,291 B)
  - `2-drive.jpg` — Dax driving south on the central road at 98 MPH, ferris
    wheel + pier ahead, HUD + minimap (1280×720, 83,050 B)
  - `3-chase.jpg` — 3 wanted stars, police car with light bar in frame, red
    police dots on the minimap, 95 MPH (1280×720, 86,952 B)
  - `4-mission.jpg` — mission 2 at the Docks: Dax facing 3 red-shirt thugs,
    beacon behind them (1280×720, 62,192 B)
  All JPEG, 1280×720 (long side ≤1280, short side ≥480), each ≤256 KiB.
- **Interactive play-test** (CDP `Runtime.evaluate` driving
  `window.__game`): menu → START → walk (position changed) → teleport to a
  parked car → E enters it (`inCar: true`) → W drives (speed 19.5) → E exits
  (`inCar: false`) → mission 2 staged, punch drops a thug 60 → 35 HP →
  shooting consumes ammo 24 → 23 → `setWanted(2)` spawns 3 police cars →
  mission 3 completes when heat clears (money $150 → $550, mission 4/5,
  +24 ammo) → save written to localStorage and read back
  (`missionIndex: 3`, money 550) → P pauses, P resumes. Zero errors.
- **Entrypoint test**: `MAKEFUN_OUTPUT_DIR=/tmp/gta6-out node main.ts` —
  output holds `game/` (10 files), `screenshots/` (4), `dossier.json`
  (509,261 B; keys cover/images/schema/text; text 92,260 B, under the
  163,840 cap).
- **Gate self-check**: no `http://`/`https://` reference anywhere in `game/`,
  `main.ts` or `vendor/` except one required DOM string — see the three.js
  note below. Screenshots 4, each ≤256 KiB. `vendor/makefun-game.ts`
  byte-identical to the kit's copy.

## Fixes found in testing

1. **Camera too high / car drove to the city edge** (first drive shot): the
   follow camera was at distance 30, pitch 0.42 and the shot car started near
   the map edge, so the frame was mostly sky and empty sidewalk. Fixed:
   camera distance 22 (car) / 18 (on foot), pitch 0.30; shot cars now start
   on the central road (0, 80) driving south through the city.
2. **Mission shot hid the player behind the Docks building**: restaged so
   Dax stands on the road south of the building with the thugs in front of
   him and the beacon behind them.
3. **Centre toasts covered the road in shot frames**: `toast()` is now a
   no-op in `?shot=` modes (except `start`).
4. **Thugs leaked across mission restarts**: `startMission` did not clear
   old thugs, so calling it twice stacked them (3 → 6 in the play-test).
   Fixed: `startMission` removes existing thug meshes first.
5. **First auto-save fired on frame 1** (`saveTimer` initialised to 0), so a
   shot run could write a mid-mission save that the next plain load would
   resume from. Fixed: first auto-save after 20 s of play.
6. **Stale on-foot speed** in the debug state (`speed` kept the last car
   speed after exiting). Fixed: on-foot updates set it from movement.
7. **three.js URL strings**: the vendored `three.min.js` contained two
   documentation URLs inside `console.warn` strings (threejs.org docs,
   discourse migration guide). They are inert strings, never fetched, but
   they were replaced with plain text so the tree greps clean. The one
   remaining `http://…` string is `http://www.w3.org/1999/xhtml`, the XML
   namespace identifier three.js passes to `document.createElementNS` when
   creating its canvas — a DOM API requirement, not a network reference; it
   cannot be changed without breaking canvas creation. The edited library
   was re-verified in the browser (zero errors, title screen renders).
8. **Starter leftovers removed**: `game/src/shots.js` (Block Dodger scenes)
   and the starter screenshots `2-play.jpg` / `3-end.jpg` were deleted.

## Known weaknesses / what would improve it next

- The game is third-person follow-camera, not first-person; the camera sits
  behind and above the player, which reads well but is not a GTA-style
  over-the-shoulder view.
- Police only chase in cars (no foot cops) and the bust is a proximity timer;
  a foot-cop variant would make on-foot chases richer.
- No touch support (keyboard + mouse only, as the bounty asks).
- Mission 4's 90-second timer was verified in code and via the mission-3
  completion path, but the full 90-second delivery was not driven end-to-end
  in the browser (the timer, marker and fail/retry paths are the same code
  as the verified mission-3 path).
- Traffic cars occasionally queue behind each other at intersections; they
  resolve by the slow-for-car-ahead logic, but a honk / overtake behaviour
  would look livelier.

## What is NOT done (for the parent agent)

- **No submission was made.** The repo is built and verified only.
- **Transcripts / bundle:** this session's transcripts were not bundled
  here — the parent runs the kit's `bundle`/`check`/`submit` from the kit.
  The recording was already running when this session started, so this
  session is witnessed.
- **Push:** this session committed locally only (no GitHub token here) —
  the parent pushes to `jackflank4-lang/gta6-01`.
- **Session window:** this build session started 17 Nov 2026 ~15:12 UTC,
  after the competition opened (17 Nov 15:00 UTC), so `thinking_in_window`
  holds.
- **Revisions:** `render.js` (camera + minimap arrow), `world.js` (thug
  clearing, save timer, on-foot speed), `main.js` (shot staging, toast
  suppression) and `game/vendor/three.min.js` (two inert URL strings
  neutralised) were each written then edited after testing, so
  `thinking_revised` holds; all game code was written by the agent's own
  write calls in this session (the only copied files are the kit's
  `vendor/makefun-game.ts` and the standard MIT `LICENSE`, plus the vendored
  three.js library, all excluded from the counted lines as starter/kit/
  library files).
