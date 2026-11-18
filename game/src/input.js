// Keyboard and mouse input for Solmar Bay.
// The engine calls beginFrame() once per rendered frame: it snapshots the
// pressed edges so a key tapped between two slow frames is never swallowed
// (the software renderer runs a few frames a second, so a 60 ms tap would
// otherwise fall between frames and vanish).
export class Input {
  constructor(canvas) {
    this.held = new Set();
    this.pressed = new Set();
    this._queued = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mousePressed = false;
    this._mouseQueued = false;
    this._canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      if (!this.held.has(e.code)) this._queued.add(e.code);
      this.held.add(e.code);
      // Keep the page from scrolling on game keys.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      this.held.delete(e.code);
    };
    this._onMouseDown = (e) => {
      this._mouseQueued = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    this._onMouseMove = (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
  }

  // Snapshot this frame's fresh presses; call once per frame, first thing.
  beginFrame() {
    this.pressed = this._queued;
    this._queued = new Set();
    this.mousePressed = this._mouseQueued;
    this._mouseQueued = false;
  }

  down(code) {
    return this.held.has(code);
  }

  // True only on the frame the key went down.
  hit(code) {
    return this.pressed.has(code);
  }

  // Movement axes: -1..1, arrows and WASD both work.
  moveX() {
    let x = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return x;
  }

  moveY() {
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return y;
  }

  sprint() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  // Any of the pause keys hit this frame.
  pauseHit() {
    return this.hit('KeyP') || this.hit('Escape');
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
  }
}
