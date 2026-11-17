// Keyboard and mouse input for Solmar Bay.
// Code-based keys (KeyW, Space, ...) so layouts do not matter. Pressed edges
// are snapshotted once per frame at the start of the loop (beginFrame), so a
// slow frame under the software renderer never swallows a key tap.
export class Input {
  constructor(canvas) {
    this.held = Object.create(null);
    this.pressed = Object.create(null);
    this.released = Object.create(null);
    this._queue = [];
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    this._lastX = 0;
    this._lastY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this._queue.push({ code: e.code, down: true });
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this._queue.push({ code: e.code, down: false });
    });
    window.addEventListener('blur', () => {
      this.held = Object.create(null);
      this._queue.length = 0;
    });

    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this._queue.push({ code: 'Mouse0', down: true });
    });
    window.addEventListener('mouseup', (e) => {
      if (this.dragging) this._queue.push({ code: 'Mouse0', down: false });
      this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.clientX - this._lastX;
      this.mouseDY += e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
  }

  // Consume the queued events into held/pressed/released for this frame.
  beginFrame() {
    this.pressed = Object.create(null);
    this.released = Object.create(null);
    for (const ev of this._queue) {
      if (ev.down) {
        if (!this.held[ev.code]) this.pressed[ev.code] = true;
        this.held[ev.code] = true;
      } else {
        if (this.held[ev.code]) this.released[ev.code] = true;
        this.held[ev.code] = false;
      }
    }
    this._queue.length = 0;
  }

  // Clear the accumulated mouse drag at the end of the frame.
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  isDown(code) { return !!this.held[code]; }
  wasPressed(code) { return !!this.pressed[code]; }
  wasReleased(code) { return !!this.released[code]; }

  // Movement keys: WASD or arrows.
  axis() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y -= 1;
    return { x, y };
  }
}
