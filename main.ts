// Solmar Bay — Neon Heat (gta6-01, round 8 / v10.1).
// Entry program (Node 22, standard library only). It hands the game in:
//   * copies game/ and screenshots/ from this repository into the output dir
//   * writes /output/dossier.json with the kit's buildDossier library
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

function fail(message: string): never {
  throw new Error(`gta6-01 main.ts: ${message}`);
}

// The game itself must exist, and so must at least one screenshot: the
// gate refuses an entry whose screenshots/ folder is empty or missing.
if (!existsSync(gameDir)) fail('game/ is missing from the repository');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(shotsDir)) fail('screenshots/ is missing from the repository');
const shotFiles = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
if (shotFiles.length === 0) fail('screenshots/ holds no screenshots');
if (shotFiles.length > 4) fail(`screenshots/ holds ${shotFiles.length} files, at most 4 allowed`);

mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

// The sealed scorer's own caps (reference/gate.json). Only text_max_bytes
// shapes the dossier's bytes; the other caps refuse an entry the scorer
// would refuse anyway (a screenshot over 256 KiB, more than 993 files in
// game/, or a game/ path over 1,000 bytes).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`gta6-01: wrote ${shotFiles.length} screenshot(s) and dossier.json to ${outputDir}`);
