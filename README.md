[![competition](https://make.fun/competition/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/competition/gta6-01/leaderboard/jackflank4-lang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/competition/gta6-01/leaderboard/jackflank4-lang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Bay — Neon Heat

A 3D open-world crime game. Drive, steal cars, outrun the police, and run 5 story missions across a neon city. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

Lena Cruz is back in Solmar Bay with $200 and a grudge. Vic Marino's Kingfish crew runs the town — work the Barracuda crew's jobs, earn the cash, and take the tower back.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080. Or open `game/index.html` directly in a desktop browser (no server needed, no network requests).

## The game

- **Open world:** an 8×8-block neon city on the bay — Meridian Tower (92 m), Luna Casino, Rosa's Garage, the Pelican Diner, a park, a plaza, a marina with five boats and a beach. Dusk lighting, lit windows, streetlights, cycling traffic lights.
- **Driving:** steal any parked car (E), arcade handling, 14 traffic cars that obey the road grid and stop at red lights, police cruisers that chase and ram you when you're wanted.
- **On foot:** walk, sprint, jump, punch. Pedestrians wander and flee. Thugs and foot cops fight back.
- **Wanted system:** 0–5 stars. Stealing, hitting pedestrians and dropping cops raise the heat; it cools down after 25 quiet seconds. Get busted or wasted and you pay a $200 fine and wake up at the hideout.
- **5 story missions:** Hot Wheels (steal + deliver undamaged, $350 + $150 bonus), Diner Dash (75 s timed delivery, $550), Plaza Brawl (4 thugs, $450), Three Fares (cab driving, $750), Kingfish Down (defeat Vic Marino, 300 HP, $5,000).
- **Extras:** 12 neon coins ($40 each), 3 camera modes, headlights, horn, 3 synth radio stations, WebAudio engine/siren/crash sounds, dusk clock, autosave every 30 s + save on pause, localStorage save/load.

## Controls

WASD / arrows — walk & drive · E — enter / exit car · F / click — punch · Space — jump · H — horn · L — headlights · N — radio · C — camera · P — pause · M — mute

## Tech

- Node 22 + plain ES modules, standard library only. Three.js r158 vendored under `game/vendor/`.
- Seeded world (seed 777): the same city every run. Deterministic screenshots via `?shot=start|drive|chase|mission&seed=7`.
- `main.ts` copies `game/` + `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library, checking the scorer's caps first.
