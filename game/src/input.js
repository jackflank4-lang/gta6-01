// Keyboard + mouse state. Classic script, no modules.
(function () {
  'use strict';
  window.SB = window.SB || {};
  const Input = {
    keys: {},
    mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false,
    dragDX: 0, dragDY: 0, dragging: false,
    pressed: {}, // edge-triggered keys, consumed by the game each frame
    init: function (canvas) {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        this.keys[e.code] = true;
        this.pressed[e.code] = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouseX = e.clientX - r.left;
        this.mouseY = e.clientY - r.top;
        if (this.dragging) { this.dragDX += e.movementX || 0; this.dragDY += e.movementY || 0; }
      });
      canvas.addEventListener('mousedown', (e) => {
        this.mouseDown = true; this.mouseClicked = true; this.dragging = true;
        SB.Audio.init(); SB.Audio.startMusic();
      });
      window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    down: function (code) { return !!this.keys[code]; },
    wasPressed: function (code) { return !!this.pressed[code]; },
    endFrame: function () {
      this.pressed = {};
      this.mouseClicked = false;
      this.dragDX = 0; this.dragDY = 0;
    },
    axis: function () {
      // returns {x: strafe, y: forward} in -1..1
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
