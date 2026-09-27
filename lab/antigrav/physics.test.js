import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHIP, OFF, DT, createShip, stepShip, collideShips, speedOf, hoverAccel } from './physics.js';
import { buildTrack, HALF_WIDTH, WALL, gapS } from './track.js';
import { ring } from './testing.js';

const run = (ship, track, input, seconds, events) => {
  for (let t = 0; t < seconds; t += DT) stepShip(ship, input, track, DT, events);
  return ship;
};
const FULL = { throttle: 1, steer: 0, brakeL: 0, brakeR: 0 };

test('full throttle settles at the 140 m/s top speed (catches: drag linear in speed)', () => {
  const ship = run(createShip(ring()), ring(), FULL, 30);
  assert.ok(Math.abs(speedOf(ship) - SHIP.vmax) < 1, `v = ${speedOf(ship)}`);
});

test('0 to 100 m/s takes about 3 s (catches: thrust scaled by the step count instead of dt)', () => {
  const track = ring(), ship = createShip(track);
  let t = 0;
  while (speedOf(ship) < 100 && t < 20) { stepShip(ship, FULL, track); t += DT; }
  assert.ok(t > 2.4 && t < 3.6, `t = ${t}`);
});

test('the throttle is absolute: half throttle holds a lower speed (catches: throttle read as a rate)', () => {
  const track = ring();
  const ship = run(createShip(track), track, { ...FULL, throttle: 0.5 }, 30);
  assert.ok(Math.abs(speedOf(ship) - SHIP.vmax * Math.SQRT1_2) < 1.5, `v = ${speedOf(ship)}`);
});

test('the hover settles at its height and the field is continuous (catches: a spring with the wrong sign)', () => {
  const track = ring(), ship = createShip(track);
  ship.h = 3;
  run(ship, track, FULL, 3);
  assert.ok(Math.abs(ship.h - SHIP.h0) < 0.02, `h = ${ship.h}`);
  assert.ok(Math.abs(hoverAccel(SHIP.h0 - 1e-6) - hoverAccel(SHIP.h0 + 1e-6)) < 1e-3);
  assert.ok(hoverAccel(0.5) > 0 && hoverAccel(2) < 0 && hoverAccel(10) < 0);
});

test('the real loop at top speed compresses the hover but never grounds the hull (catches: a linear spring that scrapes through the loop)', () => {
  const track = buildTrack();
  const loop = track.zones.find((z) => z.tag === 'loop');
  const ship = createShip(track, { s: loop.s0 - 50 });
  ship.vx = SHIP.vmax + SHIP.padBoost;           // after the pad before the loop
  let minH = Infinity;
  while (ship.dist < loop.s1 + 20) { stepShip(ship, FULL, track); minH = Math.min(minH, ship.h); }
  assert.ok(minH > SHIP.deckMin + 0.05, `min h = ${minH}`);
  assert.ok(minH < SHIP.h0 - 0.3, 'the loop did not press the ship down at all');
});

test('the crest launches a fast ship and holds a slow one (catches: a missing -ku v^2 term)', () => {
  const track = buildTrack();
  const crest = track.zones.filter((z) => z.tag === 'crest');
  const from = crest[0].s0 - 20, to = crest[crest.length - 1].s1 + 40;
  const flight = (speed) => {
    const ship = createShip(track, { s: from });
    ship.vx = speed;
    let maxH = 0;
    while (ship.dist < to) { stepShip(ship, { ...FULL, throttle: speed / SHIP.vmax }, track); maxH = Math.max(maxH, ship.h); }
    return { maxH, ship };
  };
  const fast = flight(135), slow = flight(80);
  assert.ok(fast.maxH > 6, `fast ship only reached ${fast.maxH} m`);
  assert.ok(slow.maxH < SHIP.hoverRange, `slow ship left the field (${slow.maxH} m)`);
  // Both come back down to the hover after the landing sag.
  for (const f of [fast, slow]) { run(f.ship, track, FULL, 2); assert.ok(f.ship.h < 2, `h = ${f.ship.h}`); }
});

test('with no steering a right bend throws the ship to the left wall (catches: the frame turning the wrong way)', () => {
  const track = ring({ kn: 1 / 150 });
  const ship = createShip(track);
  ship.vx = 100;
  let minD = 0;
  for (let t = 0; t < 1.5; t += DT) { stepShip(ship, { ...FULL, throttle: 100 / SHIP.vmax }, track); minD = Math.min(minD, ship.d); }
  assert.ok(minD < -5, `d = ${minD}`);
});

test('full steer turns the path at 1.15 rad/s, an airbrake adds 0.85 (catches: yaw rate that ignores steer or brake)', () => {
  // Open deck (no walls, no curvature): measure how fast the velocity direction turns.
  const rate = (input) => {
    const track = ring({ halfWidth: 1e6 });
    const ship = createShip(track); ship.vx = 120;
    run(ship, track, input, 2);                    // settle yaw lag and slip
    const a0 = Math.atan2(ship.vy, ship.vx);
    run(ship, track, input, 0.5);
    const da = Math.atan2(ship.vy, ship.vx) - a0;
    return Math.atan2(Math.sin(da), Math.cos(da)) / 0.5;
  };
  const steer = rate({ ...FULL, steer: 1 });
  const both = rate({ ...FULL, steer: 1, brakeR: 1 });
  assert.ok(Math.abs(steer - SHIP.yawSteer) < 0.05, `steer ${steer}`);
  assert.ok(Math.abs(both - SHIP.yawSteer - SHIP.yawBrake) < 0.08, `steer + brake ${both}`);
  assert.ok(Math.abs(rate({ ...FULL, steer: -0.5 }) + SHIP.yawSteer / 2) < 0.05);
  // So the hairpin (about 100 m) needs an airbrake at speed: 140 m/s needs 1.4 rad/s.
  assert.ok(140 / 100 > SHIP.yawSteer && 140 / 100 < SHIP.yawSteer + SHIP.yawBrake);
});

test('the right airbrake yaws right, costs speed and lets the tail slide (catches: swapped airbrakes)', () => {
  const track = ring({ halfWidth: 1e6 });           // no walls in the way
  const base = createShip(track); base.vx = 120;
  const brake = createShip(track); brake.vx = 120;
  run(base, track, FULL, 0.8);
  run(brake, track, { ...FULL, brakeR: 1 }, 0.8);
  assert.ok(brake.psi > 0.3, `psi = ${brake.psi}`);
  assert.ok(speedOf(brake) < speedOf(base) - 5);
  const slip = (s) => Math.abs(-s.vx * Math.sin(s.psi) + s.vy * Math.cos(s.psi));
  assert.ok(slip(brake) > 2, 'no drift with the airbrake out');
});

test('grip kills sideways slip within a second (catches: slip that never decays, a ship on ice)', () => {
  const track = ring(), ship = createShip(track);
  ship.vx = 100; ship.vy = 20;
  run(ship, track, { ...FULL, throttle: 0.7 }, 1);
  const slip = -ship.vx * Math.sin(ship.psi) + ship.vy * Math.cos(ship.psi);
  assert.ok(Math.abs(slip) < 1, `slip = ${slip}`);
});

test('a wall hit bounces, keeps the ship on the deck and costs speed without stopping it (catches: a wall that stops dead or lets through)', () => {
  const track = ring(), ship = createShip(track);
  ship.vx = 120; ship.vy = 25; ship.d = 7; ship.psi = 0.2;
  const events = [];
  let maxD = 0;
  for (let t = 0; t < 0.3; t += DT) { stepShip(ship, { ...FULL, throttle: 0 }, track, DT, events); maxD = Math.max(maxD, ship.d); }
  const hit = events.find((e) => e.type === 'wall');
  assert.ok(hit && hit.side === 1);
  assert.ok(maxD <= HALF_WIDTH - SHIP.halfW + 1e-9);
  assert.ok(ship.vx > 60 && ship.vx < 115, `vx = ${ship.vx}`);
});

test('a speed pad fires once and adds 35 m/s that drag then bleeds off (catches: a pad that fires every step)', () => {
  const track = ring({ pads: [{ kind: 'speed', s: 50, d: 0, w: 3, l: 6 }] });
  const ship = createShip(track); ship.vx = 100;
  const events = [];
  run(ship, track, { ...FULL, throttle: 100 / SHIP.vmax }, 1, events);
  assert.equal(events.filter((e) => e.type === 'pad').length, 1);
  assert.ok(speedOf(ship) > 120 && speedOf(ship) < 135, `v = ${speedOf(ship)}`);
  run(ship, track, FULL, 20);
  assert.ok(Math.abs(speedOf(ship) - SHIP.vmax) < 1);
});

test('a pad off to the side is missed (catches: pads that ignore d)', () => {
  const track = ring({ pads: [{ kind: 'item', s: 50, d: 6, w: 2.2, l: 2.2 }] });
  const ship = createShip(track, { d: -6 }); ship.vx = 100;
  const events = [];
  run(ship, track, FULL, 1, events);
  assert.equal(events.length, 0);
});

test('two ships side by side are pushed apart and the one behind pays the bump (catches: ships that pass through each other)', () => {
  const track = ring();
  const a = createShip(track, { s: 100, d: 0 }), b = createShip(track, { s: 102, d: 1 });
  a.vx = 130; b.vx = 110;
  const events = [];
  collideShips([a, b], track, events);
  const apart = Math.abs(b.d - a.d) >= 2 * SHIP.halfW - 1e-9 || Math.abs(b.dist - a.dist) >= 2 * SHIP.halfL - 1e-9;
  assert.ok(apart, `still overlapping: ds ${b.dist - a.dist}, dd ${b.d - a.d}`);
  assert.equal(events.length, 1);
  const c = createShip(track, { s: 100, d: 0 }), e = createShip(track, { s: 103, d: 0.2 });
  c.vx = 130; e.vx = 100;
  collideShips([c, e], track);
  assert.ok(c.vx < 130 && e.vx <= 100);
});

test('a bump without a shield costs both ships speed and thrust, and the rammed ship never gains (catches: a bump that rewards the ship in front, or costs nothing)', () => {
  const track = ring();
  const back = createShip(track, { s: 100, d: 0 }), front = createShip(track, { s: 104, d: 0.3 });
  back.vx = 130; front.vx = 110;
  const events = [];
  collideShips([back, front], track, events);
  assert.ok(back.vx < 110, `rammer ${back.vx}`);
  assert.ok(front.vx < 110, `rammed ${front.vx}`);
  assert.ok(back.thrustCut > 0 && front.thrustCut > 0);
  assert.equal(events.filter((e) => e.type === 'bump').length, 1);
});

test('a shield takes the bump: the shielded ship pays nothing, the other pays (catches: a shield with no effect on contact)', () => {
  const track = ring();
  const a = createShip(track, { s: 100, d: 0 }), b = createShip(track, { s: 100.5, d: 2.5 });
  a.vx = 120; b.vx = 120; a.vy = 12; b.vy = -12; a.shield = 2;
  collideShips([a, b], track);
  assert.equal(a.vx, 120);
  assert.equal(a.thrustCut, 0);
  assert.ok(b.vx < 120 && b.thrustCut > 0);
});

test('ships that stay in contact pay once, then only separate (catches: a penalty and a spark burst every frame of the overlap)', () => {
  const track = ring();
  const a = createShip(track, { s: 100, d: 0 }), b = createShip(track, { s: 101, d: 3 });
  a.vx = 120; b.vx = 120; a.vy = 10; b.vy = -10;
  const events = [];
  collideShips([a, b], track, events);
  const v = a.vx;
  for (let k = 0; k < 20; k++) { a.d = 0; b.d = 3; a.vy = 10; b.vy = -10; collideShips([a, b], track, events); }
  assert.equal(events.filter((e) => e.type === 'bump').length, 1);
  assert.equal(a.vx, v);
  run(a, track, FULL, 0.7);                                // the contact cooldown runs out
  assert.equal(a.bump, 0);
});

test('ships overlapping mostly nose to tail are pushed apart along the track, not sideways (catches: a 2 m sideways snap on a rear-end touch)', () => {
  const track = ring();
  const a = createShip(track, { s: 100, d: 0 }), b = createShip(track, { s: 104.5, d: 0.5 });
  a.vx = 110; b.vx = 110;
  collideShips([a, b], track);
  assert.ok(Math.abs(a.d) < 0.05 && Math.abs(b.d - 0.5) < 0.05, `sideways: ${a.d}, ${b.d}`);
  assert.ok(b.dist - a.dist >= 2 * SHIP.halfL - 1e-9);
});

// A ship in the air near the right wall, drifting outward at 20 m/s.
const drifting = (track, h) => {
  const ship = createShip(track, { s: 100, d: HALF_WIDTH - SHIP.halfW - 0.5 });
  Object.assign(ship, { h, vx: 120, vy: 20, vh: 0 });
  return ship;
};

test('a ship above the wall top flies over it and off the track (catches: walls that stop a ship at any height)', () => {
  const track = ring(), events = [];
  const ship = drifting(track, 8);
  run(ship, track, FULL, 0.4, events);
  assert.ok(ship.off > 0, 'the ship is still held by the track');
  assert.ok(ship.d > WALL.d + SHIP.halfW, `d = ${ship.d}`);
  assert.equal(events.filter((e) => e.type === 'off').length, 1);
  assert.ok(!events.some((e) => e.type === 'wall'));
});

test('a ship below the wall top still hits the wall (catches: a fly-over that ignores the height)', () => {
  const track = ring(), events = [];
  const ship = drifting(track, 2);
  run(ship, track, FULL, 0.4, events);
  assert.ok(!(ship.off > 0));
  assert.ok(ship.d <= HALF_WIDTH - SHIP.halfW + 1e-9);
  assert.ok(events.some((e) => e.type === 'wall'));
});

test('off the track the field lets go: no pull back to the deck, no steering (catches: a hover spring that reels the ship in)', () => {
  const track = ring();
  const ship = drifting(track, 8);
  run(ship, track, FULL, 0.4);
  const { h, vh, psi } = ship;
  run(ship, track, { ...FULL, steer: 1 }, 0.3);
  assert.ok(Math.abs(ship.vh - vh) < 1e-9, `vh ${vh} -> ${ship.vh}`);
  assert.ok(Math.abs(ship.h - (h + vh * 0.3)) < 0.05, `h ${h} -> ${ship.h}`);
  assert.equal(ship.psi, psi);
});

test('after the flight the ship comes back centred where it left, slow, and pays the distance (catches: a free respawn ahead of the fall)', () => {
  const track = ring(), events = [];
  const ship = drifting(track, 8);
  const startDist = ship.dist, startS = ship.s;
  run(ship, track, FULL, 0.3 + OFF.time, events);
  const back = events.find((e) => e.type === 'respawn');
  assert.ok(back, 'no respawn');
  assert.ok(!(ship.off > 0));
  assert.ok(Math.abs(ship.d) < 1e-9 && Math.abs(ship.vy) < 1e-9 && ship.psi === 0);
  assert.ok(Math.abs(ship.h - SHIP.h0) < 0.5);
  assert.ok(speedOf(ship) < OFF.speed + 5, `v = ${speedOf(ship)}`);
  // Back near the point it left (within the 0.3 s before it cleared the wall), and dist agrees with s.
  assert.ok(gapS(track, startS, ship.s) < 0.3 * 125, `respawned ${gapS(track, startS, ship.s)} m ahead`);
  assert.ok(Math.abs(gapS(track, startS, ship.s) - (ship.dist - startDist)) < 1e-6);
});

test('a ship off the track touches nobody (catches: a flying ship that still shoves the pack)', () => {
  const track = ring();
  const a = createShip(track, { s: 100, d: 0 }), b = createShip(track, { s: 101, d: 1 });
  a.vx = b.vx = 100; a.off = 1;
  const events = [];
  collideShips([a, b], track, events);
  assert.equal(events.length, 0);
  assert.equal(b.d, 1);
});

test('a mine does not hold a ship that has left the track (catches: a mine drag that reels a flying ship back)', () => {
  const track = ring();
  const [held, free] = [drifting(track, 8), drifting(track, 8)];
  for (const ship of [held, free]) run(ship, track, FULL, 0.4);
  Object.assign(held, { mineDrag: 1, minePullD: 0 });
  for (const ship of [held, free]) run(ship, track, FULL, 0.2);
  assert.ok(Math.abs(held.vx - free.vx) < 1e-9, `vx ${held.vx} against ${free.vx}`);
  assert.ok(Math.abs(held.vy - free.vy) < 1e-9, `vy ${held.vy} against ${free.vy}`);
});

test('a side bump costs grip for a moment: the shove carries the ship sideways (catches: a bump the grip erases at once)', () => {
  const track = ring();
  const pair = () => {
    const a = createShip(track, { s: 100, d: 0 }), b = createShip(track, { s: 100.5, d: 3.5 });
    a.vx = b.vx = 110; a.vy = 12; b.vy = -12;
    return [a, b];
  };
  const [a] = pair();
  const [a2, b2] = pair();
  collideShips([a2, b2], track);
  a.vy = a2.vy;                                  // same shove, no contact
  run(a, track, FULL, 0.2); run(a2, track, FULL, 0.2);
  assert.ok(Math.abs(a2.vy) > 1.5 * Math.abs(a.vy), `vy after contact ${a2.vy} against ${a.vy}`);
});
