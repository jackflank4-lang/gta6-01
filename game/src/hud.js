// HUD, menus and minimap for Solmar Bay — Neon Heat.
// All DOM ids live in index.html; the engine calls these setters.
// The minimap repaints every third frame and draws the city grid, the
// player arrow, mission marker, traffic, cops and enemies.
export const SAVE_KEY = 'solmar-bay-save-v1';

export class Hud {
  constructor(doc) {
    this.doc = doc;
    const $ = (id) => doc.getElementById(id);
    this.el = {
      cash: $('hud-cash'),
      healthBar: $('hud-health-bar'),
      healthText: $('hud-health-text'),
      stars: $('hud-stars'),
      clock: $('hud-clock'),
      speed: $('hud-speed'),
      objective: $('hud-objective'),
      toast: $('hud-toast'),
      station: $('hud-station'),
      minimap: $('minimap'),
      menuStart: $('menu-start'),
      menuPause: $('menu-pause'),
      menuEnd: $('menu-end'),
      endTitle: $('end-title'),
      endText: $('end-text'),
    };
    this.toastTimer = null;
    this.mapCtx = this.el.minimap ? this.el.minimap.getContext('2d') : null;
  }

  setCash(n) {
    if (this.el.cash) this.el.cash.textContent = '$' + Math.floor(n).toLocaleString('en-US');
  }

  setHealth(hp) {
    const v = Math.max(0, Math.min(100, Math.round(hp)));
    if (this.el.healthBar) this.el.healthBar.style.width = v + '%';
    if (this.el.healthText) this.el.healthText.textContent = v;
  }

  setStars(n) {
    if (!this.el.stars) return;
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    this.el.stars.textContent = s;
    this.el.stars.style.color = n > 0 ? '#4dd8ff' : '#888888';
  }

  setClock(totalMinutes) {
    if (!this.el.clock) return;
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = Math.floor(totalMinutes % 60);
    this.el.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  setSpeed(kmh) {
    if (this.el.speed) this.el.speed.textContent = Math.round(kmh) + ' MPH';
  }

  setObjective(text) {
    if (this.el.objective) this.el.objective.textContent = text;
  }

  setStation(name) {
    if (this.el.station) this.el.station.textContent = name;
  }

  toast(msg, ms) {
    if (!this.el.toast) return;
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toast.style.opacity = '0';
    }, ms || 3500);
  }

  showMenu(name) {
    const show = (el, on) => { if (el) el.style.display = on ? 'flex' : 'none'; };
    show(this.el.menuStart, name === 'start');
    show(this.el.menuPause, name === 'pause');
    show(this.el.menuEnd, name === 'end');
  }

  setEnd(title, text) {
    if (this.el.endTitle) this.el.endTitle.textContent = title;
    if (this.el.endText) this.el.endText.textContent = text;
  }

  // --- minimap --------------------------------------------------------
  drawMinimap(view) {
    const ctx = this.mapCtx;
    if (!ctx || !view) return;
    const S = 160;
    const scale = S / 420; // world span -210..210
    const px = (x) => (x + 210) * scale;
    const pz = (z) => (z + 210) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    // Water + land.
    ctx.fillStyle = '#0b3d66';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#23232e';
    ctx.fillRect(0, 0, px(176), S);
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(px(168), 0, px(176) - px(168), S);
    // Roads.
    ctx.strokeStyle = '#4a4a58';
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const v = -176 + i * 44;
      ctx.beginPath(); ctx.moveTo(px(v), 0); ctx.lineTo(px(v), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pz(v)); ctx.lineTo(S, pz(v)); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#6a6a80';
    for (const c of view.colliders) {
      ctx.fillRect(px(c.minX), pz(c.minZ), (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
    }
    // Mission marker (pulsing yellow diamond).
    if (view.marker) {
      const pulse = 4 + Math.sin(performance.now() / 200) * 1.5;
      ctx.fillStyle = '#ffd23a';
      const mx = px(view.marker.x);
      const mz = pz(view.marker.z);
      ctx.beginPath();
      ctx.moveTo(mx, mz - pulse);
      ctx.lineTo(mx + pulse, mz);
      ctx.lineTo(mx, mz + pulse);
      ctx.lineTo(mx - pulse, mz);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic (white), cops (blue), thugs/boss (red).
    ctx.fillStyle = '#ffffff';
    for (const car of view.cars || []) {
      ctx.fillRect(px(car.pos.x) - 1.5, pz(car.pos.z) - 1.5, 3, 3);
    }
    ctx.fillStyle = '#4dd8ff';
    for (const cop of view.cops || []) {
      ctx.beginPath(); ctx.arc(px(cop.pos.x), pz(cop.pos.z), 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff3355';
    for (const t of view.thugs || []) {
      ctx.beginPath(); ctx.arc(px(t.pos.x), pz(t.pos.z), 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (view.boss && view.boss.alive) {
      ctx.beginPath(); ctx.arc(px(view.boss.pos.x), pz(view.boss.pos.z), 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const hx = px(view.hero.x);
    const hz = pz(view.hero.z);
    ctx.save();
    ctx.translate(hx, hz);
    ctx.rotate(-view.hero.heading);
    ctx.fillStyle = '#ff5ce1';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Ring.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- save -----------------------------------------------------------
  static save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  static hasSave() {
    return !!Hud.load();
  }
}
