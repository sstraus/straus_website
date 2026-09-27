// Pointer gestures on the canvas, the same for mouse and touch:
//   drag the knob = turn the current, drag the magnet = move it over the dish,
//   tap = tooltip or spec card, double-tap on empty space = back to the bench view.
// Everything else (one-finger orbit, pinch zoom) stays with OrbitControls.
import * as THREE from 'three/webgpu';
import { clampToDisc } from './rig.js';

const TAP_MOVE = 8; // px
const TAP_TIME = 450; // ms
const DOUBLE_TAP = 320; // ms

export function bindGestures(o) {
  const { canvas, camera, controls } = o;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const pointers = new Set();
  let down = null;
  let drag = null;
  let lastTap = null;
  let lastHover = 0;

  const cast = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((e.clientY - rect.top) / rect.height) * 2);
    raycaster.setFromCamera(pointer, camera);
  };
  const pick = (e) => {
    cast(e);
    // The nearest hit decides. The fluid surface is displaced on the GPU, so it is tested as its rest plane.
    const hit = raycaster.intersectObjects(o.pickables, true)[0];
    const fluid = o.fluidHit(raycaster.ray);
    if (fluid && (!hit || fluid.distance < hit.distance)) return { part: 'fluid', point: fluid.point };
    if (hit) return { part: o.partOf(hit.object), point: hit.point.clone() };
    return { part: null, point: null };
  };

  // Knob: the angle swept around its centre on screen sets the current.
  const screenAngle = (e) => {
    const rect = canvas.getBoundingClientRect();
    o.knob.getWorldPosition(centre).project(camera);
    const cx = rect.left + ((centre.x + 1) / 2) * rect.width;
    const cy = rect.top + ((1 - centre.y) / 2) * rect.height;
    return Math.atan2(-(e.clientY - cy), e.clientX - cx);
  };
  const moveMagnet = (e) => {
    cast(e);
    plane.constant = -o.magnetHeight();
    if (!raycaster.ray.intersectPlane(plane, point)) return;
    const p = clampToDisc(point.x, point.z, o.magnetLimit);
    o.moveMagnet(p.x, p.z);
  };

  const endDrag = () => {
    if (!drag) return;
    drag = null;
    controls.enabled = true;
    canvas.style.cursor = '';
  };

  // Capture phase: runs before OrbitControls, so a drag on a part never orbits the camera.
  canvas.addEventListener('pointerdown', (e) => {
    if (e.isPrimary) pointers.clear();
    pointers.add(e.pointerId);
    if (pointers.size > 1) { endDrag(); down = null; return; } // pinch belongs to the camera
    if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) { down = null; return; } // pan belongs to the camera
    const hit = pick(e);
    down = { x: e.clientX, y: e.clientY, time: performance.now(), id: e.pointerId, ...hit };
    if (hit.part === 'knob') drag = { kind: 'knob', angle: screenAngle(e) };
    else if (hit.part === 'magnet') drag = { kind: 'magnet', grabbed: false };
    if (!drag) return;
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  }, { capture: true });

  canvas.addEventListener('pointermove', (e) => {
    if (drag && down?.id === e.pointerId) {
      if (drag.kind === 'knob') {
        const angle = screenAngle(e);
        const delta = Math.atan2(Math.sin(angle - drag.angle), Math.cos(angle - drag.angle));
        drag.angle = angle;
        o.turnKnob(delta / (Math.PI * 1.5)); // clockwise (negative angle) turns the current up
      } else {
        // A tap on the magnet only explains it; lowering it starts with a real drag.
        if (!drag.grabbed && Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MOVE) return;
        if (!drag.grabbed) { drag.grabbed = true; o.grabMagnet(); }
        moveMagnet(e);
      }
      return;
    }
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const now = performance.now();
    if (now - lastHover < 40) return; // raycasts against the windings are not free
    lastHover = now;
    const { part } = pick(e);
    canvas.style.cursor = part === 'knob' || part === 'magnet' ? 'grab' : part ? 'pointer' : '';
    o.hover(part, e);
  });

  const up = (e) => {
    pointers.delete(e.pointerId);
    if (!down || down.id !== e.pointerId) return;
    endDrag();
    const now = performance.now();
    const still = Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MOVE;
    if (e.type === 'pointerup' && still && now - down.time < TAP_TIME) {
      if (lastTap && now - lastTap.time < DOUBLE_TAP && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        o.doubleTap(down.part);
        lastTap = null;
      } else {
        o.tap(down.part, down.point, e);
        lastTap = { time: now, x: e.clientX, y: e.clientY };
      }
    }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !drag) o.hover(null, e);
  });
}
