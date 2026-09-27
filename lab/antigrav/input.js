// Controls. Phone (landscape): left thumb on a steer strip with the two airbrakes above it,
// right thumb on a vertical throttle strip (the height is the thrust, lifting the thumb cuts it)
// with the fire pad beside it. The same controls work with a mouse. Desktop keys stay silent:
// arrows or WASD, Q/E airbrakes, space fires, the wheel sets a cruise throttle.
// Exposes { throttle, steer, brakeL, brakeR } and an edge-triggered fire.

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createInput(el) {
  const state = { throttle: 0, steer: 0, brakeL: 0, brakeR: 0 };
  const touch = { throttle: null, steer: null, brakeL: false, brakeR: false };
  const keys = new Set();
  let cruise = 0, fireQueued = false, keySteer = 0, enabled = true;
  const firstGesture = [];

  function gesture() {
    while (firstGesture.length) firstGesture.shift()();
  }

  // A strip reads the pointer position while it is held; the pointer is captured, so the thumb
  // may slide off the strip without losing it.
  function strip(node, read, release) {
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      gesture();
      node.setPointerCapture(e.pointerId);
      node.classList.add('held');
      read(e);
    });
    node.addEventListener('pointermove', (e) => { if (node.hasPointerCapture(e.pointerId)) read(e); });
    const up = (e) => {
      if (node.hasPointerCapture?.(e.pointerId)) node.releasePointerCapture(e.pointerId);
      node.classList.remove('held');
      release();
    };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('lostpointercapture', () => { node.classList.remove('held'); release(); });
  }

  strip(el.throttle, (e) => {
    const r = el.throttle.getBoundingClientRect();
    touch.throttle = clamp((r.bottom - e.clientY) / r.height * 1.08 - 0.04, 0, 1);
  }, () => { touch.throttle = null; });

  strip(el.steer, (e) => {
    const r = el.steer.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    touch.steer = clamp(x * 1.15, -1, 1);
  }, () => { touch.steer = null; });

  for (const [node, key] of [[el.brakeL, 'brakeL'], [el.brakeR, 'brakeR']]) {
    strip(node, () => { touch[key] = true; }, () => { touch[key] = false; });
  }

  el.fire.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    gesture();
    fireQueued = true;
    el.fire.classList.add('held');
  });
  const unFire = () => el.fire.classList.remove('held');
  el.fire.addEventListener('pointerup', unFire);
  el.fire.addEventListener('pointercancel', unFire);

  const KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space']);
  window.addEventListener('keydown', (e) => {
    // Keys belong to the page while the essay is open (scrolling it with the arrows and space).
    if (!KEYS.has(e.code) || e.target.closest?.('input, textarea, select') || el.essay?.classList.contains('open')) return;
    e.preventDefault();
    gesture();
    if (e.code === 'Space' && !e.repeat) fireQueued = true;
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  el.surface.addEventListener('wheel', (e) => {
    if (!enabled) return;
    cruise = clamp(cruise - Math.sign(e.deltaY) * 0.1, 0, 1);
    gesture();
  }, { passive: true });
  el.surface.addEventListener('pointerdown', gesture);

  const has = (...codes) => codes.some((c) => keys.has(c));

  // Called once per frame: merges touch, mouse and keys into the state.
  function update(dt) {
    const keyThrottle = has('ArrowUp', 'KeyW') ? 1 : has('ArrowDown', 'KeyS') ? 0 : null;
    if (has('ArrowDown', 'KeyS')) cruise = 0;
    state.throttle = touch.throttle ?? keyThrottle ?? cruise;
    const want = (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0);
    keySteer += clamp(want - keySteer, -6 * dt, 6 * dt);   // keys ease in like a thumb would
    state.steer = touch.steer ?? keySteer;
    state.brakeL = touch.brakeL || has('KeyQ') ? 1 : 0;
    state.brakeR = touch.brakeR || has('KeyE') ? 1 : 0;
    el.throttle.style.setProperty('--level', state.throttle.toFixed(3));
    el.steer.style.setProperty('--x', state.steer.toFixed(3));
    el.brakeL.classList.toggle('on', !!state.brakeL);
    el.brakeR.classList.toggle('on', !!state.brakeR);
    if (!enabled) { state.throttle = 0; state.steer = 0; state.brakeL = 0; state.brakeR = 0; }
    return state;
  }

  return {
    state,
    update,
    consumeFire() { const f = fireQueued; fireQueued = false; return f && enabled; },
    onFirstGesture(fn) { firstGesture.push(fn); },
    setEnabled(on) { enabled = on; if (!on) { cruise = 0; fireQueued = false; } },
    reset() { cruise = 0; keySteer = 0; fireQueued = false; },
  };
}
