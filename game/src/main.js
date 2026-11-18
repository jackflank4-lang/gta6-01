// Solmar Bay — Neon Heat: bootstrap.
// Loads the engine, starts it, and stages a screenshot when the page is
// opened with ?shot=<name>&seed=<n> (the test driver does this).
// Query params: shot=start|drive|chase|mission, seed (default 1),
// fx=low (software-renderer friendly: no shadows, capped pixel ratio).
import { createGame } from './engine.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const fxLow = params.get('fx') === 'low';
const shot = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;

window.__errors = [];
window.__shotReady = false;
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error || 'unknown error'));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push(String((e.reason && e.reason.message) || e.reason || 'unhandled rejection'));
});

const canvas = document.getElementById('game');
const game = createGame(canvas, { fxLow });
game.start();

if (shot) {
  stageShot(game, shot, seed)
    .catch((e) => {
      window.__errors.push(String((e && e.message) || e));
      window.__shotReady = true;
    });
}
