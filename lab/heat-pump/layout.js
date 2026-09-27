/**
 * Where everything is, in metres. No three.js, so node can test it.
 *
 * Axes: x runs from the room (negative) through the outside wall, whose outer
 * face is x = 0, into the garden. y is up and 0 is the garden grade. z = 0 is
 * the section plane: the ground, the foundation and the house are cut there
 * and continue back to negative z. Buried services lie on that plane, so the
 * cut shows them along their whole run.
 */

export const SECTION = 0;
export const EXTENT = { x0: -4.1, x1: 3.3, z0: -3.615 };

export const LEVEL = {
  groundBottom: -1.3,
  footingBottom: -1.1,
  footingTop: -0.8,
  trenchBottom: -0.8,
  sandTop: -0.5,
  backfillTop: -0.2,
  gravelBottom: -0.45,
  slabBottom: -0.25,
  slabTop: -0.05,
  insulationTop: 0.07,
  screedTop: 0.14,
  floor: 0.155,
  ceiling: 2.7,
};

/** Outside wall build-up from the inner face outwards. The back wall uses the same layers. */
export const WALL_LAYERS = [
  { key: 'plaster', thickness: 0.015 },
  { key: 'block', thickness: 0.25 },
  { key: 'eps', thickness: 0.14 },
  { key: 'render', thickness: 0.01 },
];
export const WALL_THICKNESS = WALL_LAYERS.reduce((sum, layer) => sum + layer.thickness, 0);
export const WALL_INNER = -WALL_THICKNESS; // x of the inner face of the outside wall
export const BACK_INNER = -3.2; // z of the inner face of the back wall
export const WINDOW = { x0: -2.75, x1: -1.35, y0: 1.0, y1: 2.25 };

/** The screed stops here and the oak stops further back, so the floor build-up reads as steps. */
export const FLOOR_STEPS = { screedFront: -0.9, oakFront: -1.6 };

export const TRENCH = { x0: 0.1, x1: 2.45, z0: -0.6 };
export const PIPE_DEPTH = 0.66; // centre of the twin pipe below grade

/** Equipment volumes. Pipes that end inside them are held by them. */
export const UNIT = { min: [2.0, 0.3, -1.05], max: [2.45, 1.255, 0.05] };
export const CABINET = { min: [-0.66, 0.3, -0.55], max: [WALL_INNER, 1.1, 0] };
export const CONSUMER = { min: [-0.52, 1.35, -0.45], max: [WALL_INNER, 1.8, -0.05] };
export const ISOLATOR = { min: [0, 1.3, -0.22], max: [0.09, 1.52, -0.02] };
export const RADIATOR = { min: [-2.55, 0.305, -3.155], max: [-1.55, 0.905, -3.055] };
export const RADIATOR_ZONE = { min: [-2.7, 0.3, BACK_INNER], max: [-1.4, 0.95, -3.05] };
export const EQUIPMENT = { UNIT, CABINET, CONSUMER, ISOLATOR, RADIATOR_ZONE };

/** Manifold bars inside the cabinet: flow on top, return below. */
export const MANIFOLD = {
  flow: { x: -0.6, y: 0.85, z0: -0.47, z1: -0.06, radius: 0.018 },
  return: { x: -0.5, y: 0.6, z0: -0.47, z1: -0.06, radius: 0.018 },
};

// ---------------------------------------------------------------- solids

const solid = (name, material, stage, min, max) => ({ name, material, stage, min, max });

function wallSolids() {
  const list = [];
  const { ceiling, slabTop, floor } = LEVEL;
  let s = 0;
  for (const { key, thickness } of WALL_LAYERS) {
    const e = s + thickness;
    // The plaster starts at floor level; an edge strip fills the gap beside the floor build-up.
    const y0 = key === 'plaster' ? floor : slabTop;
    // Outside wall: an L corner with the back wall, layer by layer, so no two layers overlap.
    list.push(solid(`outside wall ${key}`, key, 'walls', [WALL_INNER + s, y0, BACK_INNER - e], [WALL_INNER + e, ceiling, 0]));
    // Back wall, split around the window opening.
    const x1 = WALL_INNER + s;
    const z = [BACK_INNER - e, BACK_INNER - s];
    const w = WINDOW;
    list.push(
      solid(`back wall ${key} below window`, key, 'walls', [EXTENT.x0, y0, z[0]], [x1, w.y0, z[1]]),
      solid(`back wall ${key} above window`, key, 'walls', [EXTENT.x0, w.y1, z[0]], [x1, ceiling, z[1]]),
      solid(`back wall ${key} left of window`, key, 'walls', [EXTENT.x0, w.y0, z[0]], [w.x0, w.y1, z[1]]),
      solid(`back wall ${key} right of window`, key, 'walls', [w.x1, w.y0, z[0]], [x1, w.y1, z[1]]),
    );
    if (key === 'plaster') {
      list.push(
        solid('edge strip, outside wall', 'edge', 'floor', [WALL_INNER, slabTop, BACK_INNER - e], [WALL_INNER + e, floor, 0]),
        solid('edge strip, back wall', 'edge', 'floor', [EXTENT.x0, slabTop, z[0]], [x1, floor, z[1]]),
      );
    }
    s = e;
  }
  return list;
}

const Z0 = EXTENT.z0;
const L = LEVEL;
const T = TRENCH;

/**
 * Every solid of the diorama as an axis-aligned box. The renderer builds them
 * as bevelled blocks. They may touch but never overlap: two overlapping boxes
 * would share coplanar faces and flicker.
 */
export const SOLIDS = [
  solid('display base', 'base', 'ground', [EXTENT.x0 - 0.1, -1.38, Z0 - 0.085], [EXTENT.x1 + 0.1, L.groundBottom, 0.08]),
  solid('deep soil', 'subsoil', 'ground', [EXTENT.x0, L.groundBottom, Z0], [EXTENT.x1, L.footingBottom, 0]),
  // Garden
  solid('topsoil', 'topsoil', 'ground', [0, L.backfillTop, Z0], [EXTENT.x1, 0, 0]),
  solid('subsoil by the wall', 'subsoil', 'ground', [0, L.footingTop, Z0], [T.x0, L.backfillTop, 0]),
  solid('subsoil behind the trench', 'subsoil', 'ground', [T.x0, L.footingBottom, Z0], [T.x1, L.backfillTop, T.z0]),
  solid('subsoil under the trench', 'subsoil', 'ground', [T.x0, L.footingBottom, T.z0], [T.x1, L.trenchBottom, 0]),
  solid('subsoil beyond the trench', 'subsoil', 'ground', [T.x1, L.footingBottom, Z0], [EXTENT.x1, L.backfillTop, 0]),
  solid('trench sand', 'sand', 'ground', [T.x0, L.trenchBottom, T.z0], [T.x1, L.sandTop, 0]),
  solid('trench backfill', 'backfill', 'ground', [T.x0, L.sandTop, T.z0], [T.x1, L.backfillTop, 0]),
  // Under the house
  solid('strip footing', 'concrete', 'foundation', [-0.65, L.footingBottom, Z0], [T.x0, L.footingTop, 0]),
  solid('fill under the slab', 'fill', 'foundation', [EXTENT.x0, L.footingBottom, Z0], [-0.65, L.gravelBottom, 0]),
  solid('fill inside the stem wall', 'fill', 'foundation', [-0.65, L.footingTop, Z0], [WALL_INNER, L.gravelBottom, 0]),
  solid('stem wall', 'concrete', 'foundation', [WALL_INNER, L.footingTop, Z0], [-0.15, L.slabTop, 0]),
  solid('perimeter insulation', 'xps', 'foundation', [-0.15, L.footingTop, Z0], [0, L.slabTop, 0]),
  solid('gravel sub-base', 'gravel', 'foundation', [EXTENT.x0, L.gravelBottom, Z0], [WALL_INNER, L.slabBottom, 0]),
  solid('floor slab', 'concrete', 'foundation', [EXTENT.x0, L.slabBottom, Z0], [WALL_INNER, L.slabTop, 0]),
  // Floor build-up
  solid('floor insulation', 'tacker', 'floor', [EXTENT.x0, L.slabTop, BACK_INNER], [WALL_INNER, L.insulationTop, 0]),
  solid('screed', 'screed', 'floor', [EXTENT.x0, L.insulationTop, BACK_INNER], [WALL_INNER, L.screedTop, FLOOR_STEPS.screedFront]),
  solid('oak floor', 'oak', 'floor', [EXTENT.x0, L.screedTop, BACK_INNER], [WALL_INNER, L.floor, FLOOR_STEPS.oakFront]),
  ...wallSolids(),
  // Two concrete kerbs carry the outdoor unit.
  solid('unit kerb, back', 'concrete', 'unit', [1.98, 0.002, -1.12], [2.08, 0.15, 0]),
  solid('unit kerb, front', 'concrete', 'unit', [2.37, 0.002, -1.12], [2.47, 0.15, 0]),
];

// ---------------------------------------------------------------- routes

const PIPE_Y = 0.078; // floor pipes lie on the insulation, under the screed
const UFH = { left: -3.85, right: -0.75, first: -0.12, pitch: 0.15, rows: 20 };
const flowOutlet = [MANIFOLD.flow.x, MANIFOLD.flow.y - MANIFOLD.flow.radius, -0.12];
const returnOutlet = [MANIFOLD.return.x, MANIFOLD.return.y - MANIFOLD.return.radius, -0.4];

/** One underfloor circuit: a serpentine from the flow bar, back along the outside wall to the return bar. */
function serpentine() {
  const points = [flowOutlet, [flowOutlet[0], PIPE_Y, flowOutlet[2]]];
  const bends = [0.05];
  for (let k = 0; k < UFH.rows; k++) {
    const z = UFH.first - k * UFH.pitch;
    const last = k === UFH.rows - 1;
    const end = k % 2 === 0 ? UFH.left : last ? returnOutlet[0] : UFH.right;
    if (k > 0) {
      points.push([k % 2 === 0 ? UFH.right : UFH.left, PIPE_Y, z]);
      bends.push(UFH.pitch / 2);
    }
    points.push([end, PIPE_Y, z]);
    bends.push(last ? 0.05 : UFH.pitch / 2);
  }
  points.push([returnOutlet[0], PIPE_Y, returnOutlet[2]], returnOutlet);
  bends.push(0.05);
  return { points, bends };
}
export const UFH_LAYOUT = UFH;

/**
 * Pipes and ducts as centre lines, written in the direction the water or the
 * current flows. `bends` holds the bend radius at each inner point. Every leg
 * is straight along one axis, as an installer lays it.
 */
export const ROUTES = {
  jacket: {
    label: 'twin pipe', radius: 0.085,
    points: [[-0.435, -PIPE_DEPTH, 0], [2.26, -PIPE_DEPTH, 0], [2.26, 0.02, 0]],
    bends: [0.25],
  },
  flow: {
    label: 'flow', radius: 0.016,
    points: [[2.22, 0.72, -0.06], [2.22, 0.72, 0], [2.3, 0.72, 0], [2.3, -0.7, 0], [-0.6, -0.7, 0], [-0.6, MANIFOLD.flow.y, 0], [-0.6, MANIFOLD.flow.y, MANIFOLD.flow.z1]],
    bends: [0.02, 0.02, 0.29, 0.1, 0.05],
  },
  return: {
    label: 'return', radius: 0.016,
    points: [[-0.5, MANIFOLD.return.y, MANIFOLD.return.z1], [-0.5, MANIFOLD.return.y, 0], [-0.5, -0.62, 0], [2.22, -0.62, 0], [2.22, 0.5, 0], [2.22, 0.5, -0.06]],
    bends: [0.05, 0.05, 0.21, 0.02],
  },
  power: {
    label: 'power duct', radius: 0.02,
    points: [[0.035, 1.3, -0.12], [0.035, -0.08, -0.12], [0.035, -0.08, 0], [0.035, -0.4, 0], [2.105, -0.4, 0], [2.105, 0.3, 0]],
    bends: [0.05, 0.05, 0.08, 0.1],
  },
  ufh: { label: 'underfloor loop', radius: 0.008, mode: 'floor', ...serpentine() },
  radiatorFlow: {
    label: 'radiator flow', radius: 0.008, mode: 'radiator',
    points: [flowOutlet, [flowOutlet[0], PIPE_Y, flowOutlet[2]], [-2.64, PIPE_Y, flowOutlet[2]], [-2.64, PIPE_Y, -3.105], [-2.64, 0.335, -3.105]],
    bends: [0.05, 0.08, 0.08],
  },
  radiatorReturn: {
    label: 'radiator return', radius: 0.008, mode: 'radiator',
    points: [[-1.46, 0.335, -3.105], [-1.46, PIPE_Y, -3.105], [-1.46, PIPE_Y, returnOutlet[2]], [returnOutlet[0], PIPE_Y, returnOutlet[2]], returnOutlet],
    bends: [0.08, 0.08, 0.05],
  },
  vessel: {
    label: 'expansion line', radius: 0.006, joins: 'return',
    points: [[2.335, 0.42, -0.05], [2.22, 0.42, -0.05], [2.22, 0.42, -0.016]],
    bends: [0.02],
  },
};

/** Foam sleeves on the carriers where they leave the twin pipe. */
export const INSULATION = [
  { route: 'flow', radius: 0.026, points: [[2.3, 0.3, 0], [2.3, 0.02, 0]], bends: [] },
  { route: 'flow', radius: 0.026, points: [[-0.435, -0.7, 0], [-0.6, -0.7, 0], [-0.6, 0.3, 0]], bends: [0.1] },
  { route: 'return', radius: 0.026, points: [[-0.5, 0.3, 0], [-0.5, -0.62, 0], [-0.435, -0.62, 0]], bends: [0.05] },
  { route: 'return', radius: 0.026, points: [[2.22, 0.02, 0], [2.22, 0.3, 0]], bends: [] },
];

/**
 * The sealed R290 circuit, in process order. Each run goes from one
 * component to the next; `stage` says what state the refrigerant is in.
 */
export const REFRIGERANT = [
  { name: 'discharge', from: 'compressor', to: 'reversing', stage: 'discharge', radius: 0.0095,
    points: [[2.33, 0.689, -0.22], [2.33, 0.818, -0.22]], bends: [] },
  { name: 'hot gas', from: 'reversing', to: 'plate', stage: 'discharge', radius: 0.0095,
    points: [[2.29, 0.862, -0.22], [2.29, 0.95, -0.22], [2.08, 0.95, -0.22], [2.08, 0.95, -0.02], [2.08, 0.72, -0.02], [2.08, 0.72, -0.06]],
    bends: [0.025, 0.03, 0.03, 0.02] },
  { name: 'liquid', from: 'plate', to: 'eev', stage: 'liquid', radius: 0.0065,
    points: [[2.08, 0.5, -0.06], [2.08, 0.5, -0.02], [2.08, 0.4, -0.02], [2.08, 0.4, -0.28]], bends: [0.015, 0.03] },
  { name: 'feed', from: 'eev', to: 'coil', stage: 'evaporating', radius: 0.0065,
    points: [[2.08, 0.4, -0.28], [2.08, 0.4, -0.4], [2.04, 0.4, -0.4], [2.04, 0.4, -1.0], [2.04, 0.6, -1.0], [2.04, 0.6, -0.4],
      [2.04, 0.8, -0.4], [2.04, 0.8, -1.0], [2.04, 1.0, -1.0], [2.04, 1.0, -0.4]],
    bends: [0.02, 0.02, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] },
  { name: 'suction', from: 'coil', to: 'reversing', stage: 'suction', radius: 0.011,
    points: [[2.04, 1.0, -0.4], [2.04, 1.0, -0.3], [2.37, 1.0, -0.3], [2.37, 1.0, -0.22], [2.37, 0.862, -0.22]], bends: [0.04, 0.03, 0.03] },
  { name: 'return', from: 'reversing', to: 'accumulator', stage: 'suction', radius: 0.011,
    points: [[2.33, 0.862, -0.22], [2.33, 0.9, -0.22], [2.33, 0.9, -0.33], [2.16, 0.9, -0.33], [2.16, 0.9, -0.25], [2.16, 0.66, -0.25]],
    bends: [0.02, 0.03, 0.03, 0.03] },
  { name: 'intake', from: 'accumulator', to: 'compressor', stage: 'suction', radius: 0.011,
    points: [[2.2, 0.52, -0.25], [2.262, 0.52, -0.25]], bends: [] },
];

// ---------------------------------------------------------------- path maths

const sub = (a, b) => a.map((n, i) => n - b[i]);
const add = (a, b) => a.map((n, i) => n + b[i]);
const scale = (a, k) => a.map((n) => n * k);
const length = (a) => Math.hypot(...a);

/**
 * A route as straight lines joined by bends. Each bend is a quadratic Bézier
 * with its control point on the corner, so the pipe stays inside the corner
 * the installer would bend. The renderer builds the same segments as curves.
 */
export function routeSegments({ points, bends = [] }) {
  const segments = [];
  let start = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i];
    const toPrev = sub(points[i - 1], corner);
    const toNext = sub(points[i + 1], corner);
    const r = Math.min(bends[i - 1] ?? 0, length(toPrev) / 2, length(toNext) / 2);
    const a = add(corner, scale(toPrev, r / length(toPrev)));
    const b = add(corner, scale(toNext, r / length(toNext)));
    segments.push({ type: 'line', a: start, b: a });
    if (r > 0) segments.push({ type: 'bend', a, control: corner, b });
    start = b;
  }
  segments.push({ type: 'line', a: start, b: points.at(-1) });
  return segments.filter((s) => s.type === 'bend' || length(sub(s.b, s.a)) > 1e-9);
}

/** Point at parameter t in [0, 1] along one segment. */
export function segmentPoint(segment, t) {
  if (segment.type === 'line') return add(segment.a, scale(sub(segment.b, segment.a), t));
  const u = 1 - t;
  return segment.a.map((n, i) => u * u * n + 2 * u * t * segment.control[i] + t * t * segment.b[i]);
}

/** Points along the route no more than `step` metres apart. */
export function sampleRoute(route, step = 0.02) {
  const out = [route.points[0]];
  for (const segment of routeSegments(route)) {
    const span = segment.type === 'line' ? length(sub(segment.b, segment.a)) : length(sub(segment.control, segment.a)) * 2;
    const n = Math.max(1, Math.ceil(span / step));
    for (let k = 1; k <= n; k++) out.push(segmentPoint(segment, k / n));
  }
  return out;
}

/** Places a service run is clipped or strapped, beyond the solids it touches. */
export const CLIPS = [
  [0.035, 1.0, -0.12], [0.035, 0.6, -0.12], [0.035, 0.2, -0.12],
];
