import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLUID, G, criticalWavelength, criticalField, magnetAxialField, dipoleProfile, magnetFieldAt, SurfaceModel,
} from './physics.js';

test('critical wavelength matches the capillary length formula (about 9 mm)', () => {
  const lambda = criticalWavelength();
  const capillary = Math.sqrt(FLUID.surfaceTension / (FLUID.density * G));
  assert.ok(Math.abs(lambda - 2 * Math.PI * capillary) < 1e-12);
  assert.ok(lambda > 0.008 && lambda < 0.010);
});

test('critical field is in the 10-20 mT range reported for light ferrofluids', () => {
  const bc = criticalField();
  assert.ok(bc > 0.010 && bc < 0.020, `B_c = ${bc}`);
});

test('a denser fluid needs a stronger field', () => {
  const heavy = { ...FLUID, density: FLUID.density * 2 };
  assert.ok(criticalField(heavy) > criticalField());
});

test('magnet field decays with distance and matches Br/2 at the face of a long magnet', () => {
  assert.ok(magnetAxialField(0.01, 0.01, 0.015, 1.3) > magnetAxialField(0.03, 0.01, 0.015, 1.3));
  assert.ok(Math.abs(magnetAxialField(0, 0.01, 10, 1.3) - 0.65) < 1e-3);
  assert.equal(dipoleProfile(0, 0.03), 1);
});

test('off-axis field peaks below the magnet and is symmetric across its axis', () => {
  const field = (x, z) => magnetFieldAt(x, z, 0.012, -0.006, 0.03, 0.01, 0.015, 1.3);
  assert.ok(field(0.012, -0.006) > field(0, 0));
  assert.ok(Math.abs(field(0.002, -0.006) - field(0.022, -0.006)) < 1e-12);
  assert.ok(field(0.022, -0.006) > field(0.032, -0.006));
});

test('moving the field moves the mound after a viscous lag', () => {
  const model = new SurfaceModel({ rings: 32 });
  const left = (x, z) => 0.04 * Math.max(0, 1 - Math.hypot(x + 0.012, z) / 0.02);
  const right = (x, z) => 0.04 * Math.max(0, 1 - Math.hypot(x - 0.012, z) / 0.02);
  for (let i = 0; i < 90; i++) model.step(1 / 60, left);
  const oldPeak = model.sample(-0.012, 0).mound;
  model.step(1 / 60, right);
  assert.ok(model.sample(-0.012, 0).mound > model.sample(0.012, 0).mound);
  for (let i = 0; i < 120; i++) model.step(1 / 60, right);
  assert.ok(model.sample(0.012, 0).mound > model.sample(-0.012, 0).mound);
  assert.ok(model.sample(-0.012, 0).mound < oldPeak);
});

test('a dish knock disturbs the lattice locally and then decays', () => {
  const model = new SurfaceModel({ rings: 48 });
  model.knock(0, 0);
  for (let i = 0; i < 10; i++) model.step(1 / 60, () => 0.02);
  const peak = Math.max(...model.disturbance.map(Math.abs));
  assert.ok(peak > 0.05);
  for (let i = 0; i < 150; i++) model.step(1 / 60, () => 0.02);
  assert.equal(model.knocks.length, 0);
  assert.ok(Math.max(...model.disturbance.map(Math.abs)) < peak * 0.01);
});

function settle(model, b, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) model.step(1 / 60, () => b);
  return model.maxAmplitude();
}

test('surface stays flat below the critical field and grows spikes above it', () => {
  const bc = criticalField();
  assert.ok(settle(new SurfaceModel(), 0.9 * bc, 5) < 0.02);
  assert.ok(settle(new SurfaceModel(), 1.2 * bc, 5) > 0.5);
});

test('spikes persist slightly below the threshold (hysteresis) and vanish further down', () => {
  const bc = criticalField();
  const model = new SurfaceModel();
  settle(model, 1.2 * bc, 5);
  assert.ok(settle(model, 0.99 * bc, 5) > 0.3);
  assert.ok(settle(model, 0.9 * bc, 5) < 0.02);
});

test('a uniform field produces no mound; a central field lifts the centre', () => {
  const uniform = new SurfaceModel();
  uniform.step(1 / 60, () => 0.02);
  assert.ok(Math.max(...uniform.mound.map(Math.abs)) < 1e-12);
  const peaked = new SurfaceModel();
  for (let i = 0; i < 120; i++) peaked.step(1 / 60, (x, z) => 0.02 * dipoleProfile(Math.hypot(x, z), 0.03));
  assert.ok(peaked.sample(0, 0).mound > 0.001 && peaked.sample(0.04, 0).mound < 0);
});
