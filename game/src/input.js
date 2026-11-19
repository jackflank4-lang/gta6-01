// Keyboard and mouse input for Solmar Bay (v10).
// Keys are tracked by `code` (KeyW, ArrowUp, Space, ...). Held state is live;
// pressed edges are collected on keydown and snapshotted once per frame at the
// start of the loop, so a slow frame (software renderer at ~1 fps) never
// swallows a tap. The engine calls snapshot() first thing every frame, then
// reads framePressed for one-shot actions (E, F, Space, H, L, N, C, P).

export function createInput() {
  const held = Object.create(null);
  const pressed = Object.create(null);
  let framePressed = Object.create(null);
  let mouseClicked = false;
  let frameClicked = false;
  let enabled = true;

  function onKeyDown(e) {
    if (!enabled) return;
    const c = e.code;
    if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed[c] = true;
    held[c] = true;
  }
  function onKeyUp(e) {
    held[e.code] = false;
  }
  function onMouseDown(e) {
    if (!enabled) return;
    if (e.button === 0) mouseClicked = true;
  }
  function onBlur() {
    for (const k of Object.keys(held)) held[k] = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousedown', onMouseDown);

  function snapshot() {
    // Copy, do not alias: framePressed must keep the keys after pressed is
    // cleared for the next frame.
    framePressed = { ...pressed };
    for (const k of Object.keys(pressed)) delete pressed[k];
    frameClicked = mouseClicked;
    mouseClicked = false;
  }

  function isHeld(...codes) {
    for (const c of codes) if (held[c]) return true;
    return false;
  }
  function wasPressed(...codes) {
    for (const c of codes) if (framePressed[c]) return true;
    return false;
  }
  function clicked() {
    return frameClicked;
  }
  function setEnabled(v) {
    enabled = v;
    if (!v) {
      for (const k of Object.keys(held)) held[k] = false;
    }
  }
  function moveVector() {
    // Returns {x, z} in camera-relative space: x right, z forward (toward
    // where the camera looks). WASD and arrows both work.
    let x = 0;
    let z = 0;
    if (isHeld('KeyW', 'ArrowUp')) z += 1;
    if (isHeld('KeyS', 'ArrowDown')) z -= 1;
    if (isHeld('KeyA', 'ArrowLeft')) x -= 1;
    if (isHeld('KeyD', 'ArrowRight')) x += 1;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }
  function sprinting() {
    return isHeld('ShiftLeft', 'ShiftRight');
  }

  return { snapshot, isHeld, wasPressed, clicked, setEnabled, moveVector, sprinting, held };
}
