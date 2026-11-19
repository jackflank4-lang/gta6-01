// Keyboard + mouse input. Keys are tracked by `code` (KeyW, ArrowUp, ...).
// `held` is the live state; `framePressed` is a per-frame snapshot of the
// edges that fired since the last frame — it is a COPY, never an alias, so a
// slow frame can never swallow a key press. Call beginFrame() once per game
// loop tick, before any system reads input.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = Object.create(null);
    this.pressed = Object.create(null);
    this.framePressed = Object.create(null);
    this.mouseDown = false;
    this.mousePressed = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.anyKey = false;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (!this.held[event.code]) this.pressed[event.code] = true;
      this.held[event.code] = true;
      this.anyKey = true;
      // Keep the page from scrolling on arrows / space while playing.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.held[event.code] = false;
    });
    window.addEventListener('blur', () => {
      this.held = Object.create(null);
    });
    canvas.addEventListener('mousedown', (event) => {
      this.mouseDown = true;
      this.mousePressed = true;
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
  }

  // Snapshot the edges that fired since the last frame. Must run once per
  // tick, before the game reads anything.
  beginFrame() {
    // Copy, not alias: framePressed must survive the pressed map being
    // cleared below.
    this.framePressed = { ...this.pressed };
    this.pressed = Object.create(null);
    const mouse = this.mousePressed;
    this.mousePressed = false;
    return mouse;
  }

  isDown(...codes) {
    return codes.some((code) => !!this.held[code]);
  }

  wasPressed(...codes) {
    return codes.some((code) => !!this.framePressed[code]);
  }

  // Movement axes in [-1, 1]: forward/back and left/right.
  moveAxes() {
    const forward = (this.isDown('KeyW', 'ArrowUp') ? 1 : 0) - (this.isDown('KeyS', 'ArrowDown') ? 1 : 0);
    const strafe = (this.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (this.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    return { forward, strafe };
  }

  driveAxes() {
    const throttle = (this.isDown('KeyW', 'ArrowUp') ? 1 : 0) - (this.isDown('KeyS', 'ArrowDown') ? 1 : 0);
    const steer = (this.isDown('KeyA', 'ArrowLeft') ? 1 : 0) - (this.isDown('KeyD', 'ArrowRight') ? 1 : 0);
    return { throttle, steer };
  }
}
