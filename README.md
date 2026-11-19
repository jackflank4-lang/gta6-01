[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — Neon Heat

An open-world crime game in the dusk-lit coastal city of Solmar Bay, built for
the make.fun "Make GTA 6" bounty. You are Lena Cruz of the Barracuda crew,
taking the city back from crime boss Vic Marino — on foot and by car, with
traffic, pedestrians, police, five story missions, combat, collectibles, a
minimap, a save system and synthesised sound. It runs offline in a desktop
browser from static files, no network request, no build step.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly from the files (the game loads only files
under `game/`). Add `?fx=low` for the low-effects mode (no shadows, no
antialiasing) on weak machines.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive in a car |
| Shift | Sprint |
| E | Enter / exit a car (stealing one adds a wanted star) |
| F / Click | Punch |
| Space | Jump |
| H | Car horn (scares pedestrians) |
| L | Headlights |
| N | Change radio station (3 stations) |
| C | Camera (near / far / top) |
| P / Esc | Pause (autosaves) |

## The city

Solmar Bay is an 8×8 block grid (30 m blocks, 14 m roads) with a park, a
plaza, a beach and a marina, and landmarks you will learn by heart: the
92 m Meridian Tower with its sweeping beacon, the Luna Casino, Rosa's Garage,
the Pelican Diner and the crew hideout. The layout is seeded, so the city is
the same every run. Traffic (about 14 cars) obeys the lights; about 22
pedestrians wander the sidewalks and flee when scared.

## Missions

Five story missions, in order, with cash payouts:

1. **Hot Wheels** — steal a car and deliver it to Rosa's Garage. $350, plus
   a $150 bonus if it arrives undamaged.
2. **Neon Run** — timed delivery to the Marina, 90 seconds. $550.
3. **Plaza Brawl** — beat the four thugs in the plaza. $450.
4. **Night Shift** — three taxi fares across town. $750.
5. **Kingfish** — the finale: take down Vic Marino (300 HP) and his crew at
   the Meridian Tower. $5,000.

You start with $200 and 100 health. Twelve neon coins are hidden around the
city ($40 each), and every thug you put down pays $25. Rosa's Garage repairs
a damaged car for $25.

## Wanted

0–5 stars. Stealing a car, hitting a cop, or causing mayhem raises it; up to
four police cruisers pursue and ram, and foot cops chase you down. Get caught
and you are **busted** (10% fine); get beaten and you are **wasted** (15%
fine). Lay low for a while and the heat falls.

## Save

The game autosaves every 30 seconds, on pause and on mission completion, to
local storage. Continue from the menu restores your cash, mission and
position.

## Sound

All sound is synthesised with WebAudio — engine hum, sirens, horn, crashes,
punch and coin chimes, and three original radio tracks. No audio files.

## Files

- `game/index.html` — canvas + HUD (cash, health, stars, clock, speed,
  objective, toasts, circular minimap, menus).
- `game/src/` — one module per system: `rng` (seeded random), `input`,
  `audio`, `city` (generation + landmarks + collision), `vehicles` (cars,
  traffic AI, police, driving), `people` (hero, pedestrians, thugs, cops,
  boss), `missions`, `hud`, `shots` (deterministic screenshot staging),
  `engine` (loop, wanted, combat, coins, save/load), `main` (bootstrap).
- `game/vendor/three.min.js` — vendored Three.js.
- `main.ts` — the entry program: copies `game/` + `screenshots/` to the
  output directory and writes `dossier.json`.
- `serve.ts` — tiny static server for local play.
- `screenshots/` — four real renders of the game (title, driving, chase,
  finale), listed in `shots.json`.

## Licence

MIT — see `LICENSE`.
