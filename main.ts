// Solmar Bay — Neon Heat: the entry program (Node 22, standard library only).
// It hands the game in: copies this repository's game/ and screenshots/ into the
// output directory and writes /output/dossier.json with the vendored make.fun
// library (vendor/makefun-game.ts). The grader runs it twice and both runs must
// write the same bytes; outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output, e.g. `MAKEFUN_OUTPUT_DIR=out node main.ts`.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shotDir = join(repoRoot, 'screenshots');
const gameDir = join(repoRoot, 'game');

function fail(message: string): never {
  throw new Error(`solmar-bay entry: ${message}`);
}

// The gate's caps (competition.yaml, reference/gate.json): at most 4 screenshots
// of at most 256 KiB, at most 993 files and 48 MiB under game/. Refuse early with
// a clear message instead of writing an entry the scorer would refuse.
function checkShots(): void {
  if (!existsSync(shotDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) fail(`need 3 or 4 screenshots, found ${shots.length}`);
  for (const name of shots) {
    const size = statSync(join(shotDir, name)).size;
    if (size > 262144) fail(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
  }
}

function countGameFiles(dir: string): number {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    total += statSync(path).isDirectory() ? countGameFiles(path) : 1;
  }
  return total;
}

checkShots();
if (countGameFiles(gameDir) > 993) fail('game/ holds more than 993 files');

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotDir, join(outDir, 'screenshots'), { recursive: true });

// buildDossier writes the judge's dossier: the game block, every source file in
// load order, and the screenshots. Its text is capped at 160 KiB by the call.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
