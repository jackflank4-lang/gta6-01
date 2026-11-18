// main.js — bootstrap for Solmar Bay.
// Exposes window.__game (the engine) and window.__errors (every page
// error, so the test driver can fail loudly on any exception).
import { Game } from './engine.js';

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error || 'unknown error'));
});
const _consoleError = console.error.bind(console);
console.error = (...args) => {
  window.__errors.push(args.map((a) => String(a)).join(' '));
  _consoleError(...args);
};

try {
  const game = new Game();
  window.__game = game;
  window.__shotReady = false;
} catch (err) {
  window.__errors.push('boot failed: ' + String(err && err.message ? err.message : err));
  throw err;
}
