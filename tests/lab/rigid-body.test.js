// Behavior tests for the torque-free rigid body integrator used by /lab.
// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRigidBody,
  stepRigidBody,
  bodyOmega,
  kineticEnergy,
  worldAngularMomentum,
  perturbationRate,
} from '../../lab/lib/rigid-body.js';

// Tennis racket from Mardešić et al., PRL 125, 064301 (2020), supplemental Table 1:
// a = Iy/Iz - 1 = 12.54, b = 1 - Iy/Ix = 0.06. Iz is normalised to 1.
const A = 12.54;
const B = 0.06;
const RACKET = [(1 + A) / (1 - B), 1 + A, 1];
const SPIN = 2 * Math.PI;
const DT = 1e-3;

function spinAbout(axis, perturbation) {
  const omega = [perturbation, perturbation, perturbation];
  omega[axis] = SPIN;
  return createRigidBody({ inertia: RACKET, omega });
}

function run(body, seconds, onStep = () => {}) {
  const steps = Math.round(seconds / DT);
  for (let i = 1; i <= steps; i++) {
    stepRigidBody(body, DT);
    onStep(body, i * DT);
  }
}

const norm = (v) => Math.hypot(...v);

// Catches: a sign error in Euler's equations or a body/world quaternion mix-up.
// Either one makes the world-frame angular momentum rotate, which no free body can do.
test('free rotation conserves world angular momentum and kinetic energy', () => {
  const body = createRigidBody({ inertia: RACKET, omega: [1.3, -2.1, 5.7] });
  const l0 = worldAngularMomentum(body);
  const e0 = kineticEnergy(body);

  run(body, 20);

  const l1 = worldAngularMomentum(body);
  const drift = norm(l1.map((c, i) => c - l0[i])) / norm(l0);
  assert.ok(drift < 1e-7, `world L drifted by ${drift}`);
  assert.ok(Math.abs(kineticEnergy(body) - e0) / e0 < 1e-7, 'energy drifted');
});

// Catches: swapped inertia labels or a wrong sign that makes the intermediate axis stable.
// This is the tennis racket theorem itself: only the middle axis tumbles.
test('spin about the largest and smallest axes stays regular, the intermediate axis flips', () => {
  for (const axis of [0, 2]) {
    const body = spinAbout(axis, 1e-3);
    let maxWobble = 0;
    run(body, 10, (b) => {
      const w = bodyOmega(b);
      const off = Math.hypot(...w.filter((_, i) => i !== axis));
      maxWobble = Math.max(maxWobble, off / SPIN);
    });
    assert.ok(maxWobble < 0.01, `axis ${axis} wobble reached ${maxWobble}`);
  }

  const body = spinAbout(1, 1e-3);
  let flips = 0;
  let sign = Math.sign(bodyOmega(body)[1]);
  run(body, 10, (b) => {
    const s = Math.sign(bodyOmega(b)[1]);
    if (s !== 0 && s !== sign) {
      flips++;
      sign = s;
    }
  });
  assert.ok(flips >= 1, 'intermediate axis never flipped');
});

// Catches: a wrong growth-rate formula shown in the UI. The oracle is the simulated
// exponential growth of a tiny perturbation, not the formula.
test('perturbationRate predicts the simulated instability growth of the intermediate axis', () => {
  const predicted = perturbationRate(RACKET, 1, SPIN);
  assert.equal(predicted.stable, false);
  assert.equal(perturbationRate(RACKET, 0, SPIN).stable, true);
  assert.equal(perturbationRate(RACKET, 2, SPIN).stable, true);
  // For Iz < Iy < Ix the growth rate is exactly Ω·√(ab), the product the paper builds on.
  assert.ok(Math.abs(predicted.rate / SPIN - Math.sqrt(A * B)) < 1e-9);

  const body = spinAbout(1, 1e-9);
  const crossings = {};
  run(body, 10, (b, t) => {
    const w = bodyOmega(b);
    const off = Math.hypot(w[0], w[2]) / SPIN;
    for (const level of [1e-6, 1e-3]) {
      if (crossings[level] === undefined && off >= level) crossings[level] = t;
    }
  });
  const measured = Math.log(1e3) / (crossings[1e-3] - crossings[1e-6]);
  assert.ok(
    Math.abs(measured - predicted.rate) / predicted.rate < 0.05,
    `measured ${measured}, predicted ${predicted.rate}`,
  );
});
