// HUD: cash/health/stars/clock/speed/objective/toast, the circular minimap
// (repainted only every third frame), and the menu / pause / end overlays.
// All DOM writes live here so the engine never touches element ids.

const MAP_SIZE = 170;
const WORLD = 400; // world span shown on the minimap (-200..200)

export class Hud {
  constructor(callbacks) {
    this.cb = callbacks; // { onStart(fresh), onResume, onQuitToMenu, onRespawn }
    this.el = {};
    for (const id of ['hud-cash', 'hud-health-fill', 'hud-clock', 'hud-day', 'hud-stars',
      'hud-objective', 'hud-toast', 'hud-speed', 'hud-radio', 'hud-minimap', 'hud-hint',
      'hud-damage', 'menu-overlay', 'pause-overlay', 'end-overlay', 'end-title', 'end-text',
      'pause-save-note', 'menu-start', 'menu-continue', 'pause-resume', 'pause-menu', 'end-respawn']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = this.el['hud-minimap'].getContext('2d');
    this.frame = 0;
    this.toastTimer = 0;
    this.damageFlash = 0;

    this.el['menu-start'].addEventListener('click', () => this.cb.onStart(false));
    this.el['menu-continue'].addEventListener('click', () => this.cb.onStart(true));
    this.el['pause-resume'].addEventListener('click', () => this.cb.onResume());
    this.el['pause-menu'].addEventListener('click', () => this.cb.onQuitToMenu());
    this.el['end-respawn'].addEventListener('click', () => this.cb.onRespawn());
  }

  showMenu(hasSave) {
    this.el['menu-overlay'].classList.remove('hidden');
    this.el['pause-overlay'].classList.add('hidden');
    this.el['end-overlay'].classList.add('hidden');
    this.el['menu-continue'].style.display = hasSave ? 'inline-block' : 'none';
  }

  showPause(saveText) {
    this.el['pause-overlay'].classList.remove('hidden');
    this.el['pause-save-note'].textContent = saveText;
  }

  hidePause() {
    this.el['pause-overlay'].classList.add('hidden');
  }

  showEnd(kind, text) {
    const title = this.el['end-title'];
    title.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    title.className = kind;
    this.el['end-text'].textContent = text;
    this.el['end-overlay'].classList.remove('hidden');
  }

  hideEnd() {
    this.el['end-overlay'].classList.add('hidden');
  }

  hideMenu() {
    this.el['menu-overlay'].classList.add('hidden');
  }

  toast(message, seconds = 2.6) {
    const t = this.el['hud-toast'];
    t.textContent = message;
    t.style.opacity = '1';
    this.toastTimer = seconds;
  }

  flashDamage() {
    this.damageFlash = 0.9;
  }

  // state: { cash, health, wanted, clock, day, speedKmh, inCar, objective,
  //   radio, player, marker, police, thugs, spots, coins }
  update(dt, state) {
    this.frame++;
    this.el['hud-cash'].textContent = `$${Math.floor(state.cash)}`;
    this.el['hud-health-fill'].style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    this.el['hud-clock'].textContent = state.clock;
    this.el['hud-day'].textContent = `SOLMAR BAY · DAY ${state.day}`;
    this.el['hud-stars'].textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    this.el['hud-objective'].textContent = state.objective;
    this.el['hud-radio'].textContent = `RADIO: ${state.radio}`;
    const speed = this.el['hud-speed'];
    if (state.inCar) {
      speed.style.display = 'block';
      speed.innerHTML = `${Math.round(state.speedKmh)} <small>km/h</small>`;
    } else {
      speed.style.display = 'none';
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el['hud-toast'].style.opacity = '0';
    }
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
      this.el['hud-damage'].style.opacity = String(this.damageFlash);
    }
    // The minimap repaints only every third frame (cheap on weak machines).
    if (this.frame % 3 === 0) this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.minimap;
    const toMap = (x, z) => [((x + 200) / WORLD) * MAP_SIZE, ((z + 200) / WORLD) * MAP_SIZE];
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    // Water west, land east.
    ctx.fillStyle = '#0d2036';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#232838';
    const [lx] = toMap(-183, 0);
    ctx.fillRect(lx, 0, MAP_SIZE - lx, MAP_SIZE);
    // Roads.
    ctx.strokeStyle = '#4a5068';
    ctx.lineWidth = 3;
    for (let k = 0; k <= 8; k++) {
      const line = -176 + k * 44;
      const [px] = toMap(line, 0);
      const [, pz] = toMap(0, line);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, MAP_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pz); ctx.lineTo(MAP_SIZE, pz); ctx.stroke();
    }
    // Landmarks.
    const dots = [
      [state.spots.tower, '#ff5da2'], [state.spots.casino, '#ff9de2'],
      [state.spots.garage, '#ffd23e'], [state.spots.diner, '#37e0ff'],
      [state.spots.hideout, '#c9a0ff'], [state.spots.plaza, '#7dff9e'],
    ];
    for (const [spot, color] of dots) {
      const [mx, mz] = toMap(spot.x, spot.z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, mz, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Coins.
    ctx.fillStyle = '#ffd23e';
    for (const coin of state.coins) {
      if (coin.taken) continue;
      const [mx, mz] = toMap(coin.x, coin.z);
      ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
    }
    // Police cruisers.
    ctx.fillStyle = '#5da2ff';
    for (const cop of state.police) {
      const [mx, mz] = toMap(cop.x, cop.z);
      ctx.beginPath(); ctx.arc(mx, mz, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    // Mission marker (pulsing).
    if (state.marker) {
      const [mx, mz] = toMap(state.marker.x, state.marker.z);
      const pulse = 4 + Math.sin(this.frame * 0.15) * 1.6;
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, mz, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(mx, mz, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow, rotated to the heading.
    const [px, pz] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(state.player.heading), Math.cos(state.player.heading)) * -1 + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(-4.4, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
}
