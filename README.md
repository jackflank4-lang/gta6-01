[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — Neon Heat

An open-world crime game in the fictional coastal city of Solmar Bay.
You are Lena Cruz, running with the Barracuda crew against the crime
boss Vic Marino. Explore the city on foot and by car, steal cars, outrun
the police, and run five story missions — from a hot-wired sedan to the
Kingfish himself.

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and
open http://localhost:8080). No network needed — everything is local.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Sprint |
| Space | Jump |
| E | Steal a parked car / exit a car |
| F or mouse click | Punch |
| H | Car horn |
| L | Headlights |
| N | Change radio station (3 stations) |
| C | Change camera (chase / far / high) |
| P or Esc | Pause (progress autosaves) |
| Drag mouse | Look around |

## The city

An 8×8 block grid with a beach and marina to the south, a park, a
plaza, and landmarks: the Meridian Tower (92 m, with a red beacon),
the Luna Casino, Rosa's Garage, the Pelican Diner, and the crew hideout.
Traffic follows the roads and stops at red lights; pedestrians flee
when you scare them.

## Missions

1. **Hotwire** — steal a car and deliver it to Rosa's Garage undamaged
   ($350 + $150 bonus).
2. **Timed Drop** — deliver a package to the Pelican Diner in 75 seconds
   ($550).
3. **Plaza Brawl** — take down four thugs in the plaza ($450).
4. **Taxi** — three fares across the city ($750).
5. **Kingfish** — take down Vic Marino (300 HP) and his crew at the
   Meridian Tower ($5,000).

Stealing a car raises your wanted level; police cruisers pursue and foot
cops chase you down. Get busted and you lose $100; get wasted and the
hospital takes $200. Lose the heat by breaking line of sight for 15
seconds. Twelve neon coins are hidden around the city, $40 each.
Rosa's Garage repairs your car.

## Save

Progress autosaves every 30 seconds, on pause, and when a mission
completes. Continue from the start menu to pick up where you left off.
