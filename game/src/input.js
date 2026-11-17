// Keyboard + mouse state for Solmar Bay. Classic script, no modules.
// Rebuild r3: SPACE is now jump on foot (handbrake stays in the car),
// H honks the horn while driving, L toggles the headlights, and the
// binding table the menu renders lists the new keys.
(function () {
  'use strict';
  window.SB = window.SB || {};

  // Human-readable binding table — the menu screen renders this.
  const BINDINGS = [
    ['W A S D', 'walk / drive'],
    ['SHIFT', 'sprint'],
    ['E', 'enter / exit car (steal it!)'],
    ['SPACE', 'jump on foot · handbrake in car'],
    ['H', 'honk the horn · hold at Chop Shop to repair'],
    ['L', 'headlights on / off'],
    ['Mouse', 'aim — drag to look around'],
    ['Click', 'shoot'],
    ['F', 'punch'],
    ['C', 'camera: follow / shoulder / high'],
    ['N', 'switch radio track'],
    ['P / ESC', 'pause'],
    ['M', 'mute'],
    ['R', 'restart'],
  ];

  const Input = {
    keys: {},
    pressed: {}, // edge-triggered keys, consumed by the game each frame
    mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false,
    dragDX: 0, dragDY: 0, dragging: false,
    wheel: 0, // accumulated wheel delta, consumed each frame
    anyKey: false,
    bindings: BINDINGS,
    init: function (canvas) {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        this.keys[e.code] = true;
        this.pressed[e.code] = true;
        this.anyKey = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; this.dragging = false; });
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouseX = e.clientX - r.left;
        this.mouseY = e.clientY - r.top;
        if (this.dragging) { this.dragDX += e.movementX || 0; this.dragDY += e.movementY || 0; }
      });
      canvas.addEventListener('mousedown', (e) => {
        this.mouseDown = true; this.mouseClicked = true; this.dragging = true;
        this.anyKey = true;
        SB.Audio.init(); SB.Audio.startMusic();
      });
      window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('wheel', (e) => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    },
    down: function (code) { return !!this.keys[code]; },
    wasPressed: function (code) { return !!this.pressed[code]; },
    endFrame: function () {
      this.pressed = {};
      this.mouseClicked = false;
      this.dragDX = 0; this.dragDY = 0;
      this.wheel = 0;
      this.anyKey = false;
    },
    // {x: strafe, y: forward} in -1..1
    axis: function () {
      let x = 0, y = 0;
      if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
      if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
      if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
      if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
      return { x: x, y: y };
    },
  };
  SB.Input = Input;
})();
