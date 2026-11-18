// Solmar Bay — Neon Heat: build entrypoint for make.fun (gta6-01).
// Copies game/ and screenshots/ into the output dir (default /output, or
// MAKEFUN_OUTPUT_DIR outside the grader), validates the screenshots, and
// writes dossier.json via the vendored buildDossier helper.
// Node 22, stdlib only. Two runs on the same inputs are byte-identical:
// files are copied in sorted order and the dossier is deterministic.
import { buildDossier } from './vendor/makefun-game.ts';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const ROOT = resolve(import.meta.dirname || '.');

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p));
    else if (st.isFile()) out.push(p);
  }
  return out;
}

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    const s = join(src, name);
    const d = join(dst, name);
    const st = statSync(s);
    if (st.isDirectory()) copyTree(s, d);
    else if (st.isFile()) copyFileSync(s, d);
  }
}

// JPEG: scan markers for a Start-Of-Frame segment and read its dimensions.
// PNG: read width/height from the IHDR chunk.
function imageSize(buf, file) {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: 'png' };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), fmt: 'jpeg' };
      }
      i += 2 + len;
    }
    throw new Error(file + ': could not parse JPEG dimensions');
  }
  throw new Error(file + ': not a JPEG or PNG');
}

function validateScreenshots(dir) {
  const files = listFiles(dir).sort();
  if (files.length < 3 || files.length > CAPS.screenshots.max) {
    throw new Error('expected 3-4 screenshots, found ' + files.length);
  }
  for (const f of files) {
    const buf = readFileSync(f);
    if (buf.length > CAPS.screenshots.max_bytes) {
      throw new Error(f + ': ' + buf.length + ' bytes exceeds ' + CAPS.screenshots.max_bytes);
    }
    const { w, h, fmt } = imageSize(buf, f);
    if (Math.max(w, h) > 1280 || Math.min(w, h) < 480) {
      throw new Error(f + ': unexpected size ' + w + 'x' + h);
    }
    console.log('screenshot ok:', f.split('/').pop(), fmt, w + 'x' + h, buf.length + ' B');
  }
}

function main() {
  const gameSrc = join(ROOT, 'game');
  const shotsSrc = join(ROOT, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('game/ not found in ' + ROOT);
  if (!existsSync(shotsSrc)) throw new Error('screenshots/ not found in ' + ROOT);

  mkdirSync(OUT, { recursive: true });
  copyTree(gameSrc, join(OUT, 'game'));
  copyTree(shotsSrc, join(OUT, 'screenshots'));
  validateScreenshots(join(OUT, 'screenshots'));

  const dossier = buildDossier(OUT, CAPS); // returns canonical JSON bytes
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  const d = JSON.parse(new TextDecoder().decode(dossier));
  console.log('dossier written:', join(OUT, 'dossier.json'), dossier.length + ' B');
  console.log('screenshots:', d.images.length, 'text bytes:', Buffer.byteLength(d.text, 'utf8'));
  console.log('Solmar Bay — Neon Heat: build OK');
}

main();
