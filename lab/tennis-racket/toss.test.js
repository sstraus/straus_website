// Behaviour tests for one throw of the racket. Run with: node --test lab/proto/tennis-racket/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createToss, THROWS } from './toss.js';

const G = 9.81;
// Mardešić et al., PRL 125, 064301 (2020), supplemental Table 1, as in lab/lib/models/racket.js
// (which imports three.js, so Node cannot load it): a = Iy/Iz − 1, b = 1 − Iy/Ix.
const A = 12.54;
const B = 0.06;
const INERTIA = [(1 + A) / (1 - B), 1 + A, 1];
const IDENTITY = [0, 0, 0, 1];
/** Farthest point of the drawn racket from its centre of mass (tip of the head), metres. */
const REACH = 0.38;
/** The start camera looks at x = 0, y = 1.6 (main.js CAMERAS[0].target). */
const VIEW_CENTRE = [0, 1.6];

function fly(axis, revPerSecond, path = THROWS.wide, zeroG = false, seconds = Infinity) {
  const toss = createToss({ inertia: INERTIA, axis, revPerSecond, orientation: IDENTITY, ...path, zeroG });
  let maxTwist = toss.twist;
  while (!toss.landed && toss.time < seconds) {
    toss.advance(0.01);
    maxTwist = Math.max(maxTwist, toss.twist);
  }
  return { toss, maxTwist };
}

test('a middle-axis throw at 1 rev/s turns over exactly once (catches the unstable axis mapped to the wrong body index)', () => {
  const { toss, maxTwist } = fly('middle', 1);
  assert.equal(toss.stable, false);
  assert.equal(toss.flips, 1);
  assert.ok(maxTwist > 170, `max twist ${maxTwist}`);
});

test('handle and face throws never flip at any slider speed (catches a calm button that spins about the middle axis)', () => {
  for (const axis of ['handle', 'face']) {
    for (const rev of [0.5, 1, 2, 3]) {
      const { toss, maxTwist } = fly(axis, rev);
      assert.equal(toss.flips, 0, `${axis} at ${rev} rev/s`);
      assert.ok(maxTwist < 30, `${axis} at ${rev} rev/s wobbles ${maxTwist}°`);
    }
  }
});

test('the phone throw rotates exactly like the desktop throw (catches a steeper path that changes the vertical speed or the rotation)', () => {
  const wide = fly('middle', 1, THROWS.wide).toss;
  const tall = fly('middle', 1, THROWS.tall).toss;
  assert.equal(tall.flightTime, wide.flightTime);
  assert.equal(tall.flips, wide.flips);
  tall.body.q.forEach((v, i) => assert.ok(Math.abs(v - wide.body.q[i]) < 1e-12));
  assert.ok(Math.abs(tall.position[1] - THROWS.tall.launch[1]) < 1e-9, 'lands at release height');
});

test('each throw stays inside its camera fit box (catches a path edit that sends the racket off a phone screen)', () => {
  for (const [name, path] of Object.entries(THROWS)) {
    const T = (2 * path.velocity[1]) / G;
    const x = [path.launch[0], path.launch[0] + path.velocity[0] * T];
    const y = [path.launch[1], path.launch[1] + path.velocity[1] ** 2 / (2 * G)];
    const [w, h] = path.fit;
    assert.ok(Math.min(...x) - REACH >= VIEW_CENTRE[0] - w / 2, `${name}: left edge`);
    assert.ok(Math.max(...x) + REACH <= VIEW_CENTRE[0] + w / 2, `${name}: right edge`);
    assert.ok(y[0] - REACH >= VIEW_CENTRE[1] - h / 2, `${name}: bottom edge`);
    assert.ok(y[1] + REACH <= VIEW_CENTRE[1] + h / 2, `${name}: top edge`);
  }
});

test('in zero-g the racket hovers, never lands and keeps flipping (catches a flight time taken from the court throw)', () => {
  const { toss } = fly('middle', 1, THROWS.wide, true, 8);
  assert.equal(toss.landed, false);
  assert.ok(toss.flips >= 2, `${toss.flips} flips in 8 s`);
  assert.deepEqual(toss.position, THROWS.wide.launch);
});
