// Solmar Bay — Neon Heat (gta6-01 entry, rebuild r2, Node 22, stdlib only).
//
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html plus its classic scripts, three.js
// vendored under game/vendor/, no network request at runtime). This program
// hands the entry in: it copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads,
// through the vendored make.fun library.
//
// The game itself: a 3D open-world crime game — a procedural city with
// plazas, traffic lights and neon billboards; on-foot and driving play with
// three camera modes; traffic that honks and overtakes, pedestrians, foot
// cops and police cars under a 0–5 wanted level; car damage with Chop Shop
// repair; 5 story missions; punch + pistol combat; a HUD with minimap,
// damage bar, coin counter and dusk clock; start / pause / save; and
// synthesised WebAudio sound with a two-track radio. Screenshots live in
// screenshots/ (the first by name is the cover).
//
// Serve it locally with `node serve.ts`, then open the printed local address.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Resolve the entry directory (this file's folder) and the output directory.
const entryDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(entryDir, 'game');
const shotsDir = join(entryDir, 'screenshots');

function stage() {
  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

function writeDossier() {
  // The scorer's own caps (reference/gate.json): only text_max_bytes shapes
  // the bytes; the others refuse an entry the scorer would refuse — more
  // than 4 screenshots or one over 256 KiB; more than 993 files in game/ or
  // 48 MiB of game files in all, or a path under game/ over 1000 bytes
  // (game/ counts beside /output's own 1000-entry cap, its screenshots/
  // and dossier.json).
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

stage();
writeDossier();
