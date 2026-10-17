// Run with: node --test lab/proto/mars-rover/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, FLAT_START, MAX_SLOPE, difficulty } from './terrain.js';

const LENGTH = 20000; // m: longer than any real run

test('the same seed gives the same ground (catches a run that cannot be replayed)', () => {
  const a = createTerrain(7);
  const b = createTerrain(7);
  const c = createTerrain(8);
  let differs = false;
  for (let x = 0; x < 3000; x += 13.7) {
    assert.equal(a.height(x), b.height(x));
    if (Math.abs(a.height(x) - c.height(x)) > 1e-6) differs = true;
  }
  assert.ok(differs, 'two seeds made the same ground');
});

test('the start is level, so the first seconds are for watching (catches a bump under the spawn)', () => {
  const t = createTerrain(3);
  for (let x = 0; x < FLAT_START; x += 0.5) {
    assert.ok(Math.abs(t.height(x)) < 1e-9, `height ${t.height(x)} at ${x} m`);
    assert.ok(Math.abs(t.slope(x)) < 1e-9, `slope ${t.slope(x)} at ${x} m`);
  }
});

test('no face is steeper than a slip face can stand (catches a wall that no jump can save)', () => {
  for (const seed of [1, 2, 3, 42, 1234]) {
    const t = createTerrain(seed);
    let worst = 0;
    for (let x = 0; x < LENGTH; x += 0.25) worst = Math.max(worst, Math.abs(t.slope(x)));
    assert.ok(worst < MAX_SLOPE, `seed ${seed}: slope ${worst.toFixed(3)}`);
  }
});

test('the slope is the derivative of the height (catches a slope the physics reads wrongly)', () => {
  const t = createTerrain(11);
  for (let x = 1; x < 5000; x += 3.3) {
    const numeric = (t.height(x + 1e-4) - t.height(x - 1e-4)) / 2e-4;
    assert.ok(Math.abs(numeric - t.slope(x)) < 1e-4, `at ${x}: ${numeric} vs ${t.slope(x)}`);
  }
});

test('the ground has no steps (catches a dune cut off where the next one starts)', () => {
  const t = createTerrain(5);
  let worst = 0;
  for (let x = 0; x < LENGTH; x += 0.05) worst = Math.max(worst, Math.abs(t.height(x + 0.05) - t.height(x)));
  assert.ok(worst < 0.05 * MAX_SLOPE, `a step of ${worst} m`);
});

test('every dune has a gentle windward side and a steep slip face (catches a symmetric field with nothing to time)', () => {
  const t = createTerrain(2);
  const dunes = t.features(0, 6000);
  assert.ok(dunes.length > 40, `only ${dunes.length} dunes in 6 km`);
  for (const d of dunes) {
    let windward = 0;
    for (let x = d.start; x < d.crest; x += 0.1) windward = Math.max(windward, t.slope(x));
    let lee = 0;
    for (let x = d.crest; x < d.end; x += 0.1) lee = Math.max(lee, -t.slope(x));
    const deg = (s) => (Math.atan(s) * 180) / Math.PI;
    assert.ok(deg(windward) < 0.7 * deg(lee), `dune at ${d.start.toFixed(0)}: windward ${deg(windward).toFixed(1)}°, slip face ${deg(lee).toFixed(1)}°`);
    // The slip face is close to the angle of repose of sand, 30 to 34°.
    assert.ok(deg(lee) > 18 && deg(lee) < 36, `slip face of ${deg(lee).toFixed(1)}°`);
  }
});

test('the dunes grow taller and closer together further on (catches a game that never gets harder)', () => {
  const t = createTerrain(9);
  const stats = (x0, x1) => {
    const dunes = t.features(x0, x1);
    const mean = (f) => dunes.reduce((s, d) => s + f(d), 0) / dunes.length;
    return { height: mean((d) => d.height), perKm: (dunes.length * 1000) / (x1 - x0) };
  };
  const early = stats(FLAT_START, FLAT_START + 1500);
  const late = stats(4000, 7000);
  assert.ok(late.height > early.height * 1.3, `early ${early.height.toFixed(2)} m, late ${late.height.toFixed(2)} m`);
  assert.equal(difficulty(0), 0);
  assert.equal(difficulty(10000), 1);
});

test('the next crest is ahead and real (catches a coach pointing at a dune behind the rover)', () => {
  const t = createTerrain(4);
  for (let x = FLAT_START; x < 2000; x += 17) {
    const crest = t.nextCrest(x);
    if (!crest) continue;
    assert.ok(crest.c > x, `crest at ${crest.c} behind ${x}`);
    assert.ok(Math.abs(t.slope(crest.c)) < 0.2, 'the crest is not the top of the dune');
  }
});
