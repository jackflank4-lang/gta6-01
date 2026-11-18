// Solmar Bay — Neon Heat: entrypoint (Node 22, standard library only).
// The game itself is the static files under game/ (a desktop browser loads
// them offline: game/index.html and its ES modules, no network request).
// This program hands the entry in: it copies game/ and screenshots/ from
// beside this file into the output directory and writes dossier.json, the
// summary the judge reads, using the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The scorer refuses an entry with more than 4 screenshots, any screenshot
// over 256 KiB, more than 993 files in game/, more than 48 MiB of game
// files, or a game path over 1000 bytes — so this program checks those
// limits itself first and stops with a plain error instead of handing in
// a doomed entry.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, found);
    else found.push(p);
  }
  return found;
}

// Screenshots: 3 or 4, each a JPEG or PNG under 256 KiB.
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) fail('screenshots/ is missing — the game needs 3 or 4 screenshots');
const shots = readdirSync(shotsDir).filter((n) => /\.(jpe?g|png)$/i.test(n)).sort();
if (shots.length < 3 || shots.length > 4) fail(`expected 3 or 4 screenshots, found ${shots.length}`);
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
}

// Game files: under 993 files, under 48 MiB in total, no path over 1000 bytes.
const gameFiles = walk(join(here, 'game'));
if (gameFiles.length > 993) fail(`game/ has ${gameFiles.length} files, over the 993 cap`);
let gameBytes = 0;
for (const f of gameFiles) {
  gameBytes += statSync(f).size;
  if (Buffer.byteLength(f, 'utf8') - Buffer.byteLength(join(here, 'game'), 'utf8') > 1000) {
    fail(`a path under game/ is over 1000 bytes: ${f}`);
  }
}
if (gameBytes > 50331648) fail(`game/ is ${gameBytes} bytes, over the 48 MiB cap`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`main.ts: wrote ${out} — ${gameFiles.length} game files (${gameBytes} bytes), ${shots.length} screenshots`);
