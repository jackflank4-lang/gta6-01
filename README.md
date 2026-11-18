[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jackflank4-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — Neon Heat

A 3D open-world crime game. You are **Lena Cruz** of the Barracuda crew, working five jobs across a neon dusk city on the bay — and ending it with boss **Vic Marino** (300 HP) at Meridian Tower.

## Play

Serve the game (`node serve.ts`, then open http://localhost:8080) or open `game/index.html` directly in a desktop browser. No network needed — everything is local, including the vendored three.js.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Run |
| E | Enter / exit car (stealing one raises your wanted level) |
| F | Punch |
| Space | Jump |
| H | Horn |
| N | Next radio station (3 synth stations, all synthesized live) |
| C | Camera: chase / wide / top-down |
| P | Pause (auto-saves) |
| M | Mute |

## The five missions

1. **Hot Wheels** — steal any car, deliver it to Rosa's Garage. +$350, +$150 if the car arrives undamaged.
2. **High Roller** — timed delivery to the Luna Casino, 90 seconds. +$550.
3. **Plaza Brawl** — clear four Barracuda thugs off the plaza. +$450, +$50 per thug.
4. **Cab Hustle** — three taxi fares across the city. +$250 per fare.
5. **Neon Heat** — the finale: four thugs plus Vic Marino at Meridian Tower. +$5,000.

Plus 12 neon coins hidden on the roads (+$40 each), traffic AI, pedestrians, a 0–5 star wanted system with police pursuit, and a save that survives between sessions.

## Tech

- three.js (vendored, `game/vendor/three.min.js`), WebGL renderer.
- Deterministic world: seed 777 drives the city layout, traffic and pedestrians, so every run plays the same map.
- All sound is synthesized with WebAudio — engine hum, sirens, horn, impacts and three radio stations. No audio files.
- Node 22, standard library only. `main.ts` builds `dossier.json` with the vendored make.fun library.

## Credits

A fan-made tribute built for the make.fun "Make GTA 6" bounty. Not affiliated with Rockstar Games or Take-Two Interactive.
