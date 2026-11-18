// Bootstrap for Solmar Bay — Neon Heat.
// Reads ?shot=, ?seed= and ?fx= from the URL, builds the engine, exposes
// the debug API, and stages a screenshot scene when requested.
import { Engine } from './engine.js';
import { applyShot } from './shots.js';

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String((e && e.message) || e));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push(String((e && e.reason) || e));
});

const params = new URLSearchParams(location.search);
const fxLow = params.get('fx') === 'low';
const worldSeed = parseInt(params.get('seed') || '777', 10);
const shotSeed = parseInt(params.get('shotseed') || params.get('seed') || '9', 10);
const shot = params.get('shot');

const container = document.getElementById('game-container');
const engine = new Engine(container, { fxLow, seed: worldSeed });
window.__game = engine;
window.__shotReady = false;

engine.start();

if (shot) {
  // Let two frames render first, then stage the shot.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        applyShot(engine, shot, shotSeed);
        window.__shotReady = true;
      } catch (err) {
        window.__errors.push('shot: ' + (err && err.message ? err.message : err));
      }
    });
  });
}
