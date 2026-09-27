// Ship handling in track space. The station s runs along the centre line, d to the right of it,
// h above the deck. The velocity lives in the track frame: vx along T, vy along N. The ship's
// heading psi is measured from T (positive = pointing right). The circuit is in orbit, so there
// is no gravity: the track's field holds the ship at its hover height, and every curve of the
// track shows up as the fictitious term -k v^2 in the frame that turns with it.

import { frameAt, gapS, wrapS, WALL } from './track.js';

export const DT = 1 / 120;

export const SHIP = {
  h0: 1.2,                 // m, hover height
  omega: 2 * Math.PI * 1.3,
  zeta: 0.55,
  hoverRange: 4,           // m, above this the field only pulls weakly
  farPull: 30,             // m/s^2 at the edge of the range, falling as 1/h^2
  deckMin: 0.25,           // m, the hull touches the deck
  thrust: 45,              // m/s^2
  vmax: 140,               // m/s at full throttle on a straight
  yawSteer: 1.15,          // rad/s at full steer
  yawBrake: 0.85,          // rad/s per airbrake
  yawLag: 0.12,            // s
  grip: 3.5,               // 1/s, how fast sideways slip dies
  gripBrake: 2.4,          // 1/s with an airbrake out: the ship drifts
  slipToSpeed: 0.5,        // share of the killed slip energy that the fins turn into forward speed
  brakeDrag: 0.12,         // 1/s per airbrake
  halfW: 2,                // m
  halfL: 2.4,              // m
  reflect: 0.3,            // wall restitution
  scrape: 22,              // m/s^2 while grinding along a wall
  padBoost: 35,            // m/s
  airSteer: 0.35,          // steering and grip authority in the air
  mineDecel: 60,           // m/s^2 while a magnetic mine holds the ship
};
SHIP.drag = SHIP.thrust / (SHIP.vmax * SHIP.vmax);

// A ship that jumps over the wall has no deck under it: it flies straight for `time` seconds,
// then the marshals put it back where it left, centred, at `speed`.
export const OFF = { time: 1.5, speed: 0.4 * SHIP.vmax };

export function createShip(track, { s = 0, d = 0, id = 0 } = {}) {
  return {
    id, s: wrapS(track, s), dist: s, d, h: SHIP.h0, vx: 0, vy: 0, vh: 0, psi: 0, r: 0, t: 0,
    thrustCut: 0, wobble: 0, mineDrag: 0, minePullD: 0, bump: 0, slip: 0, off: 0, offS: 0,
    air: false, scraping: false, throttle: 0, frame: frameAt(track, s),
  };
}

export const speedOf = (ship) => Math.hypot(ship.vx, ship.vy);

// Hover acceleration along U from the field alone. Above h0 a linear spring; below it the field
// stiffens as 1/h^3 (same slope at h0), so a loop at full speed compresses the gap without closing it.
export function hoverAccel(h) {
  const { h0, omega, hoverRange, farPull } = SHIP;
  const w2 = omega * omega;
  if (h > hoverRange) return -farPull * (hoverRange / h) ** 2;
  if (h >= h0) return w2 * (h0 - h);
  return w2 * h0 * ((h0 / h) ** 3 - 1) / 3;
}

const NO_INPUT = { throttle: 0, steer: 0, brakeL: 0, brakeR: 0 };

// One fixed step. `events` collects what the game, the sound and the camera react to.
export function stepShip(ship, input = NO_INPUT, track, dt = DT, events = null) {
  const P = SHIP;
  const f = frameAt(track, ship.s, ship.frame);
  ship.t += dt;
  // Off the track nothing holds or steers the ship: no field, no grip, no fins.
  const held = !(ship.off > 0);
  if (!held) input = NO_INPUT;
  const brakes = (input.brakeL ? 1 : 0) + (input.brakeR ? 1 : 0);
  const u = ship.thrustCut > 0 ? 0 : Math.max(0, Math.min(1, input.throttle));
  ship.throttle = u;

  // Body components of the velocity.
  const c = Math.cos(ship.psi), sn = Math.sin(ship.psi);
  let vf = ship.vx * c + ship.vy * sn;
  let vl = -ship.vx * sn + ship.vy * c;
  const v = Math.hypot(vf, vl);

  // Thrust, drag, airbrakes, the mine's pull-back.
  const lin = P.drag * v + P.brakeDrag * brakes;
  vf += (u * P.thrust - lin * vf) * dt;
  vl -= lin * vl * dt;
  if (held && ship.mineDrag > 0 && v > 1) {
    const k = Math.min(1, (P.mineDecel * dt) / v);
    vf -= vf * k; vl -= vl * k;
  }

  // Grip kills sideways slip; the fins give part of that energy back as forward speed. The grip
  // comes from the field, so in the air it is as weak as the steering and a jump keeps its drift.
  // Just after a bump the fins have lost their bite (slip), so the shove carries the ship across.
  const g = !held ? 0 : (brakes ? P.gripBrake : P.grip) * (ship.air ? P.airSteer : 1) * (ship.slip > 0 ? 0.25 : 1);
  const vl2 = vl * Math.exp(-g * dt);
  const back = P.slipToSpeed * (vl * vl - vl2 * vl2);
  vf = Math.sign(vf || 1) * Math.sqrt(vf * vf + back);
  vl = vl2;
  ship.vx = vf * c - vl * sn;
  ship.vy = vf * sn + vl * c;

  // Yaw: steering and airbrakes set a rate that the hull reaches with a short lag.
  const authority = ship.air ? P.airSteer : 1;
  let rCmd = !held ? 0 : authority * (input.steer * P.yawSteer + ((input.brakeR ? 1 : 0) - (input.brakeL ? 1 : 0)) * P.yawBrake);
  if (held && ship.wobble > 0) rCmd += 1.4 * Math.sin(ship.t * 19) * Math.min(1, ship.wobble / 0.4);
  ship.r = held ? ship.r + (rCmd - ship.r) * (1 - Math.exp(-dt / P.yawLag)) : 0;

  // The frame turns under the ship: heading and velocity rotate back by the same angle.
  const sdot = ship.vx / Math.max(0.2, 1 - f.kn * ship.d);
  const turn = f.kn * sdot * dt;
  ship.psi += ship.r * dt - turn;
  const ct = Math.cos(turn), st = Math.sin(turn);
  const vx = ship.vx * ct + ship.vy * st;
  ship.vy = -ship.vx * st + ship.vy * ct;
  ship.vx = vx;
  if (held && ship.mineDrag > 0) ship.vy += (ship.minePullD - ship.d) * 4 * dt;

  // Hover: the field against the deck's curvature (a dip presses down, a crest throws off).
  const field = held ? hoverAccel(ship.h) - (ship.h < P.hoverRange ? 2 * P.zeta * P.omega * ship.vh : 0) : 0;
  ship.vh += (field - f.ku * sdot * sdot) * dt;
  ship.h += ship.vh * dt;
  if (held && ship.h < P.deckMin) {
    if (ship.vh < -4 && events) events.push({ type: 'land', ship, strength: -ship.vh });
    ship.h = P.deckMin;
    if (ship.vh < 0) ship.vh *= -0.2;
    ship.vx *= 1 - 0.5 * dt;
  }
  ship.air = ship.h > P.hoverRange;

  // Advance.
  const sOld = ship.s;
  ship.s = wrapS(track, ship.s + sdot * dt);
  ship.dist += sdot * dt;
  ship.d += ship.vy * dt;

  // Walls. The outward speed reflects weakly and costs forward speed; grinding along costs more.
  // A ship above the wall top passes over it, and once the hull clears the rail it is off.
  const limit = track.halfWidth - P.halfW;
  ship.scraping = false;
  const over = ship.h > WALL.h1;
  if (held && over && Math.abs(ship.d) > WALL.d + P.halfW) {
    ship.off = OFF.time;
    if (events) events.push({ type: 'off', ship });
  } else if (held && !over && Math.abs(ship.d) >= limit) {
    const side = Math.sign(ship.d);
    ship.d = side * limit;
    const vn = ship.vy * side;
    if (vn > 2) {
      // A real hit: bounce, lose speed, and the nose is knocked parallel to the wall.
      const sp = Math.max(1, Math.abs(ship.vx));
      ship.vx *= 1 - Math.min(0.35, 0.8 * vn / sp);
      ship.vy = -side * vn * P.reflect;
      if (ship.psi * side > 0) ship.psi *= 0.5;
      ship.r *= 0.3;
      if (events) events.push({ type: 'wall', ship, strength: vn, side });
    } else if (vn > 0) {
      ship.vy = 0;                                  // resting contact
    }
    if (ship.psi * side > -0.02) {
      ship.scraping = true;
      ship.vx -= Math.sign(ship.vx) * Math.min(Math.abs(ship.vx), P.scrape * dt);
    }
  }

  // Pads crossed during this step.
  const ds = gapS(track, sOld, ship.s);
  if (held && ds > 0 && ship.h < 3) {
    for (const pad of track.pads) {
      const into = gapS(track, sOld, pad.s);
      if (into <= 0 || into > ds) continue;
      if (Math.abs(ship.d - pad.d) > pad.w + P.halfW * 0.5) continue;
      if (pad.kind === 'speed') {
        ship.vx += P.padBoost * Math.cos(ship.psi);
        ship.vy += P.padBoost * Math.sin(ship.psi);
      }
      if (events) events.push({ type: pad.kind === 'speed' ? 'pad' : 'pickup', ship, pad });
    }
  }

  ship.thrustCut = Math.max(0, ship.thrustCut - dt);
  ship.bump = Math.max(0, ship.bump - dt);
  ship.slip = Math.max(0, ship.slip - dt);
  ship.wobble = Math.max(0, ship.wobble - dt);
  ship.mineDrag = Math.max(0, ship.mineDrag - dt);
  if (held) ship.offS = ship.s;
  else if ((ship.off -= dt) <= 0) putBack(ship, track, events);
  return ship;
}

// Back on the deck where the ship left it: the run it flew is taken off its distance too.
function putBack(ship, track, events) {
  ship.dist -= gapS(track, ship.offS, ship.s);
  Object.assign(ship, { s: ship.offS, d: 0, h: SHIP.h0, vx: OFF.speed, vy: 0, vh: 0, psi: 0, r: 0, off: 0, air: false });
  if (events) events.push({ type: 'respawn', ship });
}

// Ships are boxes in (s, d). Overlapping pairs separate along the smaller overlap: end-on the
// one behind is held to the speed of the one in front, side by side they trade lateral speed.
const BUMP = { real: 3, cooldown: 0.6, cut: 0.25, wobble: 0.4, slip: 0.35 };

// A real contact costs every ship without a shield some speed, a short thrust cut, a yaw wobble
// and a moment of grip, once per contact (a cooldown), so trading paint is never free.
function payBump(ship, strength) {
  if (ship.shield > 0) return;
  ship.vx *= 1 - Math.min(0.2, 0.04 + 0.012 * strength);
  ship.thrustCut = Math.max(ship.thrustCut, BUMP.cut);
  ship.wobble = Math.max(ship.wobble, BUMP.wobble);
  ship.slip = Math.max(ship.slip, BUMP.slip);
}

export function collideShips(ships, track, events = null) {
  const P = SHIP;
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i], b = ships[j];
      if (a.off > 0 || b.off > 0) continue;
      const gs = gapS(track, a.s, b.s);           // b ahead of a when positive
      const gd = b.d - a.d;
      const os = 2 * P.halfL - Math.abs(gs), od = 2 * P.halfW - Math.abs(gd);
      if (os <= 0 || od <= 0 || Math.abs(a.h - b.h) > 2.5) continue;
      const side = Math.sign(gd) || 1;
      const [back, front] = gs >= 0 ? [a, b] : [b, a];
      const closing = back.vx - front.vx;
      const rel = (b.vy - a.vy) * side;           // < 0 when they close sideways
      // Apart along the smaller overlap: a rear-end touch never snaps the ships sideways.
      const endOn = os < od;
      if (endOn) {
        back.s = wrapS(track, back.s - os / 2); back.dist -= os / 2;
        front.s = wrapS(track, front.s + os / 2); front.dist += os / 2;
        if (closing > 0) back.vx -= closing;      // the one behind is held; the one in front gains nothing
      } else {
        a.d -= side * od / 2; b.d += side * od / 2;
        if (rel < 0) { a.vy += side * rel * 0.75; b.vy -= side * rel * 0.75; }
      }
      const strength = Math.max(endOn ? closing : 0, endOn ? 0 : -rel, 0);
      if (strength < BUMP.real || (a.bump > 0 && b.bump > 0)) continue;
      for (const [ship, away] of [[a, -side], [b, side]]) {
        if (ship.bump > 0) continue;
        payBump(ship, strength);
        // A side hit knocks the nose away from the other ship.
        if (!endOn && !(ship.shield > 0)) ship.r += away * Math.min(1, strength / 15) * 0.8;
        ship.bump = BUMP.cooldown;
      }
      if (events) events.push({ type: 'bump', ship: a, other: b, strength });
    }
  }
}
