// Keyboard and mouse input for Solmar Bay — Neon Heat.
// Held keys are a live set; pressed edges are queued and snapshotted once
// per frame at the start of the loop, so a short tap is never swallowed by
// a slow frame (the software renderer runs only a few frames a second).
export class Input {
  constructor(target) {
    this.held = new Set();
    this.pressed = new Set();
    this.queue = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.clicked = false;
    this.clickQueue = false;
    this.target = target || window;
    this.target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.queue.push(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    this.target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    this.target.addEventListener('blur', () => {
      this.held.clear();
    });
    this.target.addEventListener('mousedown', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.clickQueue = true;
    });
    this.target.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  // Call once at the top of every frame: moves queued edges into `pressed`.
  beginFrame() {
    this.pressed = new Set(this.queue);
    this.queue.length = 0;
    this.clicked = this.clickQueue;
    this.clickQueue = false;
  }

  isDown(code) {
    return this.held.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement axes: -1..1, from WASD or the arrow keys.
  axes() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y -= 1;
    return { x, y };
  }
}
