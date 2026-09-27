import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoadModel, strokeFraction, unitKey, sizeChanged } from '../../lab/lib/intro-core.js';

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

// Catches: a timing row credited to the next label (off by one), so the slow phase gets the wrong name.
test('each timing row carries the label that was on screen while the time passed', () => {
  const c = clock();
  const m = createLoadModel({ steps: 4, now: c.now });
  c.advance(300);
  m.step('Compiling the coil');
  c.advance(1200);
  m.step('Warming up');
  c.advance(500);
  const rows = m.finish();
  assert.deepEqual(rows, [
    { phase: 'Loading three.js', ms: 300 },
    { phase: 'Compiling the coil', ms: 1200 },
    { phase: 'Warming up', ms: 500 },
    { phase: 'total', ms: 2000 },
  ]);
});

// Catches: the bar jumping back when a late progress report is smaller, or when the plan grows.
test('the displayed progress never goes back', () => {
  const m = createLoadModel({ steps: 5, now: () => 0 });
  let last = 0;
  const check = () => {
    const v = m.tick(0.1);
    assert.ok(v >= last, `${v} < ${last}`);
    last = v;
  };
  m.step('a');
  m.progress(0.8);
  for (let i = 0; i < 20; i++) check();
  m.progress(0.2); // out-of-order report
  check();
  m.expect(9); // more steps than planned
  for (let i = 0; i < 20; i++) check();
  m.step('b');
  check();
});

// Catches: a bar that sits still during a long compile that reports nothing ("people close the page").
test('with no reports the bar keeps creeping, but never claims the step is done', () => {
  const m = createLoadModel({ steps: 4, now: () => 0 });
  m.step('Compiling the coil'); // step 1 of 4 ends at 0.5
  const values = [];
  for (let i = 0; i < 20; i++) values.push(m.tick(0.5));
  for (let i = 1; i < 6; i++) assert.ok(values[i] > values[i - 1], `stalled at tick ${i}: ${values[i]}`);
  for (let i = 0; i < 2000; i++) m.tick(0.5);
  assert.ok(m.value < 0.5, `creep reached the end of the step: ${m.value}`);
});

// Catches: steps taken beyond the plan pushing the value past 1 or freezing it at 1 before the end.
test('extra steps keep the value below 1 until finish', () => {
  const m = createLoadModel({ steps: 2, now: () => 0 });
  for (const label of ['a', 'b', 'c', 'd']) {
    m.step(label);
    for (let i = 0; i < 50; i++) m.tick(0.2);
    assert.ok(m.value < 1, `${label}: ${m.value}`);
  }
  m.finish();
  assert.equal(m.value, 1);
});

// Catches: a stroke drawn before its turn or never completed at the end of the load.
test('a stroke draws only between its start and its end in pen time', () => {
  assert.equal(strokeFraction(0.2, 3, 1, 10), 0); // pen at 2 s, stroke starts at 3 s
  assert.ok(Math.abs(strokeFraction(0.35, 3, 1, 10) - 0.5) < 1e-9);
  assert.equal(strokeFraction(0.5, 3, 1, 10), 1);
  assert.equal(strokeFraction(1, 9.9, 0.1, 10), 1); // the last stroke is complete at p = 1
});

function part({ material = { uuid: 'm1' }, attributes = { position: { itemSize: 3 }, normal: { itemSize: 3 } }, parent = null, ...rest } = {}) {
  return { type: 'Mesh', material, geometry: { attributes, morphAttributes: {}, index: {} }, parent, receiveShadow: true, castShadow: true, uuid: rest.uuid ?? 'o1', ...rest };
}

// Catches: a key that includes the object itself, so every bolt is compiled again (no dedupe).
test('parts with the same material and vertex layout share one precompile render', () => {
  assert.equal(unitKey(part({ uuid: 'a' })), unitKey(part({ uuid: 'b' })));
});

// Catches: a key that misses what changes the shader, so a part is skipped and builds on the first frame.
test('material, vertex layout, shadows, instancing and clipping each get their own render', () => {
  const base = unitKey(part());
  assert.notEqual(unitKey(part({ material: { uuid: 'm2' } })), base);
  assert.notEqual(unitKey(part({ attributes: { position: { itemSize: 3 } } })), base); // no normals
  assert.notEqual(unitKey(part({ receiveShadow: false })), base);
  assert.notEqual(unitKey(part({ uuid: 'a', isInstancedMesh: true })), unitKey(part({ uuid: 'b', isInstancedMesh: true })));
  const clip = { isClippingGroup: true, uuid: 'cg', parent: null };
  assert.notEqual(unitKey(part({ parent: { parent: clip } })), base); // inside a cutaway group
});

// Catches: re-allocating only the texture that wrote the new size into the shared image. Loaded at
// 390x844, grown to 1440x900: the second target's texture stays small and the copy overflows it.
test('every copy texture that shares one image re-allocates after the window grows', () => {
  const image = { width: 390, height: 844 };
  const scene = { image };
  const pre = { image }; // clone(): same image object
  const sizes = new WeakMap();
  assert.equal(sizeChanged(sizes, scene), true); // first copy allocates
  assert.equal(sizeChanged(sizes, pre), true);
  assert.equal(sizeChanged(sizes, scene), false); // same size: no re-allocation every frame
  image.width = 1440; image.height = 900; // written once, by the first target to see the resize
  assert.equal(sizeChanged(sizes, scene), true);
  assert.equal(sizeChanged(sizes, pre), true);
  assert.equal(sizeChanged(sizes, pre), false);
});

// Catches: tracking width only, so a height-only resize (rotating a phone, a docked devtools) is missed.
test('a height-only change re-allocates too', () => {
  const t = { image: { width: 800, height: 600 } };
  const sizes = new WeakMap();
  sizeChanged(sizes, t);
  t.image.height = 900;
  assert.equal(sizeChanged(sizes, t), true);
});
