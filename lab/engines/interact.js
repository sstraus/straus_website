// Pointer gestures on the canvas, the same for mouse and touch:
//   hover or first tap = tooltip, click or second tap = spec card, double-tap = fly to the part
//   (double-tap on empty space = back to the current view). Orbit and pinch stay with OrbitControls.
// Callbacks get the pick volume that was hit (its userData.part names the part), or null.
import * as THREE from 'three/webgpu';

const TAP_MOVE = 8; // px
const TAP_TIME = 450; // ms
const DOUBLE_TAP = 320; // ms

/** True when a hit lies in the part of a sectioned volume that is cut away. */
function inCutAway(hit) {
  const planes = hit.object.userData.clip;
  if (!planes) return false;
  const behind = planes.map((p) => p.distanceToPoint(hit.point) < 0);
  return hit.object.userData.clipIntersection ? behind.every(Boolean) : behind.some(Boolean);
}

export function bindGestures(o) {
  const { canvas, camera } = o;
  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1); // pick volumes only: simple shapes, never drawn
  const pointer = new THREE.Vector2();
  const pointers = new Set();
  let down = null;
  let lastTap = null;
  let lastHover = 0;

  const pick = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((e.clientY - rect.top) / rect.height) * 2);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(o.pickables(), false).find((h) => !inCutAway(h));
    return hit ? hit.object : null;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // right and middle drags pan and zoom
    if (e.isPrimary) pointers.clear();
    pointers.add(e.pointerId);
    if (pointers.size > 1) { down = null; return; } // pinch belongs to the camera
    down = { x: e.clientX, y: e.clientY, time: performance.now(), id: e.pointerId, hit: pick(e) };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const now = performance.now();
    if (now - lastHover < 50) return;
    lastHover = now;
    const hit = pick(e);
    canvas.style.cursor = hit ? 'pointer' : '';
    o.hover(hit, e);
  });

  const up = (e) => {
    pointers.delete(e.pointerId);
    if (!down || down.id !== e.pointerId) return;
    const now = performance.now();
    const still = Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MOVE;
    if (e.type === 'pointerup' && still && now - down.time < TAP_TIME) {
      if (lastTap && now - lastTap.time < DOUBLE_TAP && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        o.doubleTap(down.hit);
        lastTap = null;
      } else {
        o.tap(down.hit, e);
        lastTap = { time: now, x: e.clientX, y: e.clientY };
      }
    }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') o.hover(null, e);
  });
}
