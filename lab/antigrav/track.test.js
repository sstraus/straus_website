import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, frameAt, toWorld, gapS, inZone, HALF_WIDTH } from './track.js';

const track = buildTrack();
const vec = (arr, i) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const zonesOf = (tag) => track.zones.filter((z) => z.tag === tag);
const samplesIn = (z) => { const out = []; for (let i = Math.ceil(z.s0 / track.step); i * track.step <= z.s1; i++) out.push(i); return out; };

test('the circuit closes with even spacing and no kink (catches: a Hermite join that misses the start or folds back)', () => {
  for (let i = 0; i < track.count; i++) {
    const g = dist(vec(track.pos, i), vec(track.pos, (i + 1) % track.count));
    assert.ok(Math.abs(g - track.step) < 0.1 * track.step, `spacing ${g} at ${i}`);
    const turn = Math.acos(Math.min(1, dot(vec(track.T, i), vec(track.T, (i + 1) % track.count))));
    assert.ok(turn < 3 * Math.PI / 180, `kink of ${turn} rad at ${i}`);
  }
  assert.ok(track.joinGap < 400, `join of ${track.joinGap} m is a long uncontrolled piece`);
});

test('every frame is right-handed and orthonormal (catches: N = U x T, which mirrors d and flips steering)', () => {
  for (let i = 0; i < track.count; i++) {
    const T = vec(track.T, i), N = vec(track.N, i), U = vec(track.U, i);
    for (const v of [T, N, U]) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9);
    assert.ok(Math.abs(dot(T, N)) < 1e-9 && Math.abs(dot(T, U)) < 1e-9 && Math.abs(dot(N, U)) < 1e-9);
    const c = cross(T, U);
    assert.ok(dist(c, N) < 1e-9, `N is not T x U at ${i}`);
  }
  // On the start straight the deck faces world up and N points to the right of +X, i.e. +Z.
  const f = frameAt(track, track.startS);
  assert.ok(f.U[1] > 0.999 && f.N[2] > 0.999);
});

test('no part of the track passes through another (catches: a loop without its sideways shift)', () => {
  const stride = 2; // every 4 m
  const minArc = 120, clearance = 26;
  for (let i = 0; i < track.count; i += stride) {
    for (let j = i + stride; j < track.count; j += stride) {
      const arc = Math.min(j - i, track.count - (j - i)) * track.step;
      if (arc < minArc) continue;
      const d = dist(vec(track.pos, i), vec(track.pos, j));
      assert.ok(d > clearance, `samples ${i} and ${j} are ${d.toFixed(1)} m apart`);
    }
  }
});

test('banked turns press the ship onto the deck, never off it (catches: a bank sign that leans out of the turn)', () => {
  for (const tag of ['sweeper', 'hairpin', 'esses']) {
    for (const z of zonesOf(tag)) {
      let sawTurn = false;
      for (const i of samplesIn(z)) {
        if (Math.abs(track.kn[i]) > 1e-3) sawTurn = true;
        if (Math.abs(track.bank[i]) > 0.05) assert.ok(track.ku[i] > 0, `${tag} at ${i}: ku ${track.ku[i]}`);
      }
      assert.ok(sawTurn, `${tag} has no curvature`);
    }
  }
});

test('both loops turn a full circle up and over (catches: pitch applied about the wrong axis)', () => {
  assert.equal(zonesOf('loop').length, 2);
  for (const z of zonesOf('loop')) {
    let maxY = -Infinity, minUp = Infinity;
    for (const i of samplesIn(z)) {
      maxY = Math.max(maxY, track.pos[i * 3 + 1]);
      minUp = Math.min(minUp, track.U[i * 3 + 1]);
    }
    const base = track.pos[Math.ceil(z.s0 / track.step) * 3 + 1];
    assert.ok(maxY - base > 80, `loop is only ${maxY - base} m tall`);
    assert.ok(minUp < -0.99, 'the deck never faces down at the top of the loop');
  }
});

test('each corkscrew rolls the deck a full turn and leaves it upright (catches: a roll that stops short or never inverts)', () => {
  const twists = zonesOf('twist');
  assert.equal(twists.length, 2);
  for (const z of twists) {
    const ids = samplesIn(z);
    // Measured against the deck at the entry: the climb's corkscrew runs on a slope.
    const entry = vec(track.U, ids[0] - 5), exit = vec(track.U, ids[ids.length - 1] + 5);
    const minUp = Math.min(...ids.map((i) => dot(vec(track.U, i), entry)));
    assert.ok(minUp < -0.99, `the deck never turns over in the corkscrew at ${z.s0}`);
    assert.ok(dot(exit, entry) > 0.99, `the deck leaves the corkscrew at ${z.s0} rolled`);
    // A roll on a straight bends nothing: no push into or off the deck.
    for (const i of ids) assert.ok(Math.abs(track.ku[i]) < 1e-3, `ku ${track.ku[i]} at ${i}`);
  }
});

test('the deck frame never jumps between samples (catches: a bank that unwinds 360 degrees in one step after a corkscrew)', () => {
  for (let i = 0; i < track.count; i++) {
    const j = (i + 1) % track.count;
    const twist = Math.acos(Math.min(1, dot(vec(track.U, i), vec(track.U, j))));
    assert.ok(twist < 6 * Math.PI / 180, `deck twists ${(twist * 180 / Math.PI).toFixed(1)} deg at ${i}`);
  }
});

test('the crest throws a fast ship and a slow one stays down (catches: a crest too gentle to jump)', () => {
  // The hover can pull at most about 187 m/s^2 (see physics.js); a jump needs |ku| v^2 above that.
  let minKu = 0;
  for (const z of zonesOf('crest')) for (const i of samplesIn(z)) minKu = Math.min(minKu, track.ku[i]);
  const launch = Math.sqrt(187 / -minKu);
  assert.ok(launch > 90 && launch < 135, `crest launches at ${launch.toFixed(0)} m/s`);
});

test('pads sit fully on the deck (catches: a pad placed past the wall or past the end of the lap)', () => {
  assert.ok(track.pads.some((p) => p.kind === 'speed') && track.pads.some((p) => p.kind === 'item'));
  for (const p of track.pads) {
    assert.ok(p.s >= 0 && p.s < track.length);
    assert.ok(Math.abs(p.d) + p.w <= HALF_WIDTH, `pad at d=${p.d}`);
  }
});

test('the lap is a long orbital circuit with the start on a straight (catches: a grid placed in a bend)', () => {
  assert.ok(track.length > 5000 && track.length < 8000, `length ${track.length}`);
  for (let s = track.startS - 80; s <= track.startS + 20; s += 2) assert.ok(Math.abs(frameAt(track, s).kn) < 1e-4);
  assert.ok(inZone(track, track.startS, 'start'));
});

test('toWorld and gapS agree with the frames (catches: wrap-around errors at the end of the lap)', () => {
  const p = toWorld(track, track.length - 1, 3, 1.2);
  const f = frameAt(track, track.length - 1);
  assert.ok(Math.abs(dot([p[0] - f.p[0], p[1] - f.p[1], p[2] - f.p[2]], f.N) - 3) < 1e-3); // interpolated frames are unit to about 1e-5
  assert.equal(gapS(track, track.length - 10, 10), 20);
  assert.equal(gapS(track, 10, track.length - 10), -20);
  const a = frameAt(track, -5), b = frameAt(track, track.length - 5);
  assert.ok(dist(a.p, b.p) < 1e-9);
});
