/**
 * The season changeover as a staged show. No three.js, so node can test it.
 *
 * Every value is a pure function of the time since the start, the state the
 * show started from (a snapshot, so a reversal mid-show continues from where
 * things are) and the target season:
 *   valve      0 winter position … 1 summer position of the slider
 *   direction  +1 or −1: the flow direction of the four reversible runs
 *   roles      0 … 1: condenser and evaporator temperatures cross over
 *   water      0 … 1: winter to summer water temperatures
 *   fan        0 … 1: cold exhaust (winter) to warm exhaust (summer)
 *   hz         compressor frequency; 0 whenever the valve is between its seats
 */
import { model } from './physics.js';

export const STAGES = [
  { name: 'rampDown', seconds: 0.9, view: 'machine', tags: ['compressor', 'inverter'] },
  { name: 'valve', seconds: 1.9, view: 'valve', tags: ['portPlate', 'portCoil', 'reversing'] },
  { name: 'reverse', seconds: 1.1, view: 'machine', tags: ['coil', 'plate', 'compressor'] },
  { name: 'expansion', seconds: 1.1, view: 'eev', tags: ['eev'] },
  { name: 'water', seconds: 1.1, view: 'machine', tags: ['plate', 'pump'] },
  { name: 'fan', seconds: 1.0, view: 'unit', tags: ['fan', 'coil'] },
  { name: 'rampUp', seconds: 0.8, view: 'unit', tags: ['compressor', 'inverter'] },
];
/** Seconds the camera takes to fly to a stage's view; the rest of the stage holds it. The slider waits for it. */
export const FLIGHT = 0.5;
/** Seconds the slider rests on its new seat before the valve stage ends. */
const SEATED = 0.4;
export const DURATION = STAGES.reduce((sum, s) => sum + s.seconds, 0);

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const mix = (a, b, k) => a + (b - a) * k;

/** The resting state of a season. */
export function steady(season, hz) {
  const s = season === 'summer' ? 1 : 0;
  return { valve: s, direction: s ? -1 : 1, roles: s, water: s, fan: s, hz };
}

const SENTENCES = {
  rampDown: () => 'The inverter slows the compressor to a stop: the valve only moves without pressure behind it.',
  valve: () => 'The 4-way valve swaps which coil gets the hot gas.',
  reverse: (summer) => (summer
    ? 'The flow runs backwards. The coil outside now condenses, the plate boils.'
    : 'The flow runs forwards again. The plate condenses, the coil outside boils.'),
  expansion: (summer) => `The expansion valve still sits between the two, now feeding the ${summer ? 'plate' : 'coil'}.`,
  water: (summer) => (summer
    ? 'The water crosses over to 18 °C: the floor now takes heat out of the room.'
    : 'The water warms up again: the floor gives heat to the room.'),
  fan: (summer) => (summer ? 'The fan now blows warm air out into the garden.' : 'The fan now draws cold air through the coil.'),
  rampUp: (summer, hz) => `The compressor ramps up to the ${Math.round(hz)} Hz the house needs.`,
};

/** The line for a stage of a changeover towards `season`. */
export function sentence(stage, season, hz) {
  return SENTENCES[stage](season === 'summer', hz);
}

export function createChangeover(season, hz) {
  let target = season;
  let toHz = hz;
  let from = steady(season, hz);
  let t = DURATION;

  function current() {
    const goal = steady(target, toHz);
    if (t >= DURATION) return { ...goal, running: false, stage: null, index: -1, k: 1, progress: 1, target };
    let start = 0;
    let index = 0;
    while (t >= start + STAGES[index].seconds) start += STAGES[index++].seconds;
    const k = (t - start) / STAGES[index].seconds;
    const e = smooth(k);
    // Each quantity moves in its own stage; before it holds the snapshot, after it holds the goal.
    const phase = (stage, value) => (index < stage ? from[value] : index > stage ? goal[value] : null);
    const minHz = model.minHz;
    const hz = [from.hz * (1 - e), 0, minHz * e, minHz, minHz, minHz, mix(minHz, toHz, e)][index];
    return {
      running: true,
      stage: STAGES[index].name,
      index,
      k,
      progress: t / DURATION,
      target,
      hz,
      // The slider waits for the camera to arrive at the valve, then rests on its seat for a moment.
      valve: phase(1, 'valve') ?? mix(from.valve, goal.valve, smooth(clamp01((t - start - FLIGHT) / (STAGES[1].seconds - FLIGHT - SEATED)))),
      direction: index >= 2 ? goal.direction : from.direction,
      roles: phase(2, 'roles') ?? mix(from.roles, goal.roles, e),
      water: phase(4, 'water') ?? mix(from.water, goal.water, e),
      fan: phase(5, 'fan') ?? mix(from.fan, goal.fan, e),
    };
  }

  return {
    get target() { return target; },
    get running() { return t < DURATION; },
    /**
     * Switch to `season`. Asking again for the season already under way skips
     * to its end; asking for the other one reverses from where things are.
     */
    start(season) {
      if (season === target) {
        t = DURATION;
        return;
      }
      from = current();
      target = season;
      t = 0;
    },
    /** The frequency the new load needs, for the ramp up and the resting state. */
    setHz(value) { toHz = value; },
    update(dt) {
      t = Math.min(DURATION, t + dt);
      return current();
    },
    current,
  };
}
