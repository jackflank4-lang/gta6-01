// input.js — keyboard state with edge-triggered presses.
// The engine polls down() for held keys and wasPressed() for one-shot
// actions (punch, jump, enter car, horn); pressed edges are cleared once
// per frame by endFrame() so a single tap never fires twice.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this._down = (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._up = (e) => { this.keys.delete(e.code); };
    this._blur = () => { this.keys.clear(); };
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  // WASD / arrows drive vector: x = strafe, y = forward.
  axes() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }
  endFrame() { this.pressed.clear(); }
  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
    window.removeEventListener('blur', this._blur);
  }
}
