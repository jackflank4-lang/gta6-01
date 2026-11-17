// Solmar Bay — Neon Heat: the entry program (Node 22, standard library
// only). It hands the game in: it copies game/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library. Before copying it
// validates the screenshots the way the gate will (3 or 4 images, each a
// whole PNG or JPEG of at most 256 KiB), so a bad capture fails loudly
// here instead of silently at grading time.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(msg) {
  throw new Error(`main.ts: ${msg}`);
}

// The screenshots the gate accepts: 3 or 4 files, each a whole PNG or
// JPEG of at most 256 KiB. A JPEG starts FF D8 FF, a PNG starts with the
// 8-byte PNG signature; anything else is not a whole image.
function validateScreenshots(dir) {
  if (!existsSync(dir)) fail('screenshots/ is missing');
  const names = readdirSync(dir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (names.length < 3 || names.length > 4) {
    fail(`screenshots/ holds ${names.length} images, need 3 or 4`);
  }
  for (const name of names) {
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(name) || name.startsWith('-')) {
      fail(`screenshot name not allowed: ${name}`);
    }
    const path = join(dir, name);
    if (!statSync(path).isFile()) fail(`screenshot is not a file: ${name}`);
    const buf = readFileSync(path);
    if (buf.length > 262144) fail(`screenshot over 256 KiB: ${name}`);
    const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng = buf.length > 8
      && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
    if (!isJpeg && !isPng) fail(`screenshot is not a whole PNG or JPEG: ${name}`);
  }
  return names;
}

const shots = validateScreenshots(join(here, 'screenshots'));

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes: game/
// counts beside /output's own 1000-entry cap, its screenshots/ and
// dossier.json).
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
console.log(`Solmar Bay handed in: ${shots.length} screenshots (${shots.join(', ')})`);
