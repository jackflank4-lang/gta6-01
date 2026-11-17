# Solmar Bay — Neon Heat

An open-world crime game in the spirit of GTA 6, built from scratch for the
make.fun **gta6-01** bounty. It plays offline in a desktop browser from static
files — no network, no build step, every sound synthesised live with WebAudio.

## The game

Lena Cruz is out of the county lockup with $200 and a grudge. Solmar Bay is
hers to take: a dusk-lit procedural city on a bay, 8×8 blocks of streets,
traffic, pedestrians, a marina, a beach, the Meridian Tower and the Luna
Casino glowing over the east side.

**Systems, all wired together:**

- **On foot and by car** — walk the sidewalks, sprint, jump; steal any
  parked or traffic car with E and drive it. Arcade handling with
  acceleration, braking, handbrake drift and damage.
- **Traffic AI** — 14 cars looping the blocks, stopping at red lights,
  slowing for the car ahead; 10 parked cars waiting to be stolen.
- **Pedestrians** — 22 walkers strolling the sidewalks who scatter when a car
  screams past or a punch lands.
- **Wanted system** — 0–5 stars for stealing, hitting civilians or cops.
  Cruisers spawn, chase and ram; foot cops try to hold you and bust you.
  Lay low out of sight and the heat cools off.
- **Story missions** — five jobs with payouts and an undamaged-delivery
  bonus: steal a car for Rosa's Garage, a timed courier run to the marina,
  a plaza brawl with the Barracudas, three night fares, and the finale
  against boss Vic Marino on top of the Meridian Tower.
- **Combat** — punch thugs and cops; thugs fight back, the boss hits harder.
- **HUD** — cash, health, wanted stars, clock, speed, a circular minimap
  (roads, traffic, police, mission beacon), objectives and toasts.
- **Extras** — 12 gold coins to collect, three radio stations, headlights,
  horn, three camera modes, day clock, and a save that persists in
  localStorage (autosaves every 30 s, on pause and on mission complete).

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Mouse drag | Look around |
| E | Steal car / exit car |
| Space | Jump (on foot) / handbrake (in car) |
| F | Punch |
| H | Horn |
| L | Headlights |
| N | Next radio station |
| C | Camera mode |
| P / Esc | Pause |
| M | Mute |

## Play

Serve `game/` with any static server and open `game/index.html`, or run
`node serve.ts` and open http://localhost:8080. Screenshots are staged with
`?shot=start|drive|chase|mission`.

## Tech

- three.js (vendored UMD build under `game/vendor/`) for the 3D city
- ES modules under `game/src/`, one file per system
- `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library

## License

MIT — see LICENSE.
