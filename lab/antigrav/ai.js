// Computer pilots. A racing line and a speed profile are computed once per track; each pilot
// then steers toward a look-ahead point on the line with the same inputs a player has (absolute
// throttle, steer, two airbrakes, fire). Mistakes come from a random error per stretch of track.

import { SHIP } from './physics.js';
import { gapS, wrapS } from './track.js';
import { boltTarget, ITEM } from './items.js';

export const DIFFICULTY = {
  easy: { yaw: 0.95, top: 0.9, lineError: 2.6, speedError: 0.05, react: 0.45, name: 'Easy' },
  pro: { yaw: 1.2, top: 1, lineError: 1.0, speedError: 0.02, react: 0.9, name: 'Pro' },
};

const BRAKE_DECEL = 26;   // m/s^2 a pilot plans to lose with both airbrakes and the throttle off
const LINE_MAX = 7;       // m from the centre line

function smooth(arr, count, half) {
  const out = new Float64Array(count);
  let sum = 0;
  for (let k = -half; k <= half; k++) sum += arr[((k % count) + count) % count];
  for (let i = 0; i < count; i++) {
    out[i] = sum / (2 * half + 1);
    sum += arr[(i + half + 1) % count] - arr[((i - half) % count + count) % count];
  }
  return out;
}

// The line leans toward the inside of the curvature ahead; the speed is what the yaw budget
// allows (v = yaw / |kn|), then a backward pass adds the braking zones.
export function buildLine(track, yaw) {
  const n = track.count, step = track.step;
  const ahead = Math.round(100 / step);
  const lean = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let k = 0;
    for (let j = 0; j < ahead; j++) k += track.kn[(i + j) % n];
    lean[i] = Math.max(-LINE_MAX, Math.min(LINE_MAX, 650 * k / ahead));
  }
  const d = smooth(lean, n, Math.round(40 / step));
  const knS = smooth(track.kn, n, 3);
  const v = new Float64Array(n);
  const top = SHIP.vmax + SHIP.padBoost;
  for (let i = 0; i < n; i++) v[i] = Math.min(top, yaw / Math.max(1e-6, Math.abs(knS[i])));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const next = v[(i + 1) % n];
      v[i] = Math.min(v[i], Math.sqrt(next * next + 2 * BRAKE_DECEL * step));
    }
  }
  return { d, v, step, count: n };
}

const lineAt = (line, arr, s) => {
  const x = s / line.step, i = Math.floor(x) % line.count, t = x - Math.floor(x);
  return arr[i] + (arr[(i + 1) % line.count] - arr[i]) * t;
};

export function createPilot(track, level = 'pro', rand = Math.random, lines = {}) {
  const diff = DIFFICULTY[level];
  const line = lines[level] || (lines[level] = buildLine(track, diff.yaw));
  return { level, diff, line, rand, segment: -1, dErr: 0, vErr: 1, dodge: 0, itemClock: 0, heldFor: 0 };
}

// A light rubber band: a pilot more than 40 m ahead of the player lowers its top speed, by up to
// 10 % at 200 m, so rivals stay in view. Pilots behind race at full pace; the player never slows.
// Measured over 3 laps with 60/300 m: the leaders held 80-260 m (1.5-2 s), mostly out of view.
const LEAD = { from: 40, full: 200, ease: 0.1 };
function catchUp(ship, player) {
  if (!player || player === ship) return 1;
  const lead = ship.dist - player.dist;
  return 1 - LEAD.ease * Math.max(0, Math.min(1, (lead - LEAD.from) / (LEAD.full - LEAD.from)));
}

const gauss = (rand) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

// One decision. Returns the input object for stepShip; `ctx` = { ships, items, track, dt, player? }.
export function drive(pilot, ship, ctx, input = { throttle: 0, steer: 0, brakeL: 0, brakeR: 0, fire: false }) {
  const { track, dt } = ctx;
  const { line, diff } = pilot;
  const v = Math.max(1, ship.vx);

  // A new random error every 250 m of track.
  const seg = Math.floor(ship.dist / 250);
  if (seg !== pilot.segment) {
    pilot.segment = seg;
    pilot.dErr = gauss(pilot.rand) * diff.lineError;
    pilot.vErr = 1 + gauss(pilot.rand) * diff.speedError;
  }

  // Dodge a mine that lies on the line ahead.
  pilot.dodge *= Math.exp(-dt / 0.6);
  for (const m of ctx.items.mines) {
    const g = gapS(track, ship.s, m.s);
    if (g > 5 && g < v * 1.2 && Math.abs(m.d - ship.d) < 5 && pilot.rand() < diff.react * dt * 8) {
      pilot.dodge = m.d > ship.d ? -6 : 6;
    }
  }

  // Steering toward a look-ahead point.
  const look = 12 + 0.45 * v;
  const sA = wrapS(track, ship.s + look);
  const dTarget = Math.max(-8.5, Math.min(8.5, lineAt(line, line.d, sA) + pilot.dErr + pilot.dodge));
  const want = Math.atan2(dTarget - ship.d, look);
  const velAngle = Math.atan2(ship.vy, v);
  // The path turns only as fast as grip bends the velocity (about grip x sin(slip)), so the
  // nose must lead the velocity by a slip angle: steer the nose to that angle.
  const kHere = lineAt(track, track.kn, wrapS(track, ship.s + 0.15 * v));
  const pathRate = kHere * v + 2.5 * (want - velAngle);
  const slip = Math.asin(Math.max(-0.9, Math.min(0.9, pathRate / SHIP.grip)));
  const rCmd = kHere * v + 5 * (velAngle + slip - ship.psi);
  let steer = rCmd / SHIP.yawSteer, brakeL = 0, brakeR = 0;
  if (steer > 0.95) { brakeR = 1; steer = (rCmd - SHIP.yawBrake) / SHIP.yawSteer; }
  if (steer < -0.95) { brakeL = 1; steer = (rCmd + SHIP.yawBrake) / SHIP.yawSteer; }

  // Speed: the lowest planned speed in the next 0.7 s, with this stretch's error.
  let vT = Infinity;
  for (let a = 0; a <= 0.7 * v; a += track.step * 4) vT = Math.min(vT, lineAt(line, line.v, wrapS(track, ship.s + a)));
  vT = Math.min(vT, SHIP.vmax * diff.top * catchUp(ship, ctx.player)) * pilot.vErr;
  let throttle = Math.max(0, Math.min(1, (vT / SHIP.vmax) ** 2 + 0.06 * (vT - v)));
  if (v - vT > 10) { throttle = 0; brakeL = 1; brakeR = 1; }

  input.throttle = throttle;
  input.steer = Math.max(-1, Math.min(1, steer));
  input.brakeL = brakeL;
  input.brakeR = brakeR;
  input.fire = wantsFire(pilot, ship, ctx);
  return input;
}

// Item timing. Checked a few times a second, with a reaction chance that depends on difficulty.
export function wantsFire(pilot, ship, ctx) {
  if (!ship.item) { pilot.heldFor = 0; return false; }
  pilot.heldFor += ctx.dt;
  pilot.itemClock -= ctx.dt;
  if (pilot.itemClock > 0) return false;
  pilot.itemClock = 0.25;
  if (pilot.rand() > pilot.diff.react) return false;
  return itemUseful(ship, ctx);
}

// Would using the held item help right now? Pure, no randomness.
export function itemUseful(ship, { ships, items, track }) {
  const v = Math.max(20, ship.vx);
  if (ship.item === 'shield') {
    if (ship.shield > 0) return false;
    for (const b of items.bolts) {
      if (b.target === ship && b.owner !== ship && gapS(track, b.s, ship.s) < ITEM.boltSpeed * 0.6) return true;
    }
    for (const m of items.mines) {
      const g = gapS(track, ship.s, m.s);
      if (g > 0 && g < v * 1 && Math.abs(m.d - ship.d) < ITEM.mineRadius + 1) return true;
    }
    return false;
  }
  if (ship.item === 'mine') {
    for (const o of ships) {
      if (o === ship) continue;
      const g = gapS(track, o.s, ship.s);             // how far o is behind
      if (g > 10 && g < 80 && Math.abs(o.d - ship.d) < 5) return true;
    }
    return false;
  }
  if (ship.item === 'bolt') {
    const t = boltTarget(ship, ships, track);
    if (!t || t.immune > 0) return false;
    const g = gapS(track, ship.s, t.s);
    return g > 20 && g < 200 && Math.abs(t.d - ship.d) < 6;
  }
  return false;
}
