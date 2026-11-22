// keys.js — keyboard + mouse input for VELMARA.
// makeInput(canvas) only touches the DOM when called from boot; importing
// this module is side-effect free so Node can import it for tests.

export function makeInput(canvas) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    wheel: 0,
  };

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  function onDown(e) {
    const k = keyName(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
    if (!e.repeat) input.keys.add(k);
  }

  function onUp(e) {
    input.keys.delete(keyName(e));
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  }

  function onMouseDown(e) {
    onMove(e);
    input.mouse.down = true;
    input.mouse.clicked = true;
  }

  function onMouseUp() {
    input.mouse.down = false;
  }

  function onBlur() {
    input.keys.clear();
    input.mouse.down = false;
  }

  canvas.addEventListener('keydown', onDown);
  canvas.addEventListener('keyup', onUp);
  canvas.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  // The canvas takes focus so key events land here, not on the page.
  canvas.setAttribute('tabindex', '0');
  canvas.focus();

  input.detach = () => {
    canvas.removeEventListener('keydown', onDown);
    canvas.removeEventListener('keyup', onUp);
    canvas.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mouseup', onMouseUp);
  };
  return input;
}

export function down(input, ...names) {
  for (const n of names) if (input.keys.has(n)) return true;
  return false;
}

// Freshly pressed this frame (consumed by the caller via take()).
export function pressed(input, name) {
  return input.keys.has(name);
}

// WASD / arrows as a -1..1 movement vector, normalised.
export function moveAxis(input) {
  let x = 0;
  let y = 0;
  if (down(input, 'a', 'ArrowLeft')) x -= 1;
  if (down(input, 'd', 'ArrowRight')) x += 1;
  if (down(input, 'w', 'ArrowUp')) y -= 1;
  if (down(input, 's', 'ArrowDown')) y += 1;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}
