# Solmar Bay — Neon Heat — v6 build report

Round 4 rebuild (recording r7), written from scratch from the prose brief
only. No file under the repo was opened, read or copied; every counted file
below was deleted first and rewritten in-session, including README.md (with
the three live make.fun badge lines at the top) and shots.json.

## What was built

A 3D open-world crime game in the fictional coastal city Solmar Bay, on the
vendored Three.js library. Hero Lena Cruz (Barracuda crew) vs boss Vic
Marino. 8×8 block grid (30 m blocks, 14 m roads), seeded RNG (seed 777),
landmarks: Meridian Tower (92 m + red beacon), Luna Casino, Rosa's Garage,
Pelican Diner, crew hideout, park, plaza, beach and marina with boats.

- On foot: walk, sprint, jump (~1 m, exact kinematics), punch. In a car:
  arcade driving, enter/exit, steal a parked or traffic car (+1 wanted star).
- Wanted 0–5 stars: up to 4 police cruisers pursue and ram (1.2 s cooldown
  per cruiser; they never ram a hero on foot), foot cops chase and punch;
  busted (−$100) and wasted (−$200 fine) both respawn at the hideout.
  Wanted decays after 15 s out of sight.
- Traffic: 14 AI cars on the road grid, stopping at red lights. Pedestrians:
  22, wandering the sidewalks and fleeing from danger. Car damage, garage
  repairs.
- Combat: punch thugs and cops; thugs fight back (6 dmg / 1.15 s); boss
  300 HP. Killing a thug pays $50, a cop $25.
- Five story missions: Hotwire (steal + deliver undamaged, $350 + $150
  bonus), Timed Drop (75 s to the diner, $550), Plaza Brawl (4 thugs,
  $450), Taxi (3 fares, $750), Kingfish (Vic Marino + crew, $5,000).
  Start $200 / 100 HP. 12 neon coins, $40 each.
- Controls: WASD/arrows, E, F/click, Space, H horn, L headlights, N radio
  (3 original synth tracks), C camera (3 modes), P/Esc pause, mouse-drag
  look, Shift sprint.
- HUD: cash, health, wanted stars, dusk clock, speed, objective, toasts,
  circular minimap (repainted every 3rd frame), start/pause menus, save
  (autosave 30 s + pause + mission complete, localStorage, Continue
  restores cash, mission and position).
- Audio: WebAudio synth only — engine, siren, horn, crashes, punches,
  coins, mission fanfare, 3 radio tracks.
- Low-effects mode (?fx=low): no antialiasing, pixel ratio 1. Deterministic
  screenshot staging (?shot=start|drive|chase|mission&seed=1).

## Files

main.ts (entrypoint, copies game/ + screenshots/ to /output, writes
dossier.json), game/index.html, game/src/{rng,input,audio,city,vehicles,
people,missions,hud,engine,shots,main}.js, README.md (badges on top),
shots.json, .makefun/owner.json. Counted lines: ~2,400.

## Verification (all green, zero console errors / zero exceptions)

- Full play-test (headless Chrome 157, CDP, ?fx=low): boot OK, WebGL true;
  walk; steal → wanted 1, in car; drive 19–22 MPH; mission 1 complete →
  cash $200 → $700 ($350 + $150 undamaged bonus), mission → Timed Drop;
  H/L/N/C fine; exit + punch; jump max 1.00 m; pause → save present;
  reload → Continue restores cash $700, mission 1, position.
- Combat probe (Plaza Brawl): thugs damage hero 100 → 58 HP; punch kills
  thugs (+$50 each); wasted path → respawn with $200 fine (cash $200 → $0),
  HP 100, back at hideout.
- Screenshots: 4 real headless-Chrome 1280×720 captures, all ≤256 KiB, all
  viewed: title menu over the dusk city; driving on the boulevard with
  minimap + 31 MPH; wanted 3 with two cruisers pacing alongside, light bars
  flashing; Lena facing Vic Marino and his crew up the road.
- main.ts: two runs byte-identical; dossier 85,611 text bytes (under the
  163,840 cap); output 1,285,662 bytes with game/, screenshots/ (4),
  dossier.json (schema makefun/dossier/v1).

## Bugs found and fixed in-session

1. Test driver reads `__game.traffic` — the engine exposed only
   `vehicles`. Added a `traffic` alias.
2. Jump peaked at 0.65 m under the dt clamp (Euler error at dt=0.1).
   Switched to the exact kinematic update (y += vy·dt − ½g·dt²) and a
   floatier arc (vy 6, g 16): peak now 1.00 m at any frame rate.
3. Start shot showed the game instead of the menu: the constructor forced
   `state = 'playing'` after staging. Fixed to leave menu mode for the
   start shot, with a fixed high camera over the marina (the orbit can hide
   behind a building).
4. Shadowed building faces were pitch black. Added a cool fill light and
   raised the hemisphere light.
5. Chase shot had no cruisers in frame (they converged behind the camera).
   Added a pace offset so staged cruisers hold position ahead-left and
   ahead-right of the hero.
6. Mission shot had a streetlight pole between the camera and the hero.
   Re-staged on road x=-44 with the hero facing the crew up the road.
