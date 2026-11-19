// HUD for Solmar Bay (v10): cash, health, wanted stars, clock, speed,
// objective, toasts, a circular minimap, and the start/pause/end menus.
// DOM updates are cached so unchanged values never touch the DOM.

export function createHud(game) {
  const $ = (id) => document.getElementById(id);
  const el = {
    cash: $('hud-cash'),
    healthFill: $('hud-health-fill'),
    healthText: $('hud-health-text'),
    stars: $('hud-stars'),
    clock: $('hud-clock'),
    objective: $('hud-objective'),
    speed: $('hud-speed'),
    toast: $('hud-toast'),
    minimap: $('minimap'),
    menu: $('menu'),
    pauseMenu: $('pause-menu'),
    endOverlay: $('end-overlay'),
    endTitle: $('end-title'),
    endText: $('end-text'),
    saveNote: $('menu-save-note'),
    radio: $('hud-radio'),
    camera: $('hud-camera'),
    btnContinue: $('btn-continue'),
  };
  const mm = el.minimap ? el.minimap.getContext('2d') : null;
  const last = { cash: -1, health: -1, stars: -1, clock: '', objective: '', speed: -1, radio: '', camera: '' };
  const toasts = [];

  function starText(n) {
    let s = '';
    for (let i = 0; i < 5; i += 1) s += i < n ? '★' : '☆';
    return s;
  }

  function update() {
    if (el.cash && game.cash !== last.cash) {
      el.cash.textContent = `$${game.cash}`;
      last.cash = game.cash;
    }
    if (el.healthFill && game.health !== last.health) {
      const h = Math.max(0, Math.min(100, game.health));
      el.healthFill.style.width = `${h}%`;
      el.healthFill.style.background = h > 50 ? '#37d67a' : (h > 25 ? '#f2c200' : '#e23a3a');
      if (el.healthText) el.healthText.textContent = `${Math.round(h)}`;
      last.health = game.health;
    }
    if (el.stars && game.wanted !== last.stars) {
      el.stars.textContent = starText(game.wanted);
      el.stars.style.color = game.wanted > 0 ? '#ffd24a' : '#888';
      last.stars = game.wanted;
    }
    const clockStr = game.clockText();
    if (el.clock && clockStr !== last.clock) {
      el.clock.textContent = clockStr;
      last.clock = clockStr;
    }
    const obj = game.missions.objective();
    if (el.objective && obj !== last.objective) {
      el.objective.textContent = obj;
      last.objective = obj;
    }
    const kmh = Math.round(Math.abs(game.speedKmh()));
    if (el.speed && kmh !== last.speed) {
      el.speed.textContent = game.vehicles.playerCar ? `${kmh} km/h` : '';
      last.speed = kmh;
    }
    if (el.radio && game.audio.stationName() !== last.radio) {
      el.radio.textContent = `♪ ${game.audio.stationName()}`;
      last.radio = game.audio.stationName();
    }
    if (el.camera && game.cameraModeName() !== last.camera) {
      el.camera.textContent = `CAM ${game.cameraModeName()}`;
      last.camera = game.cameraModeName();
    }
  }

  function toast(msg) {
    if (!el.toast) return;
    const div = document.createElement('div');
    div.className = 'toast-item';
    div.textContent = msg;
    el.toast.appendChild(div);
    toasts.push(div);
    while (toasts.length > 3) {
      const old = toasts.shift();
      if (old.parentNode) old.parentNode.removeChild(old);
    }
    window.setTimeout(() => {
      div.classList.add('toast-fade');
      window.setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
        const i = toasts.indexOf(div);
        if (i >= 0) toasts.splice(i, 1);
      }, 600);
    }, 3200);
  }

  function showMenu(name) {
    if (el.menu) el.menu.style.display = name === 'start' ? 'flex' : 'none';
    if (el.pauseMenu) el.pauseMenu.style.display = name === 'pause' ? 'flex' : 'none';
    if (el.endOverlay) el.endOverlay.style.display = name === 'end' ? 'flex' : 'none';
  }

  function setEnd(title, text) {
    if (el.endTitle) el.endTitle.textContent = title;
    if (el.endText) el.endText.textContent = text;
  }

  function setSaveNote(text, showContinue) {
    if (el.saveNote) el.saveNote.textContent = text || '';
    if (el.btnContinue) el.btnContinue.style.display = showContinue ? 'inline-block' : 'none';
  }

  // Minimap: 180x180 canvas, world -210..210 mapped to the canvas.
  const ROADS = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
  function drawMinimap() {
    if (!mm) return;
    const S = 180 / 420;
    const X = (mx) => (mx + 210) * S;
    const Z = (mz) => (mz + 210) * S;
    mm.clearRect(0, 0, 180, 180);
    mm.fillStyle = '#12141d';
    mm.fillRect(0, 0, 180, 180);
    // Water + beach (south).
    mm.fillStyle = '#0e3a5a';
    mm.fillRect(0, Z(205), 180, 180 - Z(205));
    mm.fillStyle = '#8a744a';
    mm.fillRect(0, Z(176), 180, Z(205) - Z(176));
    // Roads.
    mm.strokeStyle = '#3a3f52';
    mm.lineWidth = 5;
    for (const r of ROADS) {
      mm.beginPath(); mm.moveTo(X(r), 0); mm.lineTo(X(r), 180); mm.stroke();
      mm.beginPath(); mm.moveTo(0, Z(r)); mm.lineTo(180, Z(r)); mm.stroke();
    }
    // Park + plaza.
    mm.fillStyle = '#1e5a2e';
    mm.fillRect(X(-37), Z(7), 30 * S, 30 * S);
    mm.fillStyle = '#6b6252';
    mm.fillRect(X(7), Z(7), 30 * S, 30 * S);
    // Coins.
    mm.fillStyle = '#ffd24a';
    for (const c of game.coins) {
      if (c.taken) continue;
      mm.beginPath();
      mm.arc(X(c.pos.x), Z(c.pos.z), 2.2, 0, Math.PI * 2);
      mm.fill();
    }
    // Police.
    mm.fillStyle = '#ff3344';
    for (const p of game.vehicles.police) {
      mm.beginPath();
      mm.arc(X(p.mesh.position.x), Z(p.mesh.position.z), 3, 0, Math.PI * 2);
      mm.fill();
    }
    // Mission marker (pulsing).
    const mk = game.missions.marker();
    if (mk) {
      const pulse = 3 + Math.sin(game.time * 4) * 1.2;
      mm.fillStyle = '#22e5ff';
      mm.beginPath();
      mm.arc(X(mk.x), Z(mk.z), pulse, 0, Math.PI * 2);
      mm.fill();
      mm.strokeStyle = 'rgba(34,229,255,0.5)';
      mm.lineWidth = 1.5;
      mm.beginPath();
      mm.arc(X(mk.x), Z(mk.z), pulse + 3, 0, Math.PI * 2);
      mm.stroke();
    }
    // Player arrow.
    const px = X(game.hero.pos.x);
    const pz = Z(game.hero.pos.z);
    const heading = game.vehicles.playerCar ? game.vehicles.playerCar.heading : game.hero.heading;
    mm.save();
    mm.translate(px, pz);
    // Canvas y is down = +z south; heading 0 faces +z. Rotate so the arrow
    // points along the heading: angle from "down" is heading.
    mm.rotate(Math.PI - heading);
    mm.fillStyle = '#ffffff';
    mm.strokeStyle = '#111';
    mm.lineWidth = 1;
    mm.beginPath();
    mm.moveTo(0, -6);
    mm.lineTo(4.5, 5);
    mm.lineTo(-4.5, 5);
    mm.closePath();
    mm.fill();
    mm.stroke();
    mm.restore();
  }

  return { update, toast, showMenu, setEnd, setSaveNote, drawMinimap };
}
