// Solmar Bay — Neon Heat: bootstrap. Creates the game, collects every error
// the page reports (the test driver reads window.__errors), and stages a
// screenshot scene when the URL asks for one (?shot=start|drive|chase|mission).
// With no query, the title menu opens and the player starts from there.

import { Game } from './engine.js';
import { stageShot } from './shots.js';

window.__errors = [];
window.__shotReady = false;

window.addEventListener('error', (event) => {
  window.__errors.push(`error: ${event.message} @ ${event.filename}:${event.lineno}`);
});
window.addEventListener('unhandledrejection', (event) => {
  window.__errors.push(`rejection: ${event.reason}`);
});
const nativeConsoleError = console.error.bind(console);
console.error = (...args) => {
  window.__errors.push(`console.error: ${args.map(String).join(' ')}`);
  nativeConsoleError(...args);
};

const game = new Game();
window.__game = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(game, shot);
} else {
  game.hud.showStart(game.hasSave());
}

game.loop();
