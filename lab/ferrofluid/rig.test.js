import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BENCH, STAND, armPose, carriageOnArm, magnetRodSpan, clampToDisc } from './rig.js';

// Every magnet position the user can reach, on a grid over the allowed disc.
function reachablePoints() {
  const points = [];
  for (let x = -BENCH.magnetLimit; x <= BENCH.magnetLimit; x += 0.25) {
    for (let z = -BENCH.magnetLimit; z <= BENCH.magnetLimit; z += 0.25) {
      if (Math.hypot(x, z) <= BENCH.magnetLimit) points.push([x, z]);
    }
  }
  return points;
}

test('the carriage stays on the arm for every magnet position over the dish (catches: carriage past the arm tip, magnet floating)', () => {
  for (const [x, z] of reachablePoints()) {
    const { reach } = armPose(x, z);
    assert.ok(carriageOnArm(reach), `magnet at (${x}, ${z}) needs reach ${reach}`);
  }
});

test('the arm points at the magnet (catches: wrong yaw sign that swings the arm away)', () => {
  for (const [x, z] of [[4, 0], [0, 4], [-3, -2], [2.5, -3]]) {
    const { yaw, reach } = armPose(x, z);
    const tipX = STAND.rodX + Math.cos(yaw) * reach;
    const tipZ = STAND.rodZ - Math.sin(yaw) * reach;
    assert.ok(Math.hypot(tipX - x, tipZ - z) < 1e-9);
  }
});

test('the magnet rod passes through the carriage when parked and when lowered (catches: rod too short, magnet hanging free)', () => {
  for (const bottom of [BENCH.magnetRest, BENCH.fluidLevel + BENCH.magnetGap]) {
    const { low, high } = magnetRodSpan(bottom);
    assert.ok(low < STAND.armY - 1 && high > STAND.armY + 1, `bottom ${bottom}: rod ${low}..${high}`);
  }
});

test('the lowered magnet clears the dish rim (catches: magnet crashing into the glass)', () => {
  const rimTop = BENCH.coilTop + 1.35;
  assert.ok(BENCH.fluidLevel + BENCH.magnetGap > rimTop + 1);
});

test('clamping keeps points inside and projects outside points onto the rim', () => {
  assert.deepEqual(clampToDisc(1, 1, 4), { x: 1, z: 1 });
  const p = clampToDisc(8, 6, 4);
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - 4) < 1e-12 && Math.abs(p.x / p.z - 8 / 6) < 1e-12);
});
