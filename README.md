[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — Neon Heat

An open-world crime game in the spirit of GTA 6, playable in a desktop
browser from static files — no network, no build step. You are Lena Cruz,
back in Solmar Bay to take the city from crime boss Vic Marino and his crew.

## How to play

Serve the `game/` folder with any static server (or run `node serve.ts` and
open http://localhost:8080), then click **START ENGINE**.

- **WASD / Arrows** — walk and drive
- **E** — enter / exit a car (stealing one adds a wanted star)
- **F** or mouse click — punch
- **Space** — jump
- **Shift** — sprint
- **H** — horn · **L** — headlights · **N** — radio station · **C** — camera
- **P** or **Esc** — pause (autosaves)

## The city

Solmar Bay is an 8×8-block coastal city at dusk: a bay and marina to the
west, the 92 m Meridian Tower with its rotating beacon, the Luna Casino,
Rosa's Garage, the Pelican Diner, the Barracuda crew hideout, a park and a
plaza. Traffic (~14 cars) obeys the traffic lights, ~22 pedestrians stroll
the sidewalks and flee when scared, and the Solmar PD answers your wanted
level with cruisers that chase and ram.

## Missions (in order)

1. **First Wheels** — steal a car and deliver it to Rosa's Garage (+$350,
   +$150 if it arrives undamaged).
2. **Neon Dash** — race a package from the casino to the diner in 75 s (+$550).
3. **Plaza Brawl** — clear four thugs out of Solmar Plaza (+$450).
4. **Night Cabbie** — three taxi fares across the city (+$750).
5. **Kingfish** — face Vic Marino (300 HP) and his crew at the Meridian
   Tower (+$5,000).

You start with $200 and 100 health. Twelve neon coins are hidden around the
city ($40 each). Killing a thug pays $25. Getting busted or wasted costs a
15% fine and wakes you up at the hideout.

## Wanted

0–5 stars. Stealing cars, punching people and ramming cruisers raise the
heat; laying low out of sight lets it cool one star at a time. At 5 stars
four cruisers hunt you at once.

## Save

The game autosaves every 30 seconds, on pause and on mission completion.
**CONTINUE** on the title screen restores your cash, mission and position.

## Sound

All sound is synthesised live with WebAudio — engine hum, sirens, horns,
crashes and three original radio stations (Neon FM, Bay 98, Solmar Nights).
Press **N** to change station.

## Low-effects mode

Add `?fx=low` to the URL to disable shadows and antialiasing on weak
machines.

## License

MIT — see LICENSE.
