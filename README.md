[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
# Solmar Bay — Neon Heat

A 3D open-world crime game built for the make.fun **GTA 6** bounty. You are
**Lena Cruz** of the Barracuda crew, back in Solmar Bay to take the streets
from boss **Vic Marino** — one stolen car, one job, one neon coin at a time.

## Play

Open `game/index.html` in a browser (or run `node serve.ts` and visit the
printed URL). Click **START NEW GAME**. No build step, no dependencies
beyond the vendored `three.min.js`.

| Key | Action |
| --- | --- |
| W A S D / arrows | Drive / walk |
| E | Steal / enter a car, exit a car |
| F / click | Punch |
| Space | Jump |
| H | Horn |
| L | Headlights |
| N | Radio station (NEON 88.4 / SUNSET 91.1 / CALLE 97.9) |
| C | Camera: chase / high / close |
| P / Esc | Pause |

## The city

A seeded 8×8-block procedural city (seed 777): 30 m blocks, 14 m roads, a
bay and beach on the east edge, and five landmarks — **Meridian Tower**
(92 m), **Luna Casino**, **Rosa's Garage**, **Pelican Diner**, and the
**Hideout**. Traffic AI drives the lanes and stops at red lights;
pedestrians wander the sidewalks; police cruisers and foot cops respond to
your wanted level (0–5 stars).

## Story missions

1. **Borrow a Ride** — steal a car, deliver it to Rosa's Garage. $350,
   +$150 if the car arrives undamaged.
2. **Sunset Delivery** — reach Luna Casino in 60 seconds. $550.
3. **Plaza Brawl** — take down 4 thugs at the plaza fountain. $450.
4. **Taxi Fares** — three pickups and drop-offs across the bay. $750.
5. **Neon Heat** — defeat Vic Marino (300 HP) and his crew at Meridian
   Tower. $5,000.

Twelve neon coins are hidden around the city ($40 each). Progress
autosaves every 30 seconds and on every mission complete
(`localStorage`, key `solmar-bay-save-v1`); **Continue** resumes it.

Getting busted costs $100, getting wasted costs $200 — either way you wake
up at the Hideout and the crew is still waiting.

## Screenshots

Captured headless at 1280×720 with `?shot=<name>&seed=9`:

- `start.jpg` — title screen over the plaza at dusk
- `drive.jpg` — cruising the central boulevard
- `chase.jpg` — wanted level 3, cruisers in pursuit
- `mission.jpg` — the Neon Heat finale at Meridian Tower

## Build

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` into the
output directory, validates the screenshots, and writes `dossier.json`
through the vendored `vendor/makefun-game.ts` helper:

```sh
node main.ts   # writes /output (or $MAKEFUN_OUTPUT_DIR)
```

Two runs on the same inputs produce byte-identical output.
