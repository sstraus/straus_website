/**
 * One throw of the racket: free rotation plus a ballistic centre of mass.
 *
 * Rotation uses the tested torque-free integrator in lab/lib/rigid-body.js
 * (Euler's equations, RK4). Uniform gravity pulls on the centre of mass only,
 * so it has no torque about it: the rotation stays exactly torque-free and the
 * translation is a parabola. Air drag is ignored.
 *
 * No three.js here: vectors are plain arrays.
 */
import { createRigidBody, stepRigidBody, rotateVector, worldAngularMomentum, perturbationRate } from '../lib/rigid-body.js';

const G = 9.81;
const STEP = 1 / 2400;
/** Hand wobble: the two off-axis components of the angular momentum, as a fraction of the main one. */
const WOBBLE = 0.03;

/**
 * Release point and velocity (metres, m/s), and the box (width, height in metres) that the camera
 * must keep in view. `wide` fills a landscape screen. `tall` is for a portrait phone: a steeper
 * throw with the same vertical speed, so the arc fits a near-square band. Only the horizontal
 * speed differs, and it does not touch the rotation or the flight time.
 */
export const THROWS = {
  wide: { launch: [-1.05, 1.05, 4.5], velocity: [2.3, 4.4, 0], fit: [3.5, 2] },
  tall: { launch: [-0.55, 1.05, 4.5], velocity: [1.2, 4.4, 0], fit: [2, 2] },
};

export const AXES = {
  face: { index: 0, label: 'Face' },
  middle: { index: 1, label: 'Middle' },
  handle: { index: 2, label: 'Handle' },
};

/**
 * `orientation` maps body vectors to the world at release (quaternion [x, y, z, w]).
 * `launch` and `velocity` set the parabola; with `zeroG` the racket hovers at `launch`.
 */
export function createToss({ inertia, axis, revPerSecond, orientation, launch, velocity, zeroG }) {
  const k = AXES[axis].index;
  const spin = 2 * Math.PI * revPerSecond;
  // Same relative tilt of the angular momentum for every axis: L_i = WOBBLE · L_k.
  const omega = [0, 1, 2].map((i) => (i === k ? spin : (WOBBLE * spin * inertia[k]) / inertia[i]));
  const body = createRigidBody({ inertia, omega, orientation });
  const flightTime = zeroG ? Infinity : (2 * velocity[1]) / G;
  const { stable, rate } = perturbationRate(inertia, k, spin);

  const toss = {
    axis,
    body,
    time: 0,
    flightTime,
    landed: false,
    flips: 0,
    /** Angle (degrees) between the spin axis in the body and the fixed angular momentum. */
    twist: 0,
    /** Wobble growth rate (1/s) when unstable, oscillation rate when stable. */
    stable,
    rate,
    position: [...launch],

    /** Advances by `dt` seconds of simulated time. Returns true when a flip happened. */
    advance(dt) {
      const end = Math.min(toss.time + dt, flightTime);
      let flipped = false;
      while (toss.time < end - 1e-12) {
        const h = Math.min(STEP, end - toss.time);
        stepRigidBody(body, h);
        toss.time += h;
        const before = toss.twist;
        toss.twist = twistAngle(body, k);
        if ((before - 90) * (toss.twist - 90) < 0) {
          toss.flips++;
          flipped = true;
        }
      }
      toss.landed = toss.time >= flightTime;
      const t = toss.time;
      toss.position = zeroG ? [...launch] : launch.map((p, i) => p + velocity[i] * t - (i === 1 ? 0.5 * G * t * t : 0));
      return flipped;
    },
  };
  toss.twist = twistAngle(body, k);
  return toss;
}

function twistAngle(body, k) {
  const axis = rotateVector(body.q, [0, 1, 2].map((i) => (i === k ? 1 : 0)));
  const L = worldAngularMomentum(body);
  const cos = (axis[0] * L[0] + axis[1] * L[1] + axis[2] * L[2]) / Math.hypot(...L);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}
