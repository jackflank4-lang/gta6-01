// Keyboard and mouse input for Solmar Bay.
//
// Keys are tracked by their code (KeyW, Space, KeyE ...), never by the
// character, so any keyboard layout works. A press is an edge: it is only
// reported once, on the frame after the key went down. The edges are
// snapshotted once per frame at the START of the frame loop (beginFrame),
// so a key pressed during a long, slow software-rendered frame is never
// swallowed by the renderer clearing it afterwards. Held keys are read
// directly. Mouse drag orbits the camera.
export class Input {
  constructor(canvas) {
    this.held = new Set();
    this.edge = new Set();
    this.snapshot = new Set();
    this.dragX = 0;
    this.dragY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.anyKey = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.held.add(e.code);
      this.edge.add(e.code);
      this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
    });

    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.edge.add('MouseClick');
      this.anyKey = true;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.dragX += e.clientX - this.lastX;
      this.dragY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });
  }

  // Call once, at the very start of each frame, before update().
  beginFrame() {
    this.snapshot = new Set(this.edge);
    this.edge.clear();
  }

  isDown(code) {
    return this.held.has(code);
  }

  // True only on the frame after the key went down.
  pressed(code) {
    return this.snapshot.has(code);
  }

  // Accumulated mouse drag since the last call, in pixels.
  consumeDrag() {
    const out = { dx: this.dragX, dy: this.dragY };
    this.dragX = 0;
    this.dragY = 0;
    return out;
  }
}
