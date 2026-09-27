import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM, drawItem, createItems, equip, pickup, padReady, useItem, strike, updateItems, boltTarget } from './items.js';
import { SHIP, DT, createShip, stepShip, speedOf } from './physics.js';
import { mulberry32 } from './random.js';
import { ring } from './testing.js';

const FULL = { throttle: 1, steer: 0, brakeL: 0, brakeR: 0 };
const ship = (track, s, d = 0, v = 120) => { const x = equip(createShip(track, { s, d })); x.vx = v; return x; };
const tick = (state, ships, track, seconds, events, input = FULL) => {
  for (let t = 0; t < seconds; t += DT) {
    for (const s of ships) stepShip(s, input, track, DT, events);
    updateItems(state, ships, track, DT, events);
  }
};

test('the draw favours bolts for the last ship and mines/shields for the leader (catches: position weighting inverted)', () => {
  const rand = mulberry32(7);
  const count = (place) => {
    const c = { bolt: 0, mine: 0, shield: 0 };
    for (let i = 0; i < 20000; i++) c[drawItem(place, rand)]++;
    return c;
  };
  const lead = count(0), last = count(1);
  assert.ok(last.bolt > 2 * lead.bolt, `bolts ${lead.bolt} vs ${last.bolt}`);
  assert.ok(lead.mine > 3 * last.mine, `mines ${lead.mine} vs ${last.mine}`);
  assert.ok(lead.shield > 0 && last.shield > 0);
});

test('a pad gives an item only to an empty hold (catches: a pickup that replaces the held item)', () => {
  const track = ring(), s = ship(track, 0), state = createItems();
  const rand = mulberry32(1);
  assert.equal(pickup(state, s, { id: 'a' }, 0.5, rand), true);
  const held = s.item;
  assert.equal(pickup(state, s, { id: 'b' }, 0.5, rand), false);
  assert.equal(s.item, held);
});

test('a pad that gave an item stays dark for the cooldown, then lights again (catches: pads that never deplete)', () => {
  const track = ring(), a = ship(track, 0), b = ship(track, 50), state = createItems();
  const rand = mulberry32(2), pad = { id: 'p' };
  assert.equal(pickup(state, a, pad, 0.5, rand), true);
  assert.equal(pickup(state, b, pad, 0.5, rand), false, 'a dark pad gives nothing');
  assert.equal(b.item, null);
  assert.equal(pickup(state, b, { id: 'q' }, 0.5, rand), true, 'another pad still works');
  b.item = null;
  tick(state, [], track, ITEM.padCooldown - 0.1, []);
  assert.equal(padReady(state, pad), false);
  tick(state, [], track, 0.2, []);
  assert.equal(padReady(state, pad), true);
  assert.equal(pickup(state, b, pad, 0.5, rand), true);
});

test('a bolt homes onto the first ship ahead, slows it and cuts its thrust (catches: bolts that hit the shooter)', () => {
  const track = ring();
  const shooter = ship(track, 100, 0), near = ship(track, 180, 5), far = ship(track, 300, -5);
  const all = [shooter, near, far];
  assert.equal(boltTarget(shooter, all, track), near);
  const state = createItems(), events = [];
  shooter.item = 'bolt';
  useItem(state, shooter, all, track, events);
  const before = speedOf(near);
  tick(state, all, track, 0.5, events);
  const hit = events.find((e) => e.type === 'hit');
  assert.ok(hit && hit.ship === near, 'the bolt did not hit the ship ahead');
  assert.ok(speedOf(near) < before * 0.75, `v ${speedOf(near)}`);
  assert.ok(near.thrustCut > 0 || near.throttle === 0);
  assert.equal(shooter.immune, 0);
  assert.equal(state.bolts.length, 0);
});

test('a bolt with nobody in reach flies out and expires (catches: bolts that live forever)', () => {
  const track = ring(), a = ship(track, 0), b = ship(track, 2000);
  const state = createItems(), events = [];
  a.item = 'bolt';
  useItem(state, a, [a, b], track, events);
  tick(state, [a, b], track, ITEM.boltLife + 0.1, events);
  assert.equal(state.bolts.length, 0);
  assert.ok(events.some((e) => e.type === 'boltEnd' && e.result === 'miss'));
  assert.ok(!events.some((e) => e.type === 'hit'));
});

test('a shield absorbs one hit at no speed cost and is used up (catches: a permanent shield)', () => {
  const track = ring(), s = ship(track, 0);
  s.item = 'shield';
  useItem(createItems(), s, [s], track);
  assert.equal(s.shield, ITEM.shield);
  assert.equal(strike(s, 'bolt'), 'shield');
  assert.equal(s.vx, 120);
  assert.equal(s.shield, 0);
  assert.equal(strike(s, 'bolt'), 'hit');
});

test('after a hit the ship is immune for 1.8 s (catches: stun-lock by a second bolt)', () => {
  const track = ring(), s = ship(track, 0);
  assert.equal(strike(s, 'bolt'), 'hit');
  const v = s.vx;
  assert.equal(strike(s, 'bolt'), 'immune');
  assert.equal(s.vx, v);
  const state = createItems();
  tick(state, [s], track, ITEM.immune + 0.05);
  assert.equal(strike(s, 'mine'), 'hit');
});

test('a mine drags the ship back without stopping it and spares its owner while arming (catches: a mine that stops dead)', () => {
  const track = ring();
  const layer = ship(track, 500, 0, 120), victim = ship(track, 420, 1, 130);
  const state = createItems(), events = [];
  layer.item = 'mine';
  useItem(state, layer, [layer, victim], track, events);
  assert.ok(!events.some((e) => e.type === 'hit' && e.ship === layer));
  let minV = Infinity;
  for (let t = 0; t < 2; t += DT) {
    for (const s of [layer, victim]) stepShip(s, FULL, track, DT, events);
    updateItems(state, [layer, victim], track, DT, events);
    minV = Math.min(minV, speedOf(victim));
  }
  const hit = events.find((e) => e.type === 'hit');
  assert.ok(hit && hit.ship === victim && hit.item === 'mine');
  assert.ok(minV > 70 && minV < 110, `min v ${minV}`);
  assert.equal(state.mines.length, 0);
});

test('an immune ship passes a mine and the mine waits for the next one (catches: immunity that wastes the mine)', () => {
  const track = ring();
  const state = { ...createItems(), mines: [{ owner: null, s: 100, d: 0, age: 5 }] };
  const a = ship(track, 90), b = ship(track, 40);
  a.immune = 1;
  const events = [];
  tick(state, [a, b], track, 0.6, events);
  const hits = events.filter((e) => e.type === 'hit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].ship, b);
});

test('a mine expires after 25 s (catches: a track that fills with mines)', () => {
  const track = ring();
  const state = { ...createItems(), mines: [{ owner: null, s: 100, d: 0, age: 0 }] };
  updateItems(state, [], track, ITEM.mineLife + 0.01);
  assert.equal(state.mines.length, 0);
});

test('one hit costs between 1 and 2 seconds of race time (catches: a hit that ends the race, or one that costs nothing)', () => {
  const track = ring({ length: 20000 });
  const timeTo = (dist, hitAt, kind) => {
    const s = ship(track, 0, 0, SHIP.vmax);
    let t = 0, done = false;
    while (s.dist < dist) {
      if (!done && s.dist >= hitAt) {
        strike(s, kind, kind === 'mine' ? { d: 0 } : null);
        done = true;
      }
      // A pilot who holds the centre line after the wobble.
      const steer = Math.max(-1, Math.min(1, -3 * s.psi - 0.1 * s.d - 0.05 * s.vy));
      stepShip(s, { ...FULL, steer }, track);
      s.immune = Math.max(0, s.immune - DT);
      t += DT;
    }
    return t;
  };
  const clean = timeTo(4000, Infinity);
  for (const kind of ['bolt', 'mine']) {
    const lost = timeTo(4000, 1000, kind) - clean;
    assert.ok(lost > 1 && lost < 2, `${kind} costs ${lost.toFixed(2)} s`);
  }
});

test('a ship off the track is out of play: no bolt aims at it (catches: a bolt that chases a ship over the wall)', () => {
  const track = ring();
  const shooter = ship(track, 100, 0), flying = ship(track, 150, 0), next = ship(track, 250, 0);
  flying.off = 1;
  assert.equal(boltTarget(shooter, [shooter, flying, next], track), next);
});

test('a bolt already homing drops a target that leaves the track (catches: a bolt that follows it out)', () => {
  const track = ring();
  const shooter = ship(track, 100, 0), target = ship(track, 400, 0, 0);
  const state = createItems();
  shooter.item = 'bolt';
  useItem(state, shooter, [shooter, target], track);
  target.off = 10; target.d = 30;
  updateItems(state, [shooter, target], track, DT);
  assert.equal(state.bolts[0].target, null);
  assert.ok(Math.abs(state.bolts[0].d) < 1);
});
