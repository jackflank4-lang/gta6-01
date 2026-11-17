// The HUD of Solmar Bay: a DOM overlay on top of the 3D canvas. Cash and
// health top-left, wanted stars and the clock top-right, a circular minimap
// bottom-left, the mission objective bottom-centre, and the start / pause /
// busted / wasted screens. The minimap paints the city's ground canvas into a
// circle and draws the player, the mission beacon, traffic and police on it.

export class Hud {
  constructor(city) {
    this.city = city;
    this.el = {};
    for (const id of ['cash', 'health-fill', 'health-num', 'stars', 'clock', 'speed',
      'objective', 'toast', 'menu', 'pause-menu', 'busted-menu', 'wasted-menu',
      'btn-start', 'btn-continue', 'btn-resume', 'btn-restart', 'btn-respawn',
      'btn-respawn2', 'save-note', 'mission-title', 'busted-fine', 'radio-name']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = document.getElementById('minimap');
    this.mm = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.onStart = null;
    this.onContinue = null;
    this.onResume = null;
    this.onRestart = null;
    this.onRespawn = null;

    this.el['btn-start'].addEventListener('click', () => this.onStart && this.onStart());
    this.el['btn-continue'].addEventListener('click', () => this.onContinue && this.onContinue());
    this.el['btn-resume'].addEventListener('click', () => this.onResume && this.onResume());
    this.el['btn-restart'].addEventListener('click', () => this.onRestart && this.onRestart());
    this.el['btn-respawn'].addEventListener('click', () => this.onRespawn && this.onRespawn());
    this.el['btn-respawn2'].addEventListener('click', () => this.onRespawn && this.onRespawn());
  }

  setCash(n) {
    this.el.cash.textContent = `$${n.toLocaleString('en-US')}`;
  }

  setHealth(h) {
    const pct = Math.max(0, Math.min(100, Math.round(h)));
    this.el['health-fill'].style.width = `${pct}%`;
    this.el['health-fill'].style.background = pct > 50 ? '#3ddc5f' : pct > 25 ? '#ffb02e' : '#ff4444';
    this.el['health-num'].textContent = pct;
  }

  setWanted(n) {
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < n ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = n >= 3 ? '#ff4444' : '#ffd23b';
  }

  setClock(hours, minutes) {
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    this.el.clock.textContent = `${hh}:${mm}`;
  }

  setSpeed(kmh, inCar) {
    this.el.speed.textContent = inCar ? `${Math.round(kmh)} MPH` : '';
  }

  setObjective(text) {
    this.el.objective.textContent = text;
  }

  setMissionTitle(title) {
    this.el['mission-title'].textContent = title;
  }

  setRadio(name) {
    this.el['radio-name'].textContent = name ? `♪ ${name}` : '';
  }

  toast(text, ms) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toast.style.opacity = '0';
    }, ms || 3200);
  }

  showStart(hasSave) {
    this.hideOverlays();
    this.el.menu.style.display = 'flex';
    this.el['btn-continue'].style.display = hasSave ? 'inline-block' : 'none';
    this.el['save-note'].textContent = hasSave
      ? 'A save was found — Continue picks up where you left off.'
      : 'No save yet — your progress saves automatically.';
  }

  showPause() {
    this.hideOverlays();
    this.el['pause-menu'].style.display = 'flex';
  }

  showBusted(fine) {
    this.hideOverlays();
    this.el['busted-fine'].textContent = `Fine paid: $${fine}. The cruisers let you walk — this time.`;
    this.el['busted-menu'].style.display = 'flex';
  }

  showWasted() {
    this.hideOverlays();
    this.el['wasted-menu'].style.display = 'flex';
  }

  hideOverlays() {
    for (const id of ['menu', 'pause-menu', 'busted-menu', 'wasted-menu']) {
      this.el[id].style.display = 'none';
    }
  }

  // The minimap: the city's painted ground, clipped to a circle, north up,
  // with the player as a white arrow, the mission beacon pulsing gold,
  // traffic as amber dots, police as flashing red/blue, thugs as red dots.
  drawMinimap(world, time) {
    const ctx = this.mm;
    const size = 176;
    const range = 210; // world metres across the map
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#16222e';
    ctx.fillRect(0, 0, size, size);
    const scale = size / (range * 2);
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    // Ground texture, centred on the player.
    const px = world.playerFootPos();
    const ground = this.city.groundCanvas;
    const worldSpan = 520;
    const viewSpan = range * 2;
    const srcSize = (viewSpan / worldSpan) * ground.width;
    const srcX = ((px.x + worldSpan / 2) / worldSpan) * ground.width - srcSize / 2;
    const srcY = ((px.z + worldSpan / 2) / worldSpan) * ground.width - srcSize / 2;
    ctx.drawImage(ground, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

    const dot = (x, z, color, radius) => {
      const [mx, mz] = toMap(x - px.x, z - px.z);
      if (mx < 0 || mz < 0 || mx > size || mz > size) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, mz, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const beacon = world.missions.beaconPos();
    if (beacon) {
      const pulse = 5 + Math.sin(time * 5) * 2;
      dot(beacon.x, beacon.z, '#ffd23b', pulse);
      dot(beacon.x, beacon.z, '#fff2b0', 2.5);
    }
    for (const car of world.traffic.cars) {
      dot(car.mesh.position.x, car.mesh.position.z, '#ffb02e', 2);
    }
    for (const cop of world.police.cruisers) {
      dot(cop.mesh.position.x, cop.mesh.position.z, Math.sin(time * 10) > 0 ? '#ff4444' : '#4080ff', 3);
    }
    for (const thug of world.thugs.list) {
      if (!thug.dead) dot(thug.mesh.position.x, thug.mesh.position.z, '#ff2020', 2.5);
    }
    for (const coin of world.coins) {
      if (!coin.taken) dot(coin.x, coin.z, '#ffe98a', 2);
    }

    // Player arrow, pointing where the player faces.
    const heading = world.playerHeading();
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
