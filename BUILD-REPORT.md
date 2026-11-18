# BUILD REPORT — Solmar Bay: Neon Heat (v9, round 7)

- **Competition:** gta6-01 "Make GTA 6" — pot $1,666, closes 24 Nov 15:00 UTC.
- **Recording:** r12 (01a1ecd9-f7c5-724e-9c25-bbd3cf580b39), started 2026-11-18T04:11:10Z.
- **Repo:** https://github.com/jackflank4-lang/gta6-01 (public, main).
- **Status:** build complete, verified, committed. NOT pushed, NOT submitted — the parent handles push + submit.

## What was built

A from-scratch rebuild on top of commit 12ff8d1 (round-6 code). Every counted file was deleted and rewritten from the prose brief only; no file under the repo's old code was read. **2,467 counted lines.**

| File | Lines | What it is |
| --- | --- | --- |
| main.ts | 30 | Entry point: copies game/ + screenshots/ to the output dir, builds dossier.json. |
| game/index.html | 38 | Shell + CSS for the HUD and menus. |
| game/src/rng.js | 28 | SplitMix32 deterministic RNG (seed 777). |
| game/src/input.js | 39 | Keyboard state, edge-triggered presses. |
| game/src/audio.js | 211 | Synthesized WebAudio: engine, sirens, horn, impacts, 3 radio stations. |
| game/src/city.js | 498 | 8×8-block dusk city, landmarks, signs, coins, marina, collision. |
| game/src/vehicles.js | 333 | Traffic AI, police pursuit, arcade car handling, damage. |
| game/src/people.js | 312 | Lena, 22 pedestrians, thugs, boss Vic Marino, fist combat. |
| game/src/missions.js | 156 | Five-mission state machine. |
| game/src/hud.js | 162 | Cash / HP / stars / objective / minimap / menus / toasts. |
| game/src/engine.js | 521 | Renderer, loop, state machine, wanted, coins, save/load, camera, debug API. |
| game/src/shots.js | 70 | Deterministic staged scenes for the 4 screenshots. |
| game/src/main.js | 23 | Bootstrap, exposes window.__game and window.__errors. |
| README.md | 45 | Player guide + the three exact make.fun badge lines. |
| shots.json | 1 | Seed-11 shot manifest. |

Kit/starter files untouched: `game/vendor/three.min.js`, `vendor/makefun-game.ts`, `LICENSE`, `serve.ts`. `.makefun/owner.json` unchanged (wallet 5rM8m83Gjp53ACVY6fzE1HJCWeH34wAtb7F2Pxviec2s).

## The game

3D open-world crime game, hero **Lena Cruz** (Barracuda crew) vs boss **Vic Marino (300 HP)**. Seeded 8×8-block city (30 m blocks, 14 m roads), bay/beach/marina south, landmarks: Rosa's Garage, Luna Casino, plaza, Meridian Tower (92 m), Pelican Diner, Barracuda hideout. On foot + driving (E to steal, wanted 0–5 stars + police pursuit), traffic AI (~12 cars + 14 parked), pedestrians (~22), wanted decay, 5 story missions ($350/$550/$450/$750/$5,000 + $150 undamaged bonus on mission 1), 12 neon coins ($40), HUD + circular minimap, start/pause/save (localStorage `solmar-bay-save-v1`), WebAudio synth sound (3 radio tracks), deterministic RNG seed 777, controls WASD/E/F/Space/H/N/C/P/M, low-fx mode (?fx=low), deterministic screenshot staging (?shot=).

## Verification (headless Chromium, file://, SwiftShader, ~2–8 fps, zero console errors)

- **Boot:** clean, zero errors. Menu, cash $200, mission −1, hero at (0, 40).
- **Play test:** walk → steal (wanted 1) → drive 27.5 m/s (~62 MPH) → mission 1 complete, cash **$700** ($200 + $350 + $150 undamaged bonus) → exit, punch, jump peak **1.07 m** → pause → save present in localStorage → resume. Zero errors.
- **Combat probe:** 3 thugs spawned, all punched dead; hero HP 100 → **80**; cash $200 → **$350** (exactly 3 × $50). Zero errors.
- **Mission chain (m1→m5):** m1 $700 → m2 $1,250 (+$550) → m3 $1,900 (+$450 + 4 × $50) → m4 $2,650 (+3 × $250 fares) → m5 **$7,850** (+$5,000 finale + 4 × $50), boss HP 300 at finale start, objective "All missions complete. Solmar Bay is yours, Lena." Zero errors.
- **main.ts double run:** two runs byte-identical (sha256 ea5d6e96f6429f4a0e39816d138867b5549f03eb160f40a864d12f0d7acb713a), dossier 373,469 B, text 88,717 B (< 163,840 cap).
- **Screenshots (1280×720 JPEG, all ≤ 256 KiB, all viewed):** 1-start.jpg 49,733 B, 2-drive.jpg 58,138 B, 3-chase.jpg 49,494 B, 4-mission.jpg 53,813 B. All seed=11.

## Fixes made during testing

1. **onFoot derived state** — the test driver calls `traffic.exitCar()` directly, bypassing the E key, so the hero stayed flagged as driving and punches were refused. `hero.onFoot` is now synced every frame from `!vehicles.playerCar`. Mission 3 then passed.
2. **Cab Hustle double-pay** — fares paid $250 each AND the mission completion bonus paid $750 again. `MISSION_PAY[3]` is now 0 (fares pay $250 each, $750 total). Cash flow now: m4 $2,650, m5 $7,850.
3. **Boot crash from setObjective** — the fix that mirrors the objective into `missions.objective` ran during the Missions constructor, when `game.missions` was still undefined. Guarded; boot clean again.
4. **Chase shot framing** — cruisers first spawned behind the player car (invisible to the chase camera). Now two cruisers flank the red sedan ahead in the next lanes, light bars visible.

## Round-6 lessons applied

- shots.json is seed=11 (differs from v8's seed=9 — verified by content).
- README badge lines are byte-identical to the brief's three lines (owner/repo URLs + bounty links with utm) — verified by scripted comparison.
- No child subagents spawned. No push made. Recorder r12 left untouched and alive throughout.
