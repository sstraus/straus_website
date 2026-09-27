import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heatPump } from '../../lab/heat-pump/physics.js';

// Catches: temperatures used in °C instead of kelvin (COP would explode near 0 °C or turn negative).
test('COP stays below the Carnot limit and in the range real units reach', () => {
  for (const outside of [-20, -7, 2, 7, 15]) {
    const p = heatPump({ outside, flow: 35 });
    const carnot = (35 + 273.15) / (35 - outside);
    assert.ok(p.cop > 1, `COP ${p.cop} at ${outside} °C must exceed 1`);
    assert.ok(p.cop < carnot, `COP ${p.cop} at ${outside} °C must stay below the ideal ${carnot}`);
  }
  // EN 14511 ratings of good air-to-water units: about 4-5 at A7/W35, about 2.5-3.2 at A-7/W35.
  assert.ok(heatPump({ outside: 7, flow: 35 }).cop > 3.5 && heatPump({ outside: 7, flow: 35 }).cop < 5.5);
  assert.ok(heatPump({ outside: -7, flow: 35 }).cop > 2.3 && heatPump({ outside: -7, flow: 35 }).cop < 3.4);
});

// Catches: a lift computed with the wrong sign (colder air or hotter radiators would raise the COP).
test('colder air and hotter radiators both cost efficiency', () => {
  assert.ok(heatPump({ outside: -20, flow: 35 }).cop < heatPump({ outside: 7, flow: 35 }).cop);
  assert.ok(heatPump({ outside: -7, flow: 55 }).cop < heatPump({ outside: -7, flow: 35 }).cop);
});

// Catches: an energy balance that creates or loses heat (heat out must equal electricity + heat from the air).
test('energy balance: heat delivered = electricity + heat taken from the air', () => {
  for (const outside of [-20, -7, 7]) {
    const p = heatPump({ outside, flow: 45 });
    assert.ok(Math.abs(p.heat - (p.electricity + p.fromAir)) < 1e-9);
    assert.ok(Math.abs(p.heat / p.electricity - p.cop) < 1e-9);
    assert.ok(p.fromAir > 0, 'heat must still come out of the outside air');
  }
});

// Catches: an evaporator that is not colder than the air (then heat could not flow into the refrigerant).
test('the refrigerant evaporates colder than the outside air and condenses hotter than the flow', () => {
  for (const outside of [-20, 0, 15]) {
    const p = heatPump({ outside, flow: 35 });
    assert.ok(p.evaporating < outside);
    assert.ok(p.condensing > 35);
  }
});

// Catches: a house demand that does not grow as it gets colder outside.
test('the house needs more heat when it is colder outside', () => {
  assert.ok(heatPump({ outside: -20, flow: 35 }).heat > heatPump({ outside: 7, flow: 35 }).heat);
});

// Catches: a pressure law in the wrong units or with a wrong constant (the valve and compressor cards would lie).
test('R290 saturation pressure matches the propane tables within 5 %', async () => {
  const { saturationPressure } = await import('../../lab/heat-pump/physics.js');
  // bar absolute, from NIST REFPROP propane tables.
  const table = [[-20, 2.45], [-10, 3.45], [0, 4.74], [10, 6.36], [20, 8.36], [30, 10.8], [40, 13.7], [50, 17.1], [60, 21.2]];
  for (const [t, p] of table) {
    const got = saturationPressure(t);
    assert.ok(Math.abs(got - p) / p < 0.05, `${t} °C: ${got.toFixed(2)} bar, table ${p}`);
  }
});

// Catches: pressures that do not follow the cycle (the compressor must raise, the valve must drop).
test('the compressor raises the pressure and the valve drops it back', () => {
  const p = heatPump({ outside: -7, flow: 35 });
  assert.ok(p.highPressure > p.lowPressure * 2);
  assert.ok(p.returnWater < 35);
});

// ---------------------------------------------------------------- layout

const layout = await import('../../lab/heat-pump/layout.js');
const { SOLIDS, ROUTES, REFRIGERANT, EQUIPMENT, UNIT, MANIFOLD, RADIATOR, PIPE_DEPTH, sampleRoute, routeSegments } = layout;

const boxDistance = (p, { min, max }) => Math.hypot(...p.map((n, i) => Math.max(min[i] - n, 0, n - max[i])));
const inside = (p, box, pad = 1e-9) => p.every((n, i) => n >= box.min[i] - pad && n <= box.max[i] + pad);
const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
const allRuns = () => [
  ...Object.entries(ROUTES).map(([name, route]) => ({ name, ...route })),
  ...REFRIGERANT.map((run) => ({ ...run, name: `R290 ${run.name}`, refrigerant: true })),
];

// Catches: overlapping boxes that share coplanar faces and flicker (the z-fighting at the bottom of the screen).
test('no two solids of the diorama overlap', () => {
  for (let i = 0; i < SOLIDS.length; i++) {
    for (let j = i + 1; j < SOLIDS.length; j++) {
      const a = SOLIDS[i], b = SOLIDS[j];
      const overlap = [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
      assert.ok(overlap.some((o) => o <= 1e-9), `${a.name} overlaps ${b.name} by ${overlap.map((o) => o.toFixed(3))}`);
    }
  }
});

// Catches: a solid with its corners swapped, which the renderer would build inside out.
test('every solid has a positive size', () => {
  for (const { name, min, max } of SOLIDS) assert.ok(min.every((n, i) => max[i] - n > 0.001), name);
});

// Catches: diagonal legs (the old CatmullRom tubes) and bend radii that do not line up with the corners.
test('every pipe and duct runs in straight legs along one axis', () => {
  for (const run of allRuns()) {
    assert.equal(run.bends.length, run.points.length - 2, `${run.name}: one bend radius per corner`);
    for (let i = 1; i < run.points.length; i++) {
      const moved = [0, 1, 2].filter((k) => Math.abs(run.points[i][k] - run.points[i - 1][k]) > 1e-9);
      assert.equal(moved.length, 1, `${run.name} leg ${i} is diagonal`);
    }
  }
});

// Catches: a bend that cuts across the corner or leaves a gap, so the tube would show a kink or a break.
test('routes are continuous from the first point to the last', () => {
  for (const run of allRuns()) {
    const segments = routeSegments(run);
    assert.deepEqual(segments[0].a, run.points[0], run.name);
    assert.deepEqual(segments.at(-1).b, run.points.at(-1), run.name);
    for (let i = 1; i < segments.length; i++) assert.ok(distance(segments[i - 1].b, segments[i].a) < 1e-9, `${run.name} gap at ${i}`);
  }
});

// Catches: a pipe or cable that hangs in the air: every point must lie on or in a solid or an equipment casing,
// and a free span (a riser between the floor and the cabinet, a carrier between the trench and the unit) stays short.
test('nothing floats: pipes and cables are carried, buried or held by equipment', () => {
  const holders = [...SOLIDS, ...Object.values(EQUIPMENT)];
  for (const run of allRuns()) {
    const reach = run.radius + 0.02;
    let free = 0;
    let longest = 0;
    const points = sampleRoute(run, 0.01);
    for (let i = 0; i < points.length; i++) {
      const held = holders.some((box) => boxDistance(points[i], box) <= reach);
      free = held ? 0 : free + (i ? distance(points[i], points[i - 1]) : 0);
      longest = Math.max(longest, free);
    }
    assert.ok(longest <= 0.45, `${run.name} spans ${longest.toFixed(2)} m with no support`);
  }
});

// Catches: the test above passing because it accepts everything (a holder list that covers the whole scene).
test('the float check fails for a pipe hung in mid-air', () => {
  const holders = [...SOLIDS, ...Object.values(EQUIPMENT)];
  const hung = { points: [[1.0, 1.5, -1.5], [1.0, 1.5, -2.5]], bends: [], radius: 0.016 };
  const floating = sampleRoute(hung).filter((p) => !holders.some((box) => boxDistance(p, box) <= 0.036));
  assert.ok(floating.length > 0);
});

// Catches: buried services drawn behind the soil, where the section cut cannot show them.
test('buried services lie on the section plane', () => {
  for (const name of ['jacket', 'flow', 'return', 'power']) {
    for (const [x, y, z] of sampleRoute(ROUTES[name])) {
      if (y < -0.2) assert.ok(Math.abs(z) < 1e-9, `${name} at ${[x, y, z]} is behind the cut`);
    }
  }
});

// Catches: water pipes laid above the frost line, which would freeze at design temperature.
test('the twin pipe lies below the frost depth of a −25 °C cold spell', async () => {
  const { frostDepth, groundTemperature } = await import('../../lab/heat-pump/thermal.js');
  assert.ok(PIPE_DEPTH - ROUTES.jacket.radius > frostDepth(-25));
  assert.ok(groundTemperature(PIPE_DEPTH, -25) > 0);
  assert.ok(frostDepth(5) === 0);
});

// Catches: two pipes drawn through each other (flow through return, power through water).
test('pipes do not pass through each other', () => {
  const runs = allRuns();
  const nested = new Set(['jacket']); // the twin pipe carries flow and return inside it
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i], b = runs[j];
      if (nested.has(a.name) && !b.refrigerant && b.name !== 'power') continue;
      if (a.mode && b.mode && a.mode !== b.mode) continue; // floor and radiator mode never show together
      if (a.joins === b.name || b.joins === a.name) continue;
      if (a.refrigerant && b.refrigerant && (a.to === b.from || b.to === a.from)) continue;
      const gap = a.radius + b.radius;
      const pb = sampleRoute(b, 0.01);
      for (const p of sampleRoute(a, 0.01)) {
        const near = pb.find((q) => distance(p, q) < gap - 0.002);
        assert.ok(!near, `${a.name} passes through ${b.name} at ${p.map((n) => n.toFixed(3))}`);
      }
    }
  }
});

// Catches: a split-system route that sends R290 into the house, or a missing internal component.
test('the R290 circuit stays inside the monoblock casing in process order', () => {
  assert.deepEqual(REFRIGERANT.map((run) => run.from).concat(REFRIGERANT.at(-1).to), [
    'compressor', 'reversing', 'plate', 'eev', 'coil', 'reversing', 'accumulator', 'compressor',
  ]);
  for (let i = 1; i < REFRIGERANT.length; i++) assert.equal(REFRIGERANT[i].from, REFRIGERANT[i - 1].to);
  for (const run of REFRIGERANT) {
    for (const p of sampleRoute(run)) assert.ok(inside(p, UNIT), `${run.name} leaves the casing at ${p}`);
  }
});

// Catches: water pipes that end next to the manifold or the radiator valves instead of on them.
test('water runs start and end on their fittings', () => {
  const barEnd = (bar) => [bar.x, bar.y, bar.z1];
  assert.deepEqual(ROUTES.flow.points.at(-1), barEnd(MANIFOLD.flow));
  assert.deepEqual(ROUTES.return.points[0], barEnd(MANIFOLD.return));
  assert.ok(inside(ROUTES.flow.points[0], UNIT) && inside(ROUTES.return.points.at(-1), UNIT));
  for (const name of ['ufh', 'radiatorFlow']) assert.ok(Math.abs(ROUTES[name].points[0][0] - MANIFOLD.flow.x) < 1e-9, name);
  for (const name of ['ufh', 'radiatorReturn']) assert.ok(Math.abs(ROUTES[name].points.at(-1)[0] - MANIFOLD.return.x) < 1e-9, name);
  // The radiator valves sit just outside the panel ends, flow on one side and return on the other.
  const [fx, , fz] = ROUTES.radiatorFlow.points.at(-1);
  const [rx, , rz] = ROUTES.radiatorReturn.points[0];
  assert.ok(fx < RADIATOR.min[0] && rx > RADIATOR.max[0]);
  for (const z of [fz, rz]) assert.ok(z > RADIATOR.min[2] && z < RADIATOR.max[2]);
});

// ---------------------------------------------------------------- thermal view

const thermal = await import('../../lab/heat-pump/thermal.js');

// Catches: layer resistances summed in the wrong order, or conductivity used as resistance.
test('the wall cools steadily from inside to outside, most of it across the insulation', () => {
  const { temps, depths, U } = thermal.wallProfile(-7);
  for (let i = 1; i < temps.length; i++) assert.ok(temps[i] < temps[i - 1]);
  const drops = temps.slice(1).map((t, i) => temps[i] - t);
  assert.equal(drops.indexOf(Math.max(...drops)), thermal.WALL.findIndex((l) => l.key === 'eps'));
  assert.ok(Math.abs(depths.at(-1) - thermal.WALL.reduce((s, l) => s + l.thickness, 0)) < 1e-12);
  assert.ok(U > 0.15 && U < 0.25, `U = ${U}`); // a well insulated new wall
  assert.ok(temps[0] > 19 && temps.at(-1) > -7);
});

// Catches: floor surface computed from flow temperature or total power without the area (it would read 40 °C).
test('the underfloor surface stays within the 29 °C comfort limit of EN 1264', () => {
  for (let outside = -25; outside <= 15; outside += 5) {
    const t = thermal.floorSurface(heatPump({ outside, flow: 35 }).heat);
    assert.ok(t > 20 && t <= 29, `${outside} °C outside: floor ${t.toFixed(1)} °C`);
  }
  assert.ok(thermal.floorSurface(heatPump({ outside: -20, flow: 35 }).heat) > thermal.floorSurface(heatPump({ outside: 5, flow: 35 }).heat));
});

// Catches: a thermal view that paints the window as warm as the wall (the glass is the cold spot of the room).
test('the window is the coldest inner surface of the room', () => {
  for (const outside of [-20, -7, 7]) {
    assert.ok(thermal.windowSurface(outside) < thermal.wallProfile(outside).temps[0]);
    assert.ok(thermal.windowSurface(outside) > outside);
  }
});

// ---------------------------------------------------------------- summer, inverter, changeover

const physics = await import('../../lab/heat-pump/physics.js');
const { coolingPump, compressorFrequency, dewPoint, model } = physics;

// Catches: the heating Carnot formula reused for cooling (Tc/(Tc−Te) instead of Te/(Tc−Te) overstates the EER by 1).
test('EER stays below the Carnot cooling limit and near rated units at A35/W18', () => {
  for (const outside of [25, 30, 35]) {
    const p = coolingPump({ outside, flow: 18 });
    const te = p.evaporating + 273.15;
    const tc = p.condensing + 273.15;
    assert.ok(p.eer > 1 && p.eer < te / (tc - te), `EER ${p.eer} at ${outside} °C`);
  }
  const rated = coolingPump({ outside: 35, flow: 18 }).eer;
  assert.ok(rated > 3 && rated < 5, `EER ${rated} at A35/W18`);
  assert.ok(coolingPump({ outside: 35, flow: 18 }).eer < coolingPump({ outside: 25, flow: 18 }).eer);
});

// Catches: cooling that forgets the compressor work (the coil outside must reject cooling plus electricity).
test('energy balance in cooling: heat thrown out = heat taken from the house + electricity', () => {
  for (const outside of [25, 30, 35]) {
    const p = coolingPump({ outside, flow: 18 });
    assert.ok(Math.abs(p.rejected - (p.cooling + p.electricity)) < 1e-9);
    assert.ok(Math.abs(p.cooling / p.electricity - p.eer) < 1e-9);
    assert.equal(p.air, p.rejected);
    assert.ok(p.evaporating < 18 && p.condensing > outside, 'the plate must be colder than the water, the coil hotter than the air');
  }
});

// Catches: a frequency that ignores the load, or leaves the inverter's range at the extremes.
test('the compressor frequency rises with the load and stays within 20…90 Hz', () => {
  let last = 0;
  for (let outside = 15; outside >= -25; outside -= 5) {
    const hz = heatPump({ outside, flow: 35 }).frequency;
    assert.ok(hz >= model.minHz && hz <= model.maxHz, `${hz} Hz at ${outside} °C`);
    assert.ok(hz >= last, 'colder air must never slow the compressor');
    last = hz;
  }
  assert.ok(heatPump({ outside: -20, flow: 35 }).frequency >= 80, 'near full speed at −20 °C');
  assert.ok(heatPump({ outside: 7, flow: 35 }).frequency < 40, 'slow and quiet at a mild +7 °C');
  assert.equal(compressorFrequency(0), model.minHz);
  assert.equal(compressorFrequency(100), model.maxHz);
  for (const outside of [25, 30, 35]) {
    const hz = coolingPump({ outside, flow: 18 }).frequency;
    assert.ok(hz >= model.minHz && hz <= model.maxHz);
  }
});

// Catches: a dew point formula with the wrong constants, or a summer flow that would wet the floor.
test('summer water and floor stay above the dew point of the room air', () => {
  const dew = dewPoint(model.summerIndoor, model.summerHumidity);
  assert.ok(Math.abs(dew - 16.3) < 0.3, `dew point ${dew} at 26 °C / 55 %`); // psychrometric tables: 16.3 °C
  assert.ok(Math.abs(dewPoint(20, 50) - 9.3) < 0.3); // tables: 9.3 °C
  const flow = 18;
  assert.ok(flow > dew);
  for (const outside of [25, 30, 35]) {
    const floor = thermal.floorSurfaceCooling(coolingPump({ outside, flow }).cooling, model.summerIndoor);
    assert.ok(floor > dew && floor < model.summerIndoor, `floor ${floor} at ${outside} °C`);
  }
});

const cycle = await import('../../lab/heat-pump/cycle.js');

// Catches: a valve that sends the hot gas to the same exchanger in both seasons (summer would heat the house).
test('the four-way valve sends the hot gas to the plate in winter and to the outdoor coil in summer', () => {
  for (const [season, hot, cold] of [['winter', 'plate', 'coil'], ['summer', 'coil', 'plate']]) {
    const runs = cycle.circuit(season);
    const out = runs.find((r) => r.from === 'reversing' && r.to !== 'accumulator');
    assert.equal(out.to, hot, `${season}: hot gas goes to the ${out.to}`);
    assert.equal(out.temperature, 'discharge');
    assert.equal(cycle.roles(season).condenser, hot);
    assert.equal(cycle.roles(season).evaporator, cold);
    // Warm liquid leaves the condenser; the mist after the valve goes into the evaporator.
    assert.equal(runs.find((r) => r.from === hot).phase, 'liquid');
    assert.equal(runs.find((r) => r.from === 'eev').to, cold);
    assert.equal(runs.find((r) => r.from === 'eev').phase, 'mix');
  }
});

// Catches: a reversal that also flips the compressor's own pipes (a compressor cannot run backwards).
test('only the four runs between the valve and the exchangers reverse, and each loop closes', () => {
  const winter = cycle.circuit('winter');
  const summer = cycle.circuit('summer');
  for (const runs of [winter, summer]) {
    assert.equal(runs.length, REFRIGERANT.length);
    runs.forEach((r, i) => assert.equal(r.to, runs[(i + 1) % runs.length].from));
    assert.equal(runs[0].from, 'compressor');
  }
  for (const r of summer) assert.equal(r.reverse, cycle.REVERSIBLE.has(r.name));
  assert.ok(winter.every((r) => !r.reverse));
  for (const name of ['discharge', 'return', 'intake']) assert.equal(summer.find((r) => r.name === name).reverse, false);
});

const changeover = await import('../../lab/heat-pump/changeover.js');
const { createChangeover, steady, STAGES, DURATION, FLIGHT, sentence } = changeover;

/** Steps a changeover at 60 fps and checks the valve rule on every frame. */
function play(c, seconds, onFrame = () => {}) {
  let s = c.current();
  for (let t = 0; t < seconds; t += 1 / 60) {
    s = c.update(1 / 60);
    // The flow may only run with the slider on a seat, and in the direction that seat gives.
    if (s.hz > 0) {
      assert.ok(s.valve === 0 || s.valve === 1, `flow at ${s.hz} Hz with the valve at ${s.valve} (${s.stage})`);
      assert.equal(s.direction, s.valve === 1 ? -1 : 1, `flow against the valve (${s.stage})`);
    }
    onFrame(s);
  }
  return s;
}
const close = (a, b) => Object.keys(b).forEach((k) => assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${k}: ${a[k]} ≠ ${b[k]}`));

// Catches: stages out of order (the valve moving before the compressor stops), or a show too short to read or too long to watch.
test('the changeover plays its stages in order and ends in the new season', () => {
  const c = createChangeover('winter', 57);
  c.setHz(20);
  c.start('summer');
  const seen = [];
  const end = play(c, DURATION + 0.5, (s) => { if (s.stage && seen.at(-1) !== s.stage) seen.push(s.stage); });
  assert.deepEqual(seen, STAGES.map((s) => s.name));
  assert.ok(DURATION >= 6 && DURATION <= 8, `${DURATION} s`);
  assert.equal(end.running, false);
  close(end, steady('summer', 20));
});

// Catches: a slider that moves while the camera still flies to the valve (the close-up misses it), or one still moving as the stage ends.
test('the slider moves only once the camera holds the valve close-up, and rests on its seat before the stage ends', () => {
  const c = createChangeover('winter', 57);
  c.start('summer');
  const valve = STAGES.findIndex((s) => s.name === 'valve');
  const start = STAGES.slice(0, valve).reduce((sum, s) => sum + s.seconds, 0);
  const at = (t) => {
    const probe = createChangeover('winter', 57);
    probe.start('summer');
    return probe.update(t);
  };
  assert.equal(at(start + FLIGHT - 0.01).valve, 0, 'moved during the flight');
  assert.ok(at(start + FLIGHT + 0.3).valve > 0, 'did not move after the flight');
  assert.equal(at(start + STAGES[valve].seconds - 0.2).valve, 1, 'still moving at the end of the stage');
  assert.ok(STAGES.every((s) => s.seconds - FLIGHT >= 0.3), 'a stage too short to hold its view');
});

// Catches: a reversal that restarts from the old season's resting state (the slider would jump) or ends half-switched.
test('reversing mid-show continues from where things are and ends in a consistent state', () => {
  const c = createChangeover('winter', 57);
  c.setHz(20);
  c.start('summer');
  let mid = null;
  play(c, DURATION, (s) => { if (!mid && s.stage === 'valve' && s.valve > 0.4) mid = s; });
  assert.ok(mid, 'the valve reached mid-travel');
  const c2 = createChangeover('winter', 57);
  c2.setHz(20);
  c2.start('summer');
  let at = c2.current();
  while (!(at.stage === 'valve' && at.valve > 0.4)) at = c2.update(1 / 60);
  c2.setHz(57);
  c2.start('winter');
  const first = c2.update(0);
  assert.ok(Math.abs(first.valve - at.valve) < 1e-9, 'the slider continues from its position');
  const end = play(c2, DURATION + 0.5);
  close(end, steady('winter', 57));
});

// Catches: a second tap that restarts the show instead of skipping it.
test('tapping the season under way again skips to its end', () => {
  const c = createChangeover('winter', 57);
  c.setHz(20);
  c.start('summer');
  play(c, 1);
  c.start('summer');
  assert.equal(c.running, false);
  close(c.current(), steady('summer', 20));
});

// Catches: a stage that crowds the screen with labels or a line too long for the phone's sentence panel.
test('each stage shows at most three labels and a short line in both directions', () => {
  for (const stage of STAGES) {
    assert.ok(stage.tags.length <= 3, stage.name);
    for (const season of ['winter', 'summer']) assert.ok(sentence(stage.name, season, 48).length <= 100, `${stage.name}: ${sentence(stage.name, season, 48)}`);
  }
});

const { PARTS } = await import('../../lab/heat-pump/parts.js');

// Catches: a stage label naming a part that does not exist (the label never shows) or a show-only part no stage uses.
test('every changeover label names a part, and every show-only part has a stage', () => {
  const used = new Set(STAGES.flatMap((s) => s.tags));
  for (const name of used) assert.ok(PARTS[name], `stage label ${name} has no part`);
  for (const [name, part] of Object.entries(PARTS)) if (part.when === 'show') assert.ok(used.has(name), `${name} is never shown`);
});

// Catches: a summer load that ignores the sun, which pins the inverter at its 20 Hz floor in every summer preset.
test('in summer the inverter modulates: hotter days need a faster compressor', () => {
  const hz = [25, 30, 35].map((outside) => coolingPump({ outside, flow: 18 }).frequency);
  assert.ok(hz[0] < hz[1] && hz[1] < hz[2], `${hz.join(' / ')} Hz`);
  assert.ok(hz[2] >= 40, 'a 35 °C day should run the compressor well above its minimum');
  const hot = coolingPump({ outside: 35, flow: 18 });
  assert.ok(Math.abs(hot.gain - 2.5) < 1e-9 && hot.gain < hot.cooling, 'the gain is part of the load, not all of it');
  assert.equal(coolingPump({ outside: 20, flow: 18 }).gain, 0);
});
