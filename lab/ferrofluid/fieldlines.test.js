import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ellipticKE, loopField, windingLoops, coilField, traceLine } from './fieldlines.js';

const close = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test('elliptic integrals match tabulated values (catches: wrong AGM update for E)', () => {
  // K(0) = E(0) = pi/2; K(0.5) = 1.8540746773, E(0.5) = 1.3506438810 (Abramowitz & Stegun, table 17.1).
  assert.ok(close(ellipticKE(0).K, Math.PI / 2, 1e-12) && close(ellipticKE(0).E, Math.PI / 2, 1e-12));
  assert.ok(close(ellipticKE(0.5).K, 1.8540746773, 1e-9));
  assert.ok(close(ellipticKE(0.5).E, 1.3506438810, 1e-9));
});

test('the loop field on the axis equals a^2 / (2 (a^2 + z^2)^1.5) (catches: wrong elliptic combination in Bz)', () => {
  for (const z of [0, 0.7, 2, -3]) {
    const { br, bz } = loopField(2, 0, z);
    assert.ok(close(bz, 4 / (2 * Math.pow(4 + z * z, 1.5)), 1e-9), `z = ${z}`);
    assert.ok(Math.abs(br) < 1e-12);
  }
});

test('the radial field is continuous off the axis (catches: 0/0 at r = 0 or a wrong near-axis expansion)', () => {
  const tiny = loopField(2, 1e-7, 0.8).br;
  const small = loopField(2, 1e-3, 0.8).br;
  assert.ok(Number.isFinite(tiny) && Number.isFinite(small));
  assert.ok(close(tiny / 1e-7, small / 1e-3, 1e-3));
});

test('the loop field has the mirror symmetry of a loop (catches: sign error in Br)', () => {
  const up = loopField(2, 1.3, 0.9);
  const down = loopField(2, 1.3, -0.9);
  assert.ok(up.br > 0, 'field lines spread outwards above the loop');
  assert.ok(close(down.br, -up.br, 1e-12) && close(down.bz, up.bz, 1e-12));
});

test('the field far from the loop falls like a dipole (catches: missing 1/pi or 1/2 factor)', () => {
  // Dipole on the axis: m = pi a^2 (mu0 I = 1), Bz = 2m / (4 pi z^3) = a^2 / (2 z^3).
  const z = 200;
  assert.ok(close(loopField(1, 0, z).bz, 1 / (2 * z ** 3), 1e-4));
  // In the equatorial plane: Bz = -m / (4 pi r^3) = -a^2 / (4 r^3).
  assert.ok(close(loopField(1, 200, 0).bz, -1 / (4 * 200 ** 3), 1e-3));
});

test('a line from inside the core leaves the top and closes around the outside of the winding (catches: lines that spiral or never close)', () => {
  const loops = windingLoops({ rIn: 2.9, rOut: 5.6, y0: 0.65, y1: 6.75 });
  const mid = 3.7;
  const line = traceLine(loops, [1.2, mid]);
  const first = line[0];
  const last = line[line.length - 1];
  assert.ok(Math.max(...line.map((p) => p[1])) > 7.4, 'rises above the coil');
  assert.ok(Math.min(...line.map((p) => p[1])) < 0, 'passes below the coil');
  assert.ok(first[0] > 6 && last[0] > 6, 'both ends are outside the winding');
  assert.ok(Math.abs(first[0] - last[0]) < 0.3, `closes on itself: ${first[0]} vs ${last[0]}`);
  // Inside the core the field points up.
  assert.ok(coilField(loops, 0.5, mid).bz > 0);
});
