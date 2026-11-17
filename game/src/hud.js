// HUD for Solmar Bay: DOM readouts (cash, health, wanted stars, clock,
// speed, objective, toasts), a circular 2D minimap repainted every third
// frame, and the start / pause menus. The engine calls the setters; the
// minimap draws from the world each call but skips two of three frames.
import { ROAD_LINES } from './city.js';

export class Hud {
  constructor(callbacks) {
    this.cb = callbacks;
    this.frame = 0;
    this.el = {};
    for (const id of ['cash', 'health-fill', 'health-text', 'stars', 'clock', 'speed', 'objective', 'toast', 'menu', 'pause-menu', 'btn-start', 'btn-continue', 'btn-resume', 'btn-quit', 'save-note', 'minimap', 'menu-title']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.el['btn-start'].addEventListener('click', () => this.cb.onStart());
    this.el['btn-continue'].addEventListener('click', () => this.cb.onContinue());
    this.el['btn-resume'].addEventListener('click', () => this.cb.onResume());
    this.el['btn-quit'].addEventListener('click', () => this.cb.onQuit());
    this._toastTimer = 0;
  }

  setCash(n) { this.el.cash.textContent = '$' + Math.floor(n).toLocaleString('en-US'); }
  setHealth(hp) {
    const pct = Math.max(0, Math.min(100, hp));
    this.el['health-fill'].style.width = pct + '%';
    this.el['health-text'].textContent = Math.ceil(pct);
  }
  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i += 1) s += i < n ? '★' : '☆';
    this.el.stars.textContent = s;
    this.el.stars.className = n > 0 ? 'hot' : '';
  }
  setClock(seconds) {
    // Dusk clock: starts 19:00, one game hour per 300 real seconds.
    const total = 19 * 3600 + seconds;
    const h = Math.floor(total / 3600) % 24;
    const m = Math.floor((total % 3600) / 60);
    this.el.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  setSpeed(mph, driving) {
    this.el.speed.textContent = driving ? Math.round(mph) + ' MPH' : '';
  }
  setObjective(text) { this.el.objective.textContent = text; }

  toast(msg, ms) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), ms || 3200);
  }

  showMenu(saveExists) {
    this.el.menu.classList.remove('hidden');
    this.el['btn-continue'].style.display = saveExists ? '' : 'none';
    this.el['save-note'].textContent = saveExists ? 'Saved game found — Continue picks up where you left off.' : 'No saved game yet.';
  }
  hideMenu() { this.el.menu.classList.add('hidden'); }
  showPause() { this.el['pause-menu'].classList.remove('hidden'); }
  hidePause() { this.el['pause-menu'].classList.add('hidden'); }

  drawMinimap(world) {
    this.frame += 1;
    if (this.frame % 3 !== 0) return;
    const ctx = this.mapCtx;
    const S = 160;
    const toPx = (v) => ((v + 210) / 420) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, S, S);
    // Roads.
    ctx.strokeStyle = '#3a3f4d';
    ctx.lineWidth = 5;
    for (const c of ROAD_LINES) {
      ctx.beginPath(); ctx.moveTo(toPx(c), 0); ctx.lineTo(toPx(c), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toPx(c)); ctx.lineTo(S, toPx(c)); ctx.stroke();
    }
    // Water.
    ctx.fillStyle = '#0d3247';
    ctx.fillRect(0, toPx(196), S, S - toPx(196));
    // Coins.
    ctx.fillStyle = '#ffd24a';
    for (const c of world.coins) {
      if (c.taken) continue;
      ctx.beginPath(); ctx.arc(toPx(c.x), toPx(c.z), 2, 0, Math.PI * 2); ctx.fill();
    }
    // Mission marker (pulsing).
    if (world.marker) {
      const pulse = 3 + Math.sin(this.frame * 0.15) * 1.5;
      ctx.fillStyle = '#ffdd33';
      ctx.beginPath(); ctx.arc(toPx(world.marker.x), toPx(world.marker.z), pulse + 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffdd33';
      ctx.beginPath(); ctx.arc(toPx(world.marker.x), toPx(world.marker.z), pulse + 5, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic (grey) and police (blue).
    ctx.fillStyle = '#9aa5b5';
    for (const car of world.traffic) {
      ctx.fillRect(toPx(car.x) - 1.5, toPx(car.z) - 1.5, 3, 3);
    }
    ctx.fillStyle = '#3a7bff';
    for (const car of world.cruisers) {
      ctx.beginPath(); ctx.arc(toPx(car.x), toPx(car.z), 3, 0, Math.PI * 2); ctx.fill();
    }
    // Hero (white, with heading tick).
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(toPx(world.hero.x), toPx(world.hero.z), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(toPx(world.hero.x), toPx(world.hero.z));
    ctx.lineTo(toPx(world.hero.x + Math.sin(world.hero.heading) * 8), toPx(world.hero.z + Math.cos(world.hero.heading) * 8));
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  }
}
