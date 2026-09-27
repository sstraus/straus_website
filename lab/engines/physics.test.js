// Run with: node --test lab/engines/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE, MOTOR, TAU, pistonTravel, pistonHeight, cylinderPhase, strokeOf, firingCylinder,
  valveLift, VALVE_TIMING, camLift, lobeAngle, cylinderPressure, gasTemperature, burnGlow,
  ottoEfficiency, engineTorque, engineEfficiency, motorTorque, motorEfficiency, motorHeat, shaftPower, wasteHeat,
  toothCurrent, fieldLead, movingPartCount, MOVING_PARTS,
} from './physics.js';

const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b} (±${tolerance})`);
const deg = (d) => (d * Math.PI) / 180;
const sweep = (from, to, step, fn) => { for (let x = from; x <= to + 1e-9; x += step) fn(x); };

// ---------- slider-crank ----------

test('piston reaches both dead centres and keeps its stroke (catches a wrong crank radius or rod formula)', () => {
  near(pistonTravel(0), 0);
  near(pistonTravel(Math.PI), 1);
  near(pistonTravel(TAU), 0);
  const r = ENGINE.stroke / 2;
  near(pistonHeight(0) - pistonHeight(Math.PI), ENGINE.stroke, 1e-12);
  near(pistonHeight(0), r + ENGINE.rod, 1e-12);
});

test('the piston is past half stroke before 90° of crank (catches a pure cosine that ignores the rod)', () => {
  // A finite rod pulls the piston down faster in the top half of the stroke.
  assert.ok(pistonTravel(Math.PI / 2) > 0.5);
  near(pistonTravel(Math.PI / 2), pistonTravel(3 * Math.PI / 2), 1e-12);
});

test('displacement is the 2.0 litre of the modelled engine (catches a radius used as a diameter)', () => {
  const litres = ENGINE.cylinders * Math.PI / 4 * ENGINE.bore ** 2 * ENGINE.stroke * 1000;
  assert.ok(litres > 1.95 && litres < 2.05, `${litres} L`);
});

// ---------- firing order and valve timing ----------

test('cylinders fire in the order 1-3-4-2, one every half turn (catches the pairs 1-3 and 2-4 moving together)', () => {
  const order = [];
  let last = null;
  sweep(0, 2 * TAU - deg(1), deg(1), (crank) => {
    const c = firingCylinder(crank + deg(0.5));
    if (c !== last) { order.push(c); last = c; }
  });
  assert.deepEqual(order.slice(0, 4), [1, 3, 4, 2]);
  for (let c = 1; c <= 4; c++) near(cylinderPhase(c, crankAtFiring(c)), TAU, 1e-9);
});

function crankAtFiring(c) {
  return [0, 3, 1, 2][c - 1] * Math.PI; // 1 at 0°, 3 at 180°, 4 at 360°, 2 at 540°
}

test('pistons 1 and 4 move together, opposite to 2 and 3 (catches a crank with the wrong throws)', () => {
  sweep(0, TAU, deg(7), (crank) => {
    const h = (c) => pistonHeight(cylinderPhase(c, crank));
    near(h(1), h(4), 1e-12);
    near(h(2), h(3), 1e-12);
    near(h(1) + h(2), pistonHeight(0) + pistonHeight(Math.PI), 0.015); // opposite, apart from the rod term
  });
});

test('a four-stroke cycle takes two crank turns (catches a cycle that repeats every turn)', () => {
  assert.equal(strokeOf(deg(90)), 'intake');
  assert.equal(strokeOf(deg(270)), 'compression');
  assert.equal(strokeOf(deg(450)), 'power');
  assert.equal(strokeOf(deg(630)), 'exhaust');
  assert.equal(strokeOf(deg(90 + 720)), 'intake');
});

test('valves are shut through compression and power (catches a valve that opens against the flame)', () => {
  sweep(VALVE_TIMING.intake.close + 1, VALVE_TIMING.exhaust.open - 1, 1, (d) => {
    near(valveLift(deg(d), 'intake'), 0);
    near(valveLift(deg(d), 'exhaust'), 0);
  });
});

test('intake and exhaust overlap at the top of the exhaust stroke only (catches a missing or misplaced overlap)', () => {
  assert.ok(valveLift(0, 'intake') > 0 && valveLift(0, 'exhaust') > 0);
  assert.ok(valveLift(deg(110), 'intake') > 0.99);
  near(valveLift(deg(110), 'exhaust'), 0);
  assert.ok(valveLift(deg(610), 'exhaust') > 0.99);
  near(valveLift(deg(610), 'intake'), 0);
});

test('each cam lobe lifts its valve exactly when the cycle asks for it (catches a cam that turns at crank speed)', () => {
  for (let c = 1; c <= 4; c++) {
    for (const valve of ['intake', 'exhaust']) {
      sweep(0, 2 * TAU, deg(3), (crank) => {
        near(camLift(lobeAngle(c, valve), crank), valveLift(cylinderPhase(c, crank), valve), 1e-9);
      });
    }
  }
});

// ---------- pressure, temperature, flame ----------

function peak(fn, from, to) {
  let best = { at: from, value: -Infinity };
  sweep(from, to, 0.25, (d) => { const v = fn(deg(d)); if (v > best.value) best = { at: d, value: v }; });
  return best;
}

test('pressure peaks 10–25° after the top at 45–75 bar (catches a spark after the top or a burn with no heat)', () => {
  const p = peak(cylinderPressure, 300, 480);
  assert.ok(p.at > 370 && p.at < 385, `peak at ${p.at}°`);
  assert.ok(p.value > 45 && p.value < 75, `${p.value} bar`);
});

test('pressure has no jump where the valves close and open (catches the wrong branch at IVC or EVO)', () => {
  for (const d of [VALVE_TIMING.intake.close, VALVE_TIMING.exhaust.open]) {
    near(cylinderPressure(deg(d - 1e-4)), cylinderPressure(deg(d + 1e-4)), 1e-2);
  }
});

test('the charge is near manifold pressure during intake and near 1 bar at the end of exhaust (catches a pressure that never vents)', () => {
  const intake = cylinderPressure(deg(120));
  assert.ok(intake > 0.85 && intake < 1.0, `${intake}`);
  const exhaust = cylinderPressure(deg(700));
  assert.ok(exhaust > 1.0 && exhaust < 1.3, `${exhaust}`);
});

test('the gas is hottest after the spark and is 1300–1800 K when the exhaust opens (catches a temperature from pressure alone)', () => {
  const t = peak(gasTemperature, 300, 480);
  assert.ok(t.value > 2200 && t.value < 3000, `${t.value} K`);
  const evo = gasTemperature(deg(VALVE_TIMING.exhaust.open - 1));
  assert.ok(evo > 1300 && evo < 1800, `${evo} K`);
  assert.ok(gasTemperature(deg(90)) < 400);
});

test('the flame glows only after the spark and dies before the exhaust opens (catches a flame in the wrong stroke)', () => {
  near(burnGlow(deg(300)), 0);
  near(burnGlow(deg(600)), 0);
  const p = peak(burnGlow, 330, 480);
  near(p.value, 1, 1e-2);
  assert.ok(p.at > 360 && p.at < 385, `${p.at}°`);
  assert.ok(burnGlow(deg(VALVE_TIMING.exhaust.open - 5)) < 0.01);
});

test('the ideal Otto limit uses the exponent 1 − γ (catches an efficiency above 1 or a swapped exponent)', () => {
  near(ottoEfficiency(10.5, 1.4), 1 - 10.5 ** -0.4);
  assert.ok(ottoEfficiency(ENGINE.compressionRatio) > 0.55 && ottoEfficiency(ENGINE.compressionRatio) < 0.65);
});

// ---------- torque, efficiency, heat ----------

test('the motor has its full torque at standstill; the engine has none below idle (catches an engine that pulls from zero)', () => {
  near(motorTorque(0), MOTOR.peakTorque);
  near(engineTorque(0), 0);
  near(engineTorque(ENGINE.idleRpm - 1), 0);
  assert.ok(engineTorque(ENGINE.idleRpm) > 100);
});

test('the engine needs revs: its torque peaks in the middle of the range (catches a flat or falling curve)', () => {
  let best = { rpm: 0, torque: 0 };
  sweep(ENGINE.idleRpm, ENGINE.redlineRpm, 10, (rpm) => {
    if (engineTorque(rpm) > best.torque) best = { rpm, torque: engineTorque(rpm) };
  });
  assert.ok(best.rpm > 3500 && best.rpm < 4500, `${best.rpm} rpm`);
  assert.ok(engineTorque(1000) < 0.8 * best.torque);
});

test('the motor keeps full torque to base speed, then constant power (catches power that keeps rising)', () => {
  near(motorTorque(MOTOR.baseRpm / 2), MOTOR.peakTorque);
  near(shaftPower(MOTOR.baseRpm, motorTorque(MOTOR.baseRpm)), shaftPower(6000, motorTorque(6000)), 1e-9);
  const kw = shaftPower(MOTOR.baseRpm, MOTOR.peakTorque);
  assert.ok(kw > 95 && kw < 105, `${kw} kW`);
});

test('engine power stays in the class of a 2.0 litre petrol (catches kW and W mixed up)', () => {
  let max = 0;
  sweep(ENGINE.idleRpm, ENGINE.redlineRpm, 50, (rpm) => { max = Math.max(max, shaftPower(rpm, engineTorque(rpm))); });
  assert.ok(max > 95 && max < 125, `${max} kW`);
});

test('engine efficiency is 25–35 % when running and zero when stalled (catches a textbook 60 % shown as real)', () => {
  near(engineEfficiency(0), 0);
  sweep(ENGINE.idleRpm, ENGINE.redlineRpm, 100, (rpm) => {
    const e = engineEfficiency(rpm);
    assert.ok(e >= 0.25 && e <= 0.35, `${rpm} rpm: ${e}`);
  });
});

test('motor efficiency is 90–97 % over the working range and zero at standstill (catches losses that ignore current or speed)', () => {
  near(motorEfficiency(0), 0);
  sweep(1500, 6500, 100, (rpm) => {
    const e = motorEfficiency(rpm);
    assert.ok(e >= 0.9 && e <= 0.97, `${rpm} rpm: ${e}`);
  });
  assert.ok(motorEfficiency(200) < motorEfficiency(2000)); // full current, little power: copper heat dominates
});

test('waste heat closes the energy balance (catches heat that is not input minus output)', () => {
  const out = 80;
  near(wasteHeat(out, 0.32) + out, out / 0.32, 1e-9);
  near(wasteHeat(0, 0), 0);
  assert.ok(wasteHeat(out, 0.32) > 10 * wasteHeat(out, 0.95));
});

test('a stalled motor at full current turns all its input into heat (catches heat taken from an efficiency that is zero)', () => {
  assert.ok(motorHeat(0) > 3 && motorHeat(0) < 4.5, `${motorHeat(0)} kW`);
  sweep(500, 6500, 500, (rpm) => {
    const out = shaftPower(rpm, motorTorque(rpm));
    near(motorHeat(rpm), wasteHeat(out, motorEfficiency(rpm)), 1e-9);
  });
});

// ---------- the rotating field ----------

test('the three phase currents always add up to zero (catches phases 90° apart instead of 120°)', () => {
  sweep(0, TAU, 0.05, (rotor) => {
    near(toothCurrent(0, rotor) + toothCurrent(1, rotor) + toothCurrent(2, rotor), 0, 1e-12);
  });
});

test('the field turns with the rotor and leads its north pole by a quarter pole pitch (catches a field at electrical speed)', () => {
  const pitch = TAU / MOTOR.poles;
  near(fieldLead(), pitch / 2);
  for (const rotor of [0, 0.4, 1.3, 2.9]) {
    // The most energised tooth is the one nearest to the field axis, which sits fieldLead() ahead of the rotor.
    let best = { k: 0, i: -Infinity };
    for (let k = 0; k < MOTOR.slots; k++) {
      const i = toothCurrent(k, rotor);
      if (i > best.i) best = { k, i };
    }
    const toothAngle = (best.k * TAU) / MOTOR.slots;
    const axis = rotor + fieldLead();
    const gap = Math.abs(Math.atan2(Math.sin(MOTOR.poles / 2 * (toothAngle - axis)), Math.cos(MOTOR.poles / 2 * (toothAngle - axis))));
    assert.ok(gap <= Math.PI / 3 + 1e-9, `rotor ${rotor}: tooth ${best.k} is ${gap} rad electrical off the field axis`);
  }
});

// ---------- moving parts ----------

test('the motor has one moving part and the engine dozens (catches a count that includes fixed parts)', () => {
  assert.equal(movingPartCount('motor'), 1);
  const engine = movingPartCount('engine');
  assert.equal(engine, MOVING_PARTS.engine.reduce((s, p) => s + p.count, 0));
  assert.ok(engine > 60 && engine < 120, `${engine}`);
  assert.ok(MOVING_PARTS.engine.every((p) => p.count > 0 && p.name));
});
