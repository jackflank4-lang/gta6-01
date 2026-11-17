// Solmar Bay bootstrap: collect page errors for the test driver, build
// the game, and apply screenshot staging when asked (?shot=start|drive|
// chase|mission). The game object is exposed as window.__game with the
// debug API the driver uses.
import { Game } from './engine.js';
import { stageShot } from './shots.js';

window.__errors = [];
window.__shotReady = false;
window.addEventListener('error', (e) => {
  window.__errors.push(`ERROR: ${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push(`REJECTION: ${String(e.reason).slice(0, 200)}`);
});

const params = new URLSearchParams(location.search);
const lowFx = params.get('fx') === 'low';
const canvas = document.getElementById('game-canvas');
const game = new Game(canvas, { lowFx });
window.__game = game;

const shot = params.get('shot');
if (shot) {
  try {
    stageShot(game, shot);
  } catch (err) {
    window.__errors.push(`STAGE-ERROR: ${String(err).slice(0, 200)}`);
  }
  // Let a few frames render before the driver captures.
  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames >= 45) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
