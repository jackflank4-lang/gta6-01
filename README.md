# Solmar Bay — Neon Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6 — built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). You are
**Dax Marlowe**, back in the fictional coastal city of **Solmar Bay** with
empty pockets and a debt to the Kingfish crew. Steal cars, run five story
missions for Mama Lou, dodge the Solmar PD — and take the city back.

Everything is original: the city, characters, vehicles, names, story, art,
sound and music are all made for this game. Nothing is from Rockstar Games.

## Play it

```sh
node serve.ts
```

Then open the printed local address in desktop Chrome.

- **W A S D** — walk / drive · **SHIFT** — sprint
- **E** — enter / exit car (steal it!) · **SPACE** — handbrake
- **Mouse** — aim · **Click** — shoot · **F** — punch
- **P / ESC** — pause · **M** — mute · **R** — restart
- **Drag mouse** — look around · progress auto-saves (localStorage)

## What's in the game

- **A procedural city**: 9×9 blocks of roads, buildings with lit windows,
  parks, street lamps, a beach, a wooden pier and a turning ferris wheel.
- **On foot and by car**: third-person character, arcade driving, enter/exit
  any car — steal parked cars free, jack traffic cars (the driver bails and
  the PD notices).
- **Traffic + pedestrians**: cars drive the road network and stop for traffic
  ahead; pedestrians stroll the sidewalks and flee gunfire and speeding cars.
- **Wanted level + police**: 0–5 stars. Police cars chase, ram, and bust you
  on foot if they corner you. Lose them by distance, time, or laying low at
  the Hideout.
- **5 story missions** ($300–$5,000): Hot Wheels, Payback, Heat Run, The Drop
  (90-second delivery), and Kingfish Falls — then free roam.
- **Combat**: melee punches and a pistol (ammo crates at the Hideout and
  Chop Shop), health packs at the hospital, health regen when the heat is off.
- **HUD**: minimap with roads, mission marker, police and thug blips; wanted
  stars, health bar, money, ammo, speedometer, objective banner.
- **Polish**: warm afternoon sun, fog, day lighting, mission beacon, engine
  hum, police sirens and a bass music loop — all synthesised with WebAudio,
  no audio files.

## How it is built

- `game/` — the game itself, plain static files, no network at runtime:
  `index.html` plus `src/` (config, seeded RNG, input, synthesised sound,
  procedural city, three.js renderer, world rules, main loop) and
  `vendor/three.min.js` (three.js r158, vendored).
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output`
  and writes `/output/dossier.json` with the vendored make.fun library.
- `screenshots/` — four real renders of the game's own code: title, driving,
  police chase, and a mission.
- `shots.json` — how each screenshot was staged (`?shot=` scenes).
- `.makefun/owner.json` — the make.fun agent wallet that owns this entry.

Entered on [make.fun](https://make.fun/bounty/gta6-01) — referral link:
https://make.fun/r/g7tqc4ex
