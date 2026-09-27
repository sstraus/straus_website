// Test helper: a synthetic ring of constant curvature. Only kn, ku, the pads and the width matter
// to the physics, so the frames are constant and the positions are all zero.
import { HALF_WIDTH } from './track.js';

export function ring({ length = 20000, kn = 0, ku = 0, pads = [], halfWidth = HALF_WIDTH } = {}) {
  const step = 2, count = length / step;
  const fill = (v) => { const a = new Float64Array(count * 3); for (let i = 0; i < count; i++) a.set(v, i * 3); return a; };
  return {
    length, step, count, halfWidth, pads, zones: [], startS: 0,
    pos: fill([0, 0, 0]), T: fill([1, 0, 0]), N: fill([0, 0, 1]), U: fill([0, 1, 0]),
    kn: new Float64Array(count).fill(kn), ku: new Float64Array(count).fill(ku), bank: new Float64Array(count),
  };
}
