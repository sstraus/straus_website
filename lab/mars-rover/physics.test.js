// Run with: node --test lab/proto/mars-rover/
import test from 'node:test';
import assert from 'node:assert/strict';
import { MARS, ROVER, CONSTANTS, createRover, step, jump, drag } from './physics.js';
import { createTerrain } from './terrain.js';

const flat = { height: () => 0, slope: () => 0 };
const incline = (k) => ({ height: (x) => k * x, slope: () => k });
const run = (rover, terrain, seconds, speed = 0, each) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    step(rover, terrain, 1 / 60, speed);
    each?.(rover);
  }
  return rover;
};

test('the rover falls with Mars gravity, not Earth gravity (catches g = 9.81 left in)', () => {
  const r = createRover(flat, 0);
  r.y += 40; // high above the ground: a free fall for well over a second
  run(r, flat, 1);
  // v = g t, and the air slows it by far less than a percent.
  assert.ok(Math.abs(-r.vy - MARS.g) / MARS.g < 0.01, `vy after 1 s = ${r.vy}`);
});

test('at rest on flat ground it settles and stays put (catches springs that pump energy in)', () => {
  const r = createRover(flat, 0);
  r.y += 0.3; // dropped from a little height, so the springs have something to absorb
  let late = 0;
  run(r, flat, 8, 0, (s) => { if (s.time > 6) late = Math.max(late, Math.abs(s.vy), Math.abs(s.w)); });
  assert.ok(late < 0.02, `still moving after 6 s: ${late}`);
  assert.ok(r.wheels.every((w) => w.contact), 'a wheel is off the ground at rest');
  // It sags into its springs by the design amount.
  const sag = r.wheels.map((w) => w.compression);
  for (const c of sag) assert.ok(Math.abs(c - CONSTANTS.SAG) < 0.02, `sag ${c}`);
});

test('a bounce never goes higher than the drop (catches an integrator that gains energy)', () => {
  const r = createRover(flat, 0);
  const start = r.y + 1.5;
  r.y = start;
  let peakAfterContact = -Infinity;
  let touched = false;
  run(r, flat, 6, 0, (s) => {
    if (s.grounded) touched = true;
    if (touched) peakAfterContact = Math.max(peakAfterContact, s.y);
  });
  assert.ok(touched);
  assert.ok(peakAfterContact < start, `bounced to ${peakAfterContact}, dropped from ${start}`);
});

test('a jump on Mars hangs in the air as long as Mars gravity says (catches a jump tuned for Earth)', () => {
  const r = createRover(flat, 0);
  run(r, flat, 3); // settle
  jump(r);
  let air = 0;
  let longest = 0;
  run(r, flat, 6, 0, (s) => {
    air = s.grounded ? 0 : air + 1 / 60;
    longest = Math.max(longest, air);
  });
  const expected = (2 * CONSTANTS.JUMP) / MARS.g; // about 1.8 s
  assert.ok(Math.abs(longest - expected) / expected < 0.25, `in the air ${longest.toFixed(2)} s, expected about ${expected.toFixed(2)} s`);
});

test('there is no jump in the air (catches a double jump)', () => {
  const r = createRover(flat, 0);
  r.y += 20;
  step(r, flat, 1 / 60, 0);
  const before = r.vy;
  jump(r);
  step(r, flat, 1 / 60, 0);
  assert.ok(r.vy < before, `the rover went up in mid-air: ${before} → ${r.vy}`);
});

test('the motors drive it to the target speed along the ground (catches a rover that never moves)', () => {
  const r = createRover(flat, 0);
  run(r, flat, 12, 10);
  assert.ok(Math.abs(r.vx - 10) < 0.6, `vx = ${r.vx}`);
});

test('downhill it runs faster than the motors ask for (catches a rover glued to its target speed)', () => {
  // The motors push up to the target speed but brake only lightly above it, so on a 25° slope
  // gravity wins and the rover gains speed. This is the Tiny Wings engine.
  const down = incline(-Math.tan((25 * Math.PI) / 180));
  const r = createRover(down, 0);
  run(r, down, 4, 8);
  const speed = Math.hypot(r.vx, r.vy);
  assert.ok(speed > 8.5, `speed on the slope ${speed}`);
});

test('the thin Martian air barely drags (catches drag computed with Earth air)', () => {
  const weight = ROVER.mass * MARS.g;
  assert.ok(drag(15) / weight < 0.01, `drag at 15 m/s is ${(100 * drag(15) / weight).toFixed(2)} % of the weight`);
  // The same rover in Earth air: 75 times the drag.
  assert.ok(drag(15, 1.2) / drag(15) > 70);
});

test('landing level on level ground reads as a small angle and a soft hit (catches a landing report with the wrong sign)', () => {
  const r = createRover(flat, 0);
  r.y += 2;
  let landed = null;
  run(r, flat, 3, 0, (s) => { if (s.landed) landed = s.landed; });
  assert.ok(landed, 'no landing was reported');
  assert.ok(Math.abs(landed.delta) < 0.05, `angle ${landed.delta}`);
  assert.ok(landed.vn > 0, `the hit reads ${landed.vn}: falling onto the ground must be positive`);
  assert.ok(landed.vn < 5, `a 2 m drop hits at ${landed.vn} m/s`);
});

test('nose first into a slope is a big angle and a hard hit (catches a grader that reads only the fall height)', () => {
  const up = incline(Math.tan((25 * Math.PI) / 180));
  const r = createRover(up, 0);
  r.a = -0.35; // nose down
  r.y += 3;
  r.vx = 10;
  let landed = null;
  run(r, up, 3, 10, (s) => { if (s.landed && !landed) landed = s.landed; });
  assert.ok(landed || r.crashed, 'nothing happened');
  if (landed) {
    assert.ok(Math.abs(landed.delta) > 0.5, `angle ${landed.delta}`);
    assert.ok(landed.vn > 5, `hit ${landed.vn}`);
  }
});

test('driving flat out into a wall ends the run (catches a hull that passes through rock)', () => {
  const wall = { height: (x) => (x > 14 ? 3 * Math.min(1, (x - 14) / 0.4) : 0), slope: (x) => (x > 14 && x < 14.4 ? 7.5 : 0) };
  const r = createRover(wall, 0);
  r.vx = 14;
  run(r, wall, 3, 14);
  assert.ok(r.crashed, 'the rover drove through a 3 m wall');
});

test('a jump at playing speed carries the rover over a ridge (catches a jump too weak to play with)', () => {
  // On the level start of the generated ground, up to playing speed, then one jump: it must carry the
  // rover farther than most ridges are wide.
  const ground = createTerrain(1);
  const r = createRover(ground, 2);
  let t0 = 0;
  while (r.vx < 11.5 && t0 < 20) { step(r, ground, 1 / 60, 12); t0 += 1 / 60; }
  assert.ok(r.vx >= 11.5, `never reached playing speed: ${r.vx}`);
  jump(r);
  const from = r.x;
  let air = true;
  let t = 0;
  while (air && t < 5) {
    step(r, ground, 1 / 60, 12);
    t += 1 / 60;
    if (r.grounded && t > 0.3) air = false;
  }
  assert.ok(r.x - from > 18, `the jump carried the rover ${(r.x - from).toFixed(1)} m`);
});
