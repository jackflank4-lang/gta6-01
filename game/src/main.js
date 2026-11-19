// Bootstrap for Solmar Bay (v10): reads the query flags (?fx=low for the
// low-effects mode, ?shot=...&seed=... for deterministic screenshot staging)
// and starts the engine. Page errors are collected by the inline script in
// index.html (it runs before this module, so it also catches module load
// errors) into window.__errors.

import { createGame } from './engine.js';

const params = new URLSearchParams(window.location.search);
const fxLow = params.get('fx') === 'low';

if (!window.__errors) window.__errors = [];
if (typeof window.__shotReady === 'undefined') window.__shotReady = false;

createGame({ fxLow });
