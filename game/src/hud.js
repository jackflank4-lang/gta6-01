// The HUD: cash, health, wanted stars, clock, speed, objective, toasts,
// a circular minimap, and the start / pause menus. All DOM, drawn over
// the canvas. The minimap repaints only every third frame to save time
// on the software renderer.
export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.cashEl = this.el('hud-cash');
    this.hpEl = this.el('hud-hp-fill');
    this.starsEl = this.el('hud-stars');
    this.clockEl = this.el('hud-clock');
    this.speedEl = this.el('hud-speed');
    this.objectiveEl = this.el('hud-objective');
    this.toastEl = this.el('hud-toast');
    this.bannerEl = this.el('hud-banner');
    this.radioEl = this.el('hud-radio');
    this.damageEl = this.el('hud-damage');
    this.map = this.el('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this.frame = 0;
    this.toasts = [];
    this.toastTimer = 0;
    this.bannerTimer = 0;
  }

  setCash(n) {
    if (this.cashEl) this.cashEl.textContent = `$${Math.floor(n)}`;
  }

  setHp(v) {
    if (this.hpEl) this.hpEl.style.width = `${Math.max(0, Math.min(100, v))}%`;
  }

  setStars(n) {
    if (this.starsEl) {
      this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
      this.starsEl.style.color = n > 0 ? '#ff4444' : '#888888';
    }
  }

  setClock(hours) {
    if (!this.clockEl) return;
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours % 1) * 60);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    this.clockEl.textContent = `${hh}:${mm}`;
  }

  setSpeed(mph, inCar) {
    if (this.speedEl) this.speedEl.textContent = inCar ? `${Math.round(mph)} MPH` : '';
  }

  setObjective(text) {
    if (this.objectiveEl) this.objectiveEl.textContent = text;
  }

  setRadio(name) {
    if (this.radioEl) this.radioEl.textContent = name ? `♪ ${name}` : '';
  }

  setDamage(d) {
    if (this.damageEl) this.damageEl.textContent = d > 0 ? `CAR DAMAGE ${Math.round(d)}%` : '';
  }

  toast(msg) {
    this.toasts.push(msg);
    if (this.toasts.length > 3) this.toasts.shift();
    this.toastTimer = 4;
    this.renderToasts();
  }

  renderToasts() {
    if (this.toastEl) this.toastEl.innerHTML = this.toasts.map((t) => `<div>${t}</div>`).join('');
  }

  banner(text) {
    if (!this.bannerEl) return;
    this.bannerEl.textContent = text;
    this.bannerEl.style.opacity = '1';
    this.bannerTimer = 2.5;
  }

  update(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toasts = [];
        this.renderToasts();
      }
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0 && this.bannerEl) this.bannerEl.style.opacity = '0';
    }
  }

  show(screen) {
    // screen: 'menu' | 'playing' | 'paused' | 'wasted' | 'busted'
    const show = (id, on) => {
      const e = this.el(id);
      if (e) e.style.display = on ? 'flex' : 'none';
    };
    show('menu-start', screen === 'menu');
    show('menu-pause', screen === 'paused');
    show('menu-dead', screen === 'wasted' || screen === 'busted');
    const deadTitle = this.el('dead-title');
    if (deadTitle) deadTitle.textContent = screen === 'busted' ? 'BUSTED' : 'WASTED';
    const hud = this.el('hud');
    if (hud) hud.style.display = screen === 'playing' ? 'block' : 'none';
  }

  setContinueVisible(on) {
    const b = this.el('btn-continue');
    if (b) b.style.display = on ? 'block' : 'none';
  }

  setSaveNote(text) {
    const e = this.el('save-note');
    if (e) e.textContent = text;
  }

  // Top-down map: roads, sea, landmarks, player, cars, police, beacon.
  drawMinimap(game) {
    this.frame += 1;
    if (this.frame % 3 !== 0 || !this.mapCtx) return;
    const ctx = this.mapCtx;
    const S = 180;
    const scale = S / 560; // world [-280, 280] -> [0, 180]
    const px = (x) => (x + 280) * scale;
    const pz = (z) => (z + 280) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#1c2b33';
    ctx.fillRect(0, 0, S, S);
    // Sea.
    ctx.fillStyle = '#14486b';
    ctx.fillRect(0, pz(205), S, S - pz(205));
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 4;
    for (const line of game.city.roadLines) {
      ctx.beginPath(); ctx.moveTo(px(line), 0); ctx.lineTo(px(line), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pz(line)); ctx.lineTo(S, pz(line)); ctx.stroke();
    }
    // Landmarks.
    const mark = (x, z, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px(x), pz(z), r, 0, Math.PI * 2); ctx.fill();
    };
    mark(game.city.tower.x, game.city.tower.z, '#ff5a5a', 4);
    mark(game.city.garage.x, game.city.garage.z, '#ffd27a', 3);
    mark(game.city.diner.x, game.city.diner.z, '#7ae0ff', 3);
    mark(game.city.plaza.x, game.city.plaza.z, '#c8b898', 3);
    // Beacon.
    if (game.beacon) {
      const pulse = 3 + Math.sin(game.time * 5) * 1.5;
      mark(game.beacon.x, game.beacon.z, '#ffdd55', pulse);
    }
    // Traffic and police.
    ctx.fillStyle = '#d8d8d8';
    for (const c of game.traffic.moving) {
      ctx.fillRect(px(c.mesh.position.x) - 1, pz(c.mesh.position.z) - 1, 2, 2);
    }
    ctx.fillStyle = '#3355ff';
    for (const c of game.police.cruisers) {
      ctx.fillRect(px(c.mesh.position.x) - 2, pz(c.mesh.position.z) - 2, 4, 4);
    }
    // Thugs.
    ctx.fillStyle = '#ff5555';
    for (const t of game.thugs.list) {
      if (t.down) continue;
      ctx.fillRect(px(t.mesh.position.x) - 2, pz(t.mesh.position.z) - 2, 4, 4);
    }
    // Player: white triangle pointing along heading.
    const p = game.heroPos();
    ctx.save();
    ctx.translate(px(p.x), pz(p.z));
    ctx.rotate(-game.heroHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North is up; the view rotates with the player heading.
  }
}
