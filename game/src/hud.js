// hud.js — DOM overlay: cash, health, wanted stars, objective line,
// speed, radio station, minimap and the menu screens.
// All elements are created here so index.html stays a thin shell.
// The engine drives it through setCash/setHealth/setStars/setObjective
// and hud.update(game) once per frame (minimap throttled to ~7 fps).
function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export class Hud {
  constructor() {
    this.root = el('div', 'hud', document.body);
    this.topLeft = el('div', 'hud-topleft', this.root);
    this.cashEl = el('div', 'hud-cash', this.topLeft, '$200');
    this.hpWrap = el('div', 'hud-hpwrap', this.topLeft);
    this.hpEl = el('div', 'hud-hp', this.hpWrap);
    this.starsEl = el('div', 'hud-stars', this.topLeft, '');
    this.objectiveEl = el('div', 'hud-objective', this.root, '');
    this.speedEl = el('div', 'hud-speed', this.root, '');
    this.radioEl = el('div', 'hud-radio', this.root, '');
    this.mapCanvas = el('canvas', 'hud-map', this.root);
    this.mapCanvas.width = 180;
    this.mapCanvas.height = 180;
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.toastEl = el('div', 'hud-toasts', this.root);
    this._mapT = 0;
    this._buildMenus();
  }

  _buildMenus() {
    // Start menu.
    this.menuEl = el('div', 'menu', document.body);
    el('h1', 'menu-title', this.menuEl, 'SOLMAR BAY');
    el('div', 'menu-sub', this.menuEl, '— NEON HEAT —');
    el('p', 'menu-desc', this.menuEl, 'Lena Cruz. The Barracuda crew. Five jobs between you and Vic Marino. Steal a car, run the city, take the bay.');
    this.btnStart = el('button', 'menu-btn', this.menuEl, 'NEW GAME');
    this.btnStart.id = 'btn-start';
    this.btnContinue = el('button', 'menu-btn', this.menuEl, 'CONTINUE');
    this.btnContinue.id = 'btn-continue';
    this.btnHowto = el('button', 'menu-btn', this.menuEl, 'HOW TO PLAY');
    this.btnHowto.id = 'btn-howto';
    this.howtoEl = el('div', 'menu-howto', this.menuEl,
      'WASD drive / walk · Shift run · E enter & exit car · F punch · Space jump · H horn · N radio · C camera · P pause · M mute');
    this.howtoEl.style.display = 'none';
    el('p', 'menu-foot', this.menuEl, 'A fan-made tribute. Not affiliated with Rockstar Games.');
    // Pause menu.
    this.pauseEl = el('div', 'menu', document.body);
    el('h1', 'menu-title', this.pauseEl, 'PAUSED');
    el('p', 'menu-desc', this.pauseEl, 'Progress auto-saves when you pause.');
    this.btnResume = el('button', 'menu-btn', this.pauseEl, 'RESUME');
    this.btnResume.id = 'btn-resume';
    this.btnRestart = el('button', 'menu-btn', this.pauseEl, 'RESTART STORY');
    this.btnRestart.id = 'btn-restart';
    this.btnQuit = el('button', 'menu-btn', this.pauseEl, 'QUIT TO MENU');
    this.btnQuit.id = 'btn-quit';
    // Wasted / busted / complete overlay.
    this.endEl = el('div', 'menu', document.body);
    this.endTitle = el('h1', 'menu-title', this.endEl, 'WASTED');
    this.endDesc = el('p', 'menu-desc', this.endEl, '');
    this.btnRetry = el('button', 'menu-btn', this.endEl, 'TRY AGAIN');
    this.btnRetry.id = 'btn-retry';
    this.showMenu('menu');
  }

  showMenu(which) {
    // which: 'menu' | 'playing' | 'paused' | 'wasted' | 'busted' | 'complete'
    this.menuEl.style.display = which === 'menu' ? 'flex' : 'none';
    this.pauseEl.style.display = which === 'paused' ? 'flex' : 'none';
    this.endEl.style.display = ['wasted', 'busted', 'complete'].includes(which) ? 'flex' : 'none';
    this.root.style.display = which === 'playing' ? 'block' : 'none';
    if (which === 'wasted') { this.endTitle.textContent = 'WASTED'; this.endDesc.textContent = 'Lena got knocked out. The crew is still waiting.'; }
    if (which === 'busted') { this.endTitle.textContent = 'BUSTED'; this.endDesc.textContent = 'The Solmar Bay PD took you in. Bail is $200.'; }
    if (which === 'complete') { this.endTitle.textContent = 'SOLMAR BAY IS YOURS'; this.endDesc.textContent = 'All five missions complete. Vic Marino is finished.'; }
  }

  setCash(n) { this.cashEl.textContent = '$' + Math.floor(n).toLocaleString('en-US'); }
  setHealth(hp) {
    this.hpEl.style.width = Math.max(0, Math.min(100, hp)) + '%';
    this.hpEl.style.background = hp > 50 ? '#35d07a' : hp > 25 ? '#f5a623' : '#e04040';
  }
  setStars(n) {
    this.starsEl.textContent = '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, n)));
    this.starsEl.style.color = n > 0 ? '#ffd24a' : '#555';
  }
  setObjective(text) { this.objectiveEl.textContent = text; }
  setSpeed(mph) { this.speedEl.textContent = mph > 0.5 ? Math.round(mph) + ' MPH' : ''; }
  setRadio(name) { this.radioEl.textContent = name ? '♪ ' + name : ''; }
  toast(text) {
    const t = el('div', 'hud-toast', this.toastEl, text);
    setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 600); }, 3400);
  }

  update(game, dt) {
    this._mapT += dt;
    if (this._mapT < 0.15) return;
    this._mapT = 0;
    const ctx = this.mapCtx;
    const S = 180;
    const W2S = (x, z) => [((x + 200) / 440) * S, ((z + 200) / 440) * S];
    ctx.fillStyle = '#12101c';
    ctx.fillRect(0, 0, S, S);
    // Water strip (south).
    ctx.fillStyle = '#144a7a';
    ctx.fillRect(0, ((176 + 200) / 440) * S, S, S - ((176 + 200) / 440) * S);
    // Roads.
    ctx.strokeStyle = '#3a3444';
    ctx.lineWidth = 4;
    for (const r of [-176, -132, -88, -44, 0, 44, 88, 132, 176]) {
      const [x1] = W2S(r, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      const [, y1] = W2S(0, r);
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(S, y1); ctx.stroke();
    }
    // Mission target blip.
    const target = game.missionTarget && game.missionTarget();
    if (target) {
      const [tx, ty] = W2S(target.x, target.z);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(tx, ty, 8 + Math.sin(performance.now() / 200) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // Cars.
    ctx.fillStyle = '#9aa0b0';
    for (const c of game.vehicles.cars) {
      const [x, y] = W2S(c.pos.x, c.pos.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Cruisers.
    ctx.fillStyle = '#4a80ff';
    for (const c of game.vehicles.cruisers) {
      const [x, y] = W2S(c.pos.x, c.pos.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Enemies.
    ctx.fillStyle = '#ff4040';
    for (const t of game.people.thugs) {
      const [x, y] = W2S(t.pos.x, t.pos.z);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (game.people.boss) {
      const [x, y] = W2S(game.people.boss.pos.x, game.people.boss.pos.z);
      ctx.fillStyle = '#ff2020';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const hero = game.people.hero;
    const [px, py] = W2S(hero.pos.x, hero.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(hero.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
