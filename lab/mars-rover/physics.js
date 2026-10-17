/**
 * The rover as a 2D rigid body on the terrain profile. Pure, so node can test it.
 *
 * x runs along the ground, y is up, angles are counter-clockwise (nose up is positive). The chassis
 * carries three wheels (front, middle, rear: one side of a six-wheeled rover, seen from the side).
 * Each wheel hangs on a suspension that slides along the chassis' own down axis: a spring, a
 * damper and, at the end of its travel, a stiff bump stop. A wheel pushes on the chassis only while
 * it touches the ground; drive and braking act along the ground at the contact, limited by
 * friction. Gravity is Mars gravity. The atmosphere is there too, and it is almost nothing.
 *
 * Sizes and mass are Perseverance's (NASA, "Rover Components"). The speed is not: the real rover
 * tops out at 152 metres per hour; this one drives about 300 times faster, because it is a game.
 */

export const MARS = {
  g: 3.73, // m/s², mean surface gravity (NASA NSSDC Mars Fact Sheet)
  rho: 0.016, // kg/m³, surface air density (same source); Earth at sea level: about 1.2
};

export const ROVER = {
  mass: 1025, // kg
  length: 3, // m
  height: 2.2, // m
  width: 2.7, // m (for the frontal area of the drag)
  wheelRadius: 0.2625, // m: wheels 52.5 cm across
  // Where each suspension is fixed to the chassis, from the centre of mass (body frame, m).
  wheelX: [1.3, 0.05, -1.25],
  anchorY: -0.35,
  rest: 0.65, // m: suspension length at full extension
  travel: 0.46, // m: compression at which the bump stop takes over (longer than the real rover's, for the jumps)
  // The body shell, for strikes: points on the chassis in body frame (m). Nose, tail, belly.
  hull: [[1.6, -0.12], [1.35, -0.42], [0.4, -0.46], [-0.6, -0.46], [-1.4, -0.42], [-1.6, -0.1], [1.2, 0.95], [-1.2, 0.95]],
  cd: 1.05,
};

// Springs: the rover settles 14 cm into its suspension at rest, and bounces a little under 1 Hz.
const SAG = 0.14;
const K = (ROVER.mass * MARS.g) / (3 * SAG); // N/m per wheel
const DAMP = 2 * 0.42 * Math.sqrt(K * (ROVER.mass / 3)); // N s/m per wheel: damping ratio 0.42
const K_STOP = 45 * K;
const DAMP_STOP = 5 * DAMP;
const MU = 0.6; // grip of the wheels on packed regolith
const DRIVE = 2600; // N per (m/s) of speed error, per wheel, before the friction limit
const ENGINE_BRAKE = 0.12; // share of the grip the motors spend holding the rover back downhill
const INERTIA = (ROVER.mass * (ROVER.length ** 2 + 1.2 ** 2)) / 12; // kg m²
const JUMP = 4; // m/s, upwards
const STEP = 1 / 240; // s: fixed substep
const ATTITUDE = { stiffness: 14, damping: 6.5 }; // 1/s² and 1/s: the nose settles on the path in about half a second
const STRIKE_CRASH = 2.4; // m/s: a hull point driven into the ground faster than this ends the run
export const LANDING_AIR = 0.3; // s: anything shorter is a bump, not a landing

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Drag in newtons at a speed, for any air density: ½ ρ Cd A v². */
export const drag = (speed, rho = MARS.rho) => 0.5 * rho * ROVER.cd * ROVER.width * ROVER.height * speed * speed;

/** A rover standing on the ground at x, at rest in its suspension. */
export function createRover(terrain, x = 10) {
  const y = terrain.height(x) + ROVER.wheelRadius + (ROVER.rest - SAG) - ROVER.anchorY;
  return {
    x, y, a: Math.atan(terrain.slope(x)), vx: 0, vy: 0, w: 0,
    wheels: ROVER.wheelX.map(() => ({ compression: SAG, contact: true, cx: x, cy: 0 })),
    air: 0, grounded: true, sinceLanding: 10, jumpQueued: false, cooldown: 0,
    crashed: null, landing: null, landed: null, bottomOut: 0, time: 0,
  };
}

/** Ask for a jump. It happens on the next step if at least two wheels are on the ground. */
export function jump(rover) {
  rover.jumpQueued = true;
}

/**
 * Advance the rover by dt seconds (in fixed substeps). `targetSpeed` is the speed the motors aim
 * for along the ground. Returns the rover (mutated). Sets `rover.landed` on the step where a
 * landing happens: { delta, vn, air, slope } — the raw numbers the game grades.
 */
export function step(rover, terrain, dt, targetSpeed) {
  rover.landed = null;
  let left = Math.min(dt, 0.1);
  while (left > 1e-9) {
    const h = Math.min(STEP, left);
    substep(rover, terrain, h, targetSpeed);
    left -= h;
    if (rover.crashed) break;
  }
  return rover;
}

function substep(r, terrain, dt, targetSpeed) {
  const cos = Math.cos(r.a);
  const sin = Math.sin(r.a);
  const ux = -sin; // the chassis' up axis
  const uy = cos;
  let fx = 0;
  let fy = -ROVER.mass * MARS.g;
  let torque = 0;
  let contacts = 0;

  // ---- wheels ----
  for (let i = 0; i < 3; i++) {
    const wheel = r.wheels[i];
    const bx = ROVER.wheelX[i];
    const by = ROVER.anchorY;
    const ax = r.x + bx * cos - by * sin;
    const ay = r.y + bx * sin + by * cos;
    // The wheel centre slides from the anchor along -up: W(s) = A - u s. Find the s at which the
    // wheel just touches the ground (Newton, from full extension).
    const gap = (s) => ay - uy * s - terrain.height(ax - ux * s) - ROVER.wheelRadius;
    let s = ROVER.rest;
    const before = wheel.compression;
    if (gap(s) > 0) {
      wheel.contact = false;
      wheel.compression = 0;
      wheel.cx = ax - ux * s;
      wheel.cy = ay - uy * s;
      continue;
    }
    for (let k = 0; k < 6; k++) {
      const dg = -uy + terrain.slope(ax - ux * s) * ux;
      s -= gap(s) / (Math.abs(dg) > 1e-6 ? dg : -1);
      s = Math.max(-0.2, Math.min(ROVER.rest, s));
    }
    const compression = ROVER.rest - s;
    const rate = (compression - (wheel.contact ? before : 0)) / dt;
    wheel.contact = true;
    wheel.compression = compression;
    wheel.cx = ax - ux * s;
    wheel.cy = ay - uy * s;
    contacts += 1;

    let force = K * compression + DAMP * rate;
    const over = compression - ROVER.travel;
    if (over > 0) {
      force += K_STOP * over + DAMP_STOP * Math.max(0, rate);
      r.bottomOut = Math.max(r.bottomOut, over);
    }
    force = Math.max(0, force); // a spring pushes, it never pulls the rover down onto the ground
    // Suspension force along the chassis' up axis, at the anchor.
    const sx = ux * force;
    const sy = uy * force;
    fx += sx;
    fy += sy;
    torque += (ax - r.x) * sy - (ay - r.y) * sx;

    // Traction along the ground at the contact point, limited by friction.
    const px = wheel.cx;
    const py = wheel.cy - ROVER.wheelRadius;
    const slope = terrain.slope(px);
    const norm = Math.hypot(1, slope);
    const tx = 1 / norm;
    const ty = slope / norm;
    const vpx = r.vx - r.w * (py - r.y);
    const vpy = r.vy + r.w * (px - r.x);
    const along = vpx * tx + vpy * ty;
    // The motors push hard up to the target speed and brake only lightly above it: downhill the
    // rover runs away with gravity, which is the whole Tiny Wings engine.
    const limit = MU * force;
    const want = DRIVE * (targetSpeed - along);
    const traction = want > 0 ? Math.min(limit, want) : Math.max(-limit * ENGINE_BRAKE, want);
    const qx = tx * traction;
    const qy = ty * traction;
    fx += qx;
    fy += qy;
    torque += (px - r.x) * qy - (py - r.y) * qx;
  }

  // ---- air ----
  const speed = Math.hypot(r.vx, r.vy);
  if (speed > 1e-6) {
    const d = drag(speed);
    fx -= (d * r.vx) / speed;
    fy -= (d * r.vy) / speed;
  }

  // ---- the jump ----
  r.cooldown = Math.max(0, r.cooldown - dt);
  if (r.jumpQueued) {
    r.jumpQueued = false;
    if (contacts >= 2 && r.cooldown === 0) {
      // Straight up and a little forward, whatever slope it stands on: a jump on a rising face
      // must not throw the rover backwards.
      r.vx += JUMP * 0.2;
      r.vy += JUMP;
      r.cooldown = 0.35;
    }
  }

  // ---- attitude in the air ----
  // A real rover cannot jump, and nothing would turn it in flight. This one levels its nose along its
  // own flight path, the way the bird does in Tiny Wings, so a landing is decided by where the arc
  // meets the ground and not by the spin the take-off happened to give it.
  // With no speed forward there is no path to follow, and the nose stays level.
  if (contacts === 0 && r.air > 0.12) {
    const forward = Math.max(0, Math.min(1, (r.vx - 1) / 3));
    const path = Math.atan2(r.vy, Math.max(0.5, r.vx)) * forward;
    torque += INERTIA * (ATTITUDE.stiffness * wrap(path - r.a) - ATTITUDE.damping * r.w);
  }

  // ---- integrate (semi-implicit Euler) ----
  r.vx += (fx / ROVER.mass) * dt;
  r.vy += (fy / ROVER.mass) * dt;
  r.w += (torque / INERTIA) * dt;
  r.x += r.vx * dt;
  r.y += r.vy * dt;
  r.a = wrap(r.a + r.w * dt);
  r.time += dt;

  // ---- the hull against the ground ----
  hull(r, terrain);

  // ---- landings ----
  const wasAir = r.air;
  if (contacts > 0) {
    if (!r.grounded && wasAir >= LANDING_AIR) {
      const slope = terrain.slope(r.x);
      const beta = Math.atan(slope);
      const nx = -Math.sin(beta);
      const ny = Math.cos(beta);
      r.landed = { delta: wrap(r.a - beta), vn: -(r.vx * nx + r.vy * ny), air: wasAir, slope: beta };
      r.landing = r.landed;
      r.bottomOut = 0;
      r.sinceLanding = 0;
    }
    r.grounded = true;
    r.air = 0;
  } else {
    r.grounded = false;
    r.air += dt;
  }
  r.sinceLanding += dt;
  // Driven over onto the roof, or standing on the nose: the run is over.
  if (contacts > 0 && Math.abs(wrap(r.a - Math.atan(terrain.slope(r.x)))) > 1.75) r.crashed = r.crashed ?? 'flipped';
}

/**
 * The shell of the rover must stay above the ground. A point that goes under is pushed back out.
 * If it hit the ground hard (a nose driven into the face of a ridge), the run ends.
 */
function hull(r, terrain) {
  const cos = Math.cos(r.a);
  const sin = Math.sin(r.a);
  for (const [bx, by] of ROVER.hull) {
    const px = r.x + bx * cos - by * sin;
    const py = r.y + bx * sin + by * cos;
    const ground = terrain.height(px);
    const depth = ground - py;
    if (depth <= 0) continue;
    const slope = terrain.slope(px);
    const norm = Math.hypot(1, slope);
    const nx = -slope / norm;
    const ny = 1 / norm;
    // Velocity of that point, into the ground.
    const vpx = r.vx - r.w * (py - r.y);
    const vpy = r.vy + r.w * (px - r.x);
    const into = -(vpx * nx + vpy * ny);
    if (into > STRIKE_CRASH) {
      r.crashed = r.crashed ?? 'strike';
      r.strike = r.strike ?? { point: [bx, by], into };
    }
    // Push the rover out and take the speed into the ground away (an inelastic scrape).
    r.x += nx * depth;
    r.y += ny * depth;
    if (into > 0) {
      r.vx += nx * into;
      r.vy += ny * into;
      r.w *= 0.9;
    }
  }
}

/** Where the wheels and the hull are now, for the renderer: world positions in metres. */
export function pose(r) {
  const cos = Math.cos(r.a);
  const sin = Math.sin(r.a);
  return {
    x: r.x, y: r.y, a: r.a,
    wheels: r.wheels.map((w) => ({ x: w.cx, y: w.cy, compression: w.compression, contact: w.contact })),
    forward: [cos, sin],
    up: [-sin, cos],
  };
}

export const CONSTANTS = { K, DAMP, SAG, JUMP, STEP, INERTIA, STRIKE_CRASH };
