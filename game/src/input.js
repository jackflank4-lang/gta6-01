// Keyboard and mouse input for Solmar Bay. The game reads keys by their
// physical `code` (KeyW, Space, KeyE ...) so layouts do not matter. `hit()`
// reports a key pressed since the last frame (an edge), `down()` reports it
// held. Mouse drag orbits the camera; the page never needs pointer lock, so
// the game also works inside a screenshot harness.

// The keys the game listens to. Anything else is ignored on purpose: the
// browser keeps its own shortcuts (F5, Ctrl+R) and the game never swallows
// them, which also keeps headless test drivers from fighting the page.
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyH', 'KeyL', 'KeyN', 'KeyC',
  'KeyM', 'KeyP', 'Escape', 'Enter', 'KeyR',
]);

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.dragX = 0;
    this.dragY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.anyKeyAt = 0;

    window.addEventListener('keydown', (event) => {
      if (!GAME_KEYS.has(event.code)) return;
      if (event.code === 'Space') event.preventDefault();
      if (!this.held.has(event.code)) this.pressed.add(event.code);
      this.held.add(event.code);
      this.anyKeyAt = performance.now();
    });
    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.dragging = false;
    });
    window.addEventListener('mousedown', (event) => {
      if (event.target && event.target.closest && event.target.closest('button, a, input')) return;
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });
    window.addEventListener('mousemove', (event) => {
      if (!this.dragging) return;
      this.dragX += event.clientX - this.lastX;
      this.dragY += event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });
  }

  down(code) {
    return this.held.has(code);
  }

  hit(code) {
    return this.pressed.has(code);
  }

  // Forward/strafe as -1..1 from WASD or the arrow keys.
  moveVector() {
    const forward = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0)
      - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    const strafe = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0)
      - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    return { forward, strafe };
  }

  sprint() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  // Mouse drag since the last call, in pixels; calling it consumes the delta.
  takeDrag() {
    const out = { x: this.dragX, y: this.dragY };
    this.dragX = 0;
    this.dragY = 0;
    return out;
  }

  // Called by the engine at the end of every frame: edges live one frame only.
  endFrame() {
    this.pressed.clear();
  }
}
