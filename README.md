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
plaza with a fountain, and five landmarks: Meridian Tower (92 m, with
a beacon), Luna Casino, Rosa's Garage, the Pelican Diner, and the crew
hideout. Traffic drives the roads and stops at red lights; pedestrians
stroll the sidewalks and flee from trouble.

## Missions

1. **Hot Wheels** — steal a car and deliver it to Rosa's Garage.
   Deliver it undamaged for a $150 bonus.
2. **Pelican Special** — a timed delivery to the Pelican Diner.
3. **Plaza Brawl** — clear four thugs out of the plaza.
4. **Night Shift** — three taxi fares across the city.
5. **Kingfish Down** — take down Vic Marino (300 HP) and his crew at
   Meridian Tower.

Plus 12 neon coins hidden around the city ($40 each), a wanted system
(0–5 stars) with police cruisers and foot cops, car damage and repairs
at Rosa's Garage, and a save system (autosaves every 30 seconds and on
pause; Continue on the title screen picks up where you left off).

## Tips

- Stealing a car raises your wanted level; lose the police by breaking
  line of sight for a while and the stars decay.
- A wrecked car cannot drive — get it to Rosa's Garage or steal another.
- The radio only plays while you are driving. Headlights help at dusk.
- Punch thugs before they surround you; each one you drop pays $50.

## Tech

Three.js (vendored) renders the city; all sound is synthesised with
WebAudio (engine, sirens, horn, crashes, and three original radio
tracks). The city, traffic and pedestrians are built from one seed
(777), so every run plays the same streets.
