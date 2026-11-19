// Solmar Bay — Neon Heat (gta6-01, round 8 / v10.1).
// Tiny static file server for local play-testing only (never part of the
// graded entry — the game itself is plain static files under game/).
// Serves game/ at the root, plus shots.json and screenshots/ from the repo.
//   node serve.ts            (PORT env var, default 8080)
//   http://localhost:8080

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 8080);
const gameRoot = join(repoRoot, 'game');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Map a request path to a file on disk. A leading /shots.json or
// /screenshots/... reads from the repo root; everything else reads from
// game/ (so /index.html is game/index.html). Paths that climb out of their
// root are refused.
function resolveFile(urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  let base = gameRoot;
  let rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  if (rel === 'shots.json' || rel.startsWith('screenshots' + sep) || rel.startsWith('screenshots/')) {
    base = repoRoot;
  }
  const file = resolve(base, rel);
  if (!file.startsWith(base + sep) && file !== base) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

const server = createServer((req, res) => {
  const file = resolveFile(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`Solmar Bay — Neon Heat at http://localhost:${port} (serving ${gameRoot})`);
});
