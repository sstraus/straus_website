import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLine, createPilot, drive, itemUseful, DIFFICULTY } from './ai.js';
import { createShip, stepShip, DT, SHIP } from './physics.js';
import { createItems, equip, ITEM } from './items.js';
import { buildTrack, gapS } from './track.js';
import { mulberry32 } from './random.js';
import { ring } from './testing.js';

const track = buildTrack();
const zone = (tag) => track.zones.find((z) => z.tag === tag);

// One pilot alone for `laps` laps. Returns lap times and wall hits.
function solo(level, { laps = 1, seed = 3, diff = null } = {}) {
  const pilot = createPilot(track, level, mulberry32(seed));
  if (diff) pilot.diff = { ...pilot.diff, ...diff };
  const ship = equip(createShip(track, { s: track.startS }));
  const ctx = { ships: [ship], items: createItems(), track, dt: DT };
  const events = [], times = [];
  let t = 0, last = 0;
  while (times.length < laps && t < 120 * laps) {
    stepShip(ship, drive(pilot, ship, ctx), track, DT, events);
    t += DT;
    if (ship.dist - track.startS >= (times.length + 1) * track.length) { times.push(t - last); last = t; }
  }
  return { times, walls: events.filter((e) => e.type === 'wall').length };
}

test('the racing line takes the inside of the hairpin (catches: a lean with the wrong sign, which aims at the outer wall)', () => {
  const line = buildLine(track, DIFFICULTY.pro.yaw);
  const z = zone('hairpin');                          // a left hairpin: inside is d < 0
  const mid = Math.round((z.s0 + z.s1) / 2 / track.step);
  assert.ok(track.kn[mid] < 0);
  assert.ok(line.d[mid] < -4, `line at the apex ${line.d[mid]}`);
  const straight = Math.round((zone('tunnel').s0 + 300) / track.step);
  assert.ok(Math.abs(line.d[straight]) < 1);
});

test('the speed plan respects the yaw budget and brakes before the bend (catches: a missing backward braking pass)', () => {
  const yaw = DIFFICULTY.pro.yaw;
  const line = buildLine(track, yaw);
  const z = zone('hairpin');
  const apex = Math.round((z.s0 + z.s1) / 2 / track.step);
  assert.ok(Math.abs(line.v[apex] - yaw / Math.abs(track.kn[apex])) < 5);
  for (let i = 0; i < line.count; i++) {
    const a = line.v[i], b = line.v[(i + 1) % line.count];
    assert.ok(a * a - b * b <= 2 * 26 * track.step + 1e-6, `braking too late at ${i}`);
  }
  const before = Math.round((z.s0 - 100) / track.step);
  assert.ok(line.v[before] < SHIP.vmax + SHIP.padBoost - 1, 'no braking zone before the hairpin');
});

test('a Pro pilot laps the real circuit clean in about 50 s (catches: an unstable steering loop that bounces off the walls)', () => {
  const { times, walls } = solo('pro', { diff: { lineError: 0, speedError: 0 } });
  assert.equal(times.length, 1);
  assert.ok(times[0] > 45 && times[0] < 58, `lap ${times[0]}`);
  assert.equal(walls, 0);
});

test('Easy is slower than Pro by a few seconds a lap (catches: a difficulty setting with no effect)', () => {
  const pro = solo('pro', { laps: 2 }).times[1];
  const easy = solo('easy', { laps: 2 }).times[1];
  assert.ok(easy - pro > 2 && easy - pro < 9, `pro ${pro}, easy ${easy}`);
});

test('pilot errors can put a ship into the wall (catches: errors that never reach the controls)', () => {
  const { walls } = solo('easy', { laps: 2, seed: 11, diff: { lineError: 7 } });
  assert.ok(walls > 0);
});

test('item timing: shield against an incoming bolt, mine for a ship close behind, bolt for a ship in range (catches: items fired at random)', () => {
  const t = ring();
  const me = equip(createShip(t, { s: 500 })); me.vx = 120;
  const behind = equip(createShip(t, { s: 460, d: 1 })); behind.vx = 125;
  const ahead = equip(createShip(t, { s: 600, d: 2 })); ahead.vx = 118;
  const far = equip(createShip(t, { s: 1500 })); far.vx = 118;
  const items = createItems();
  const ctx = { ships: [me, behind, ahead], items, track: t };

  me.item = 'bolt';
  assert.equal(itemUseful(me, ctx), true);
  assert.equal(itemUseful(me, { ...ctx, ships: [me, far] }), false, 'a bolt with no target is wasted');
  ahead.immune = 1;
  assert.equal(itemUseful(me, ctx), false, 'no point shooting an immune ship');
  ahead.immune = 0;

  me.item = 'mine';
  assert.equal(itemUseful(me, ctx), true);
  assert.equal(itemUseful(me, { ...ctx, ships: [me, ahead] }), false, 'a mine with nobody behind is wasted');

  me.item = 'shield';
  assert.equal(itemUseful(me, ctx), false);
  items.bolts.push({ owner: behind, target: me, s: 400, d: 0, h: 1.2, life: 1 });
  assert.equal(itemUseful(me, ctx), true);
  items.bolts.length = 0;
  items.mines.push({ owner: ahead, s: 560, d: 0.5, age: 3 });
  assert.equal(itemUseful(me, ctx), true);
});

test('a pilot steers around a mine on its line (catches: pilots blind to mines)', () => {
  const t = ring({ length: 4000 });
  const run = (withMine) => {
    const pilot = createPilot(t, 'pro', mulberry32(5), {});
    pilot.diff = { ...pilot.diff, lineError: 0, speedError: 0, react: 1 };
    const ship = equip(createShip(t, { s: 0 })); ship.vx = 120;
    const items = { bolts: [], mines: withMine ? [{ owner: null, s: 300, d: 0, age: 5 }] : [] };
    const ctx = { ships: [ship], items, track: t, dt: DT };
    let minGap = Infinity;
    while (ship.dist < 320) {
      stepShip(ship, drive(pilot, ship, ctx), t, DT);
      if (Math.abs(gapS(t, ship.s, 300)) < 5) minGap = Math.min(minGap, Math.abs(ship.d));
    }
    return minGap;
  };
  assert.ok(run(true) > ITEM.mineRadius, 'the pilot drove over the mine');
  assert.ok(run(false) < 1);
});

test('a pilot far ahead of the player eases off, never the player itself (catches: a rubber band with the wrong sign, or one that slows the autopilot)', () => {
  const s = zone('tunnel').s0 + 300;                   // a long straight: the cap decides the throttle
  const throttleWith = (lead, self = false) => {
    const pilot = createPilot(track, 'pro', mulberry32(5));
    pilot.diff = { ...pilot.diff, lineError: 0, speedError: 0 };
    const ship = equip(createShip(track, { s }));
    Object.assign(ship, { vx: 136 });
    const player = self ? ship : equip(createShip(track, { s }));
    if (!self) player.dist = ship.dist - lead;
    return drive(pilot, ship, { ships: [ship, player], items: createItems(), track, dt: DT, player }).throttle;
  };
  const close = throttleWith(20), far = throttleWith(400), behind = throttleWith(-400);
  assert.ok(far < close - 0.05, `far ahead ${far} vs close ${close}`);
  assert.equal(behind, close);
  assert.equal(throttleWith(0, true), close);
});
