/**
 * Torque-free rigid body dynamics.
 *
 * State: angular momentum L in the body frame (principal axes) and the unit
 * quaternion q = [x, y, z, w] that rotates body vectors into the world frame.
 *   Euler's equations:  dL/dt = L × ω,   ω = L / I (component-wise)
 *   Kinematics:         dq/dt = ½ q ⊗ (ω, 0)
 * Integrated with classic RK4. No rendering dependencies, so tests run in Node.
 */

export function createRigidBody({ inertia, omega, orientation = [0, 0, 0, 1] }) {
  return {
    inertia: [...inertia],
    L: omega.map((w, i) => w * inertia[i]),
    q: [...orientation],
  };
}

export function bodyOmega(body) {
  return body.L.map((l, i) => l / body.inertia[i]);
}

export function kineticEnergy(body) {
  return 0.5 * body.L.reduce((sum, l, i) => sum + (l * l) / body.inertia[i], 0);
}

export function worldAngularMomentum(body) {
  return rotateVector(body.q, body.L);
}

/**
 * Linear stability of a steady spin at rate `spin` about principal axis `axis`.
 * A small perturbation obeys  ε̈ = -Ω² (Ia−Ib)(Ia−Ic) / (Ib·Ic) · ε.
 * Stable: it oscillates at `rate` (rad/s). Unstable: it grows as e^(rate·t).
 */
export function perturbationRate(inertia, axis, spin) {
  const ia = inertia[axis];
  const [ib, ic] = inertia.filter((_, i) => i !== axis);
  const k = ((ia - ib) * (ia - ic)) / (ib * ic);
  return { stable: k > 0, rate: Math.abs(spin) * Math.sqrt(Math.abs(k)) };
}

export function stepRigidBody(body, dt) {
  const s0 = [...body.L, ...body.q];
  const k1 = derivative(body.inertia, s0);
  const k2 = derivative(body.inertia, addScaled(s0, k1, dt / 2));
  const k3 = derivative(body.inertia, addScaled(s0, k2, dt / 2));
  const k4 = derivative(body.inertia, addScaled(s0, k3, dt));
  const s1 = s0.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));

  body.L = s1.slice(0, 3);
  const n = Math.hypot(...s1.slice(3));
  body.q = s1.slice(3).map((c) => c / n);
}

/** Rotates vector v by unit quaternion q = [x, y, z, w]. */
export function rotateVector(q, v) {
  const [x, y, z, w] = q;
  // t = 2 (q.xyz × v);  v' = v + w t + q.xyz × t
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

function derivative(inertia, s) {
  const [l0, l1, l2, x, y, z, w] = s;
  const w0 = l0 / inertia[0];
  const w1 = l1 / inertia[1];
  const w2 = l2 / inertia[2];
  return [
    l1 * w2 - l2 * w1,
    l2 * w0 - l0 * w2,
    l0 * w1 - l1 * w0,
    // ½ q ⊗ (ω, 0)
    0.5 * (w * w0 + y * w2 - z * w1),
    0.5 * (w * w1 + z * w0 - x * w2),
    0.5 * (w * w2 + x * w1 - y * w0),
    0.5 * -(x * w0 + y * w1 + z * w2),
  ];
}

function addScaled(a, b, s) {
  return a.map((v, i) => v + b[i] * s);
}
