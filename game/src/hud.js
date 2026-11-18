// HUD for Solmar Bay: cash, health, wanted stars, clock, speed,
// objective line, toast stack, minimap, and the three menus (start, pause,
// busted/wasted). The DOM lives in game/index.html; this module only
// touches elements by id, so the game logic never deals with the DOM.
const THREE = window.THREE;

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('hud-cash');
  const healthEl = el('hud-health-fill');
  const starsEl = el('hud-stars');
  const clockEl = el('hud-clock');
  const speedEl = el('hud-speed');
  const objectiveEl = el('hud-objective');
  const toastsEl = el('hud-toasts');
  const radioEl = el('hud-radio');
  const map = el('minimap');
  const mapCtx = map ? map.getContext('2d') : null;

  let frame = 0;

  function toast(text) {
    if (!toastsEl) return;
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    toastsEl.appendChild(div);
    while (toastsEl.children.length > 4) toastsEl.removeChild(toastsEl.firstChild);
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 4500);
  }

  function showMenu(name) {
    for (const id of ['menu-start', 'menu-pause', 'menu-over']) {
      const m = el(id);
      if (m) m.style.display = id === `menu-${name}` ? 'flex' : 'none';
    }
  }

  function setStars(n) {
    if (!starsEl) return;
    const spans = starsEl.querySelectorAll('span');
    spans.forEach((s, i) => {
      s.textContent = i < n ? '★' : '☆';
      s.className = i < n ? 'star on' : 'star';
    });
  }

  function formatClock(elapsedSec) {
    // Dusk clock: starts 18:00, one game minute per real second.
    const totalMin = 18 * 60 + Math.floor(elapsedSec);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Minimap: 180 px canvas, city 352 m across, north = -z at the top.
  function drawMinimap(S) {
    if (!mapCtx || !S.city) return;
    const W = map.width;
    const H = map.height;
    const scale = W / (352 + 40);
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    mapCtx.clearRect(0, 0, W, H);
    mapCtx.fillStyle = '#0d1520';
    mapCtx.fillRect(0, 0, W, H);
    // Roads.
    mapCtx.strokeStyle = '#3a4556';
    mapCtx.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      const c = -176 + i * 44;
      mapCtx.beginPath();
      mapCtx.moveTo(toX(c), toY(-196));
      mapCtx.lineTo(toX(c), toY(196));
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(toX(-196), toY(c));
      mapCtx.lineTo(toX(196), toY(c));
      mapCtx.stroke();
    }
    // Bay at the bottom (south).
    mapCtx.fillStyle = '#14425e';
    mapCtx.fillRect(0, toY(-176), W, H - toY(-176));
    // Landmarks.
    const dots = [
      [S.city.tower, '#ff2a55'],
      [S.city.garage, '#ffb347'],
      [S.city.diner, '#7ae0ff'],
      [S.city.plaza, '#ff8c42'],
    ];
    for (const [p, color] of dots) {
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(toX(p.x), toY(p.z), 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Mission marker: pulsing gold ring.
    if (S.marker) {
      const r = 4 + Math.sin(S.time * 4) * 1.5;
      mapCtx.strokeStyle = '#ffd700';
      mapCtx.lineWidth = 2;
      mapCtx.beginPath();
      mapCtx.arc(toX(S.marker.x), toY(S.marker.z), r, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // Traffic (grey) and police (blue).
    if (S.traffic) {
      mapCtx.fillStyle = '#8a94a6';
      for (const c of S.traffic) {
        mapCtx.fillRect(toX(c.x) - 1, toY(c.z) - 1, 2, 2);
      }
    }
    if (S.police) {
      mapCtx.fillStyle = '#3a86ff';
      for (const c of S.police) {
        mapCtx.beginPath();
        mapCtx.arc(toX(c.x), toY(c.z), 2.5, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }
    // Hero arrow.
    if (S.hero) {
      const hx = toX(S.hero.x);
      const hy = toY(S.hero.z);
      mapCtx.save();
      mapCtx.translate(hx, hy);
      mapCtx.rotate(Math.PI - S.hero.heading);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -6);
      mapCtx.lineTo(4, 5);
      mapCtx.lineTo(-4, 5);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
    }
  }

  function update(S) {
    frame += 1;
    if (cashEl) cashEl.textContent = `$${Math.floor(S.cash)}`;
    if (healthEl) {
      healthEl.style.width = `${Math.max(0, Math.min(100, S.hp))}%`;
      healthEl.style.background = S.hp > 50 ? '#2ecc71' : S.hp > 25 ? '#f39c12' : '#e74c3c';
    }
    setStars(S.wanted || 0);
    if (clockEl) clockEl.textContent = formatClock(S.elapsed || 0);
    if (speedEl) speedEl.textContent = S.driving ? `${Math.round((S.speed || 0) * 2.237)} MPH` : '';
    if (objectiveEl && S.objective) objectiveEl.textContent = S.objective;
    if (radioEl) radioEl.textContent = S.radio || '';
    if (frame % 3 === 0) drawMinimap(S);
  }

  return { update, toast, showMenu, setStars };
}
