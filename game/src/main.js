// Bootstrap for Solmar Bay. Collects page errors into window.__errors (the
// test driver reads it), parses the query string (?shot=, ?fx=low) and
// starts the engine, exposing it as window.__game for the driver and the
// debug hooks.
import { Engine } from './engine.js';

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error || 'error'));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__errors.push('rejection: ' + String((e.reason && e.reason.message) || e.reason || ''));
});

const params = new URLSearchParams(window.location.search);
const lowFx = params.get('fx') === 'low';
const shot = params.get('shot') || null;

const canvas = document.getElementById('game');
const engine = new Engine(canvas, { lowFx, shot });
window.__game = engine;
