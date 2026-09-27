// The orbital circuit as pure data: a turtle walks a list of pieces (turn, pitch, bank), a
// Hermite join closes the loop, and the result is resampled every STEP metres with an
// orthonormal frame per sample. World axes follow three.js: +Y up. Frame convention:
// T = forward, N = right, U = deck up. Positive turn = right, positive bank = right edge down,
// positive d = right of the centre line. No three.js here, so it runs under node --test.

export const STEP = 2;            // m between samples
export const HALF_WIDTH = 11;     // m from the centre line to the wall
// The barrier: its face, its foot and its top above the deck. A ship higher than the top clears it.
export const WALL = { d: 11.2, h0: 0.3, h1: 3.3 };
export const DEG = Math.PI / 180;

// turn/pitch in degrees, spread over the piece with eased ends so the curvature is continuous.
// bank (degrees) follows the same easing, so a turn leans in only while it turns. roll (degrees)
// turns the deck about the centre line and keeps the turn: roll 360 on a straight is a corkscrew.
export const PIECES = [
  { len: 460, tag: 'start' },
  { len: 520, turn: 90, bank: 24, tag: 'sweeper' },
  { len: 60 },
  { len: 260, roll: -360, tag: 'twist' },
  { len: 40 },
  { len: 400, pitch: 360, shift: -38, tag: 'loop' },
  { len: 240 },
  { len: 90, pitch: -30, tag: 'drop' },
  { len: 110, tag: 'drop' },
  { len: 90, pitch: 30, tag: 'drop' },
  { len: 90 },
  { len: 320, turn: -180, bank: -35, tag: 'hairpin' },
  { len: 343, tag: 'pads' },
  { len: 60, pitch: 14, tag: 'crest' },
  { len: 30, tag: 'crest' },
  { len: 40, pitch: -28, tag: 'crest' },
  { len: 60, tag: 'crest' },
  { len: 70, pitch: 14, tag: 'crest' },
  { len: 80 },
  { len: 400, pitch: 360, shift: 38, tag: 'loop' },
  { len: 120 },
  { len: 220, turn: 55, bank: 22, tag: 'esses' },
  { len: 220, turn: -55, bank: -22, tag: 'esses' },
  { len: 80 },
  { len: 420, turn: -90, bank: -24, tag: 'sweeper' },
  { len: 90, pitch: 12, tag: 'climb' },
  { len: 40, tag: 'climb' },
  { len: 250, roll: 360, tag: 'twist' },
  { len: 40, tag: 'climb' },
  { len: 90, pitch: -12, tag: 'climb' },
  { len: 716, tag: 'tunnel' },
  { len: 120 },
  { len: 600, turn: -180, bank: -30, tag: 'sweeper' },
  { len: 200 },
];

// Items and speed pads, placed by piece tag and fraction along it. d in metres from the centre.
const PAD_PLAN = [
  { tag: 'start', at: 0.62, kind: 'item', ds: [-6, 0, 6] },
  { tag: 'pads', at: 0.2, kind: 'speed', ds: [-5] },
  { tag: 'pads', at: 0.45, kind: 'speed', ds: [5] },
  { tag: 'pads', at: 0.7, kind: 'item', ds: [-6, 0, 6] },
  { tag: 'loop', nth: 1, at: 0.0, kind: 'speed', ds: [0], before: 60 },
  { tag: 'tunnel', at: 0.35, kind: 'speed', ds: [-5, 5] },
  { tag: 'tunnel', at: 0.8, kind: 'item', ds: [-6, 0, 6] },
];
export const PAD_HALF = { speed: { w: 3, l: 6 }, item: { w: 2.2, l: 2.2 } };

const ease = (u) => u * u * (3 - 2 * u);
// Plateau with eased shoulders (20 % each side); normalised so its integral over [0,1] is 1.
const plateau = (u) => ease(Math.min(1, u / 0.2)) * ease(Math.min(1, (1 - u) / 0.2));
const PLATEAU_AREA = (() => { let a = 0; const n = 2000; for (let i = 0; i < n; i++) a += plateau((i + 0.5) / n) / n; return a; })();

const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Rotate the pair (a, b) by angle: a' = a cos + b sin, b' = b cos - a sin.
function rotPair(a, b, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [[a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s],
    [b[0] * c - a[0] * s, b[1] * c - a[1] * s, b[2] * c - a[2] * s]];
}

// Walk the pieces in 0.5 m steps. Returns the raw polyline with a path up vector B and bank.
function walk(pieces) {
  let p = v3(), T = v3(1, 0, 0), B = v3(0, 1, 0), N = cross(T, B);
  const pts = [{ p, B, bank: 0, piece: 0 }];
  const ranges = [];
  const h = 0.5;
  pieces.forEach((pc, k) => {
    const n = Math.round(pc.len / h);
    const i0 = pts.length - 1;
    let shiftDone = 0;
    const rolled = pc.roll ? pc.roll * DEG : 0;
    for (let i = 0; i < n; i++) {
      const u1 = (i + 1) / n, um = (i + 0.5) / n;
      const w = plateau(um) / PLATEAU_AREA / n;          // fraction of the piece's angle in this step
      if (pc.turn) [T, N] = rotPair(T, N, (pc.turn * DEG) * w);
      if (pc.pitch) [T, B] = rotPair(T, B, (pc.pitch * DEG) * w);
      p = add(p, T, h);
      if (pc.shift) {
        const target = pc.shift * ease(u1);
        p = add(p, N, target - shiftDone);
        shiftDone = target;
      }
      const bank = (pc.bank ? pc.bank * DEG * plateau(u1) : 0) + rolled * ease(u1);
      pts.push({ p, B, bank, piece: k });
    }
    ranges.push({ tag: pc.tag, i0, i1: pts.length - 1 });
  });
  return { pts, T, B, ranges };
}

// Cubic Hermite from the walk's end back to its start, both tangents scaled by the gap.
function join(end, endT, endB, start, startT, startB) {
  const gap = len(sub(start, end));
  const m = gap * 1.1;
  const out = [];
  const n = Math.max(8, Math.round(gap / 0.5));
  for (let i = 1; i < n; i++) {
    const t = i / n, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const p = [0, 1, 2].map((a) => h00 * end[a] + h10 * m * endT[a] + h01 * start[a] + h11 * m * startT[a]);
    out.push({ p, B: norm(lerp3(endB, startB, ease(t))), bank: 0, piece: -1 });
  }
  return { pts: out, gap };
}

export function buildTrack(pieces = PIECES) {
  const w = walk(pieces);
  const first = w.pts[0];
  const last = w.pts[w.pts.length - 1];
  const j = join(last.p, w.T, w.B, first.p, [1, 0, 0], first.B);
  const raw = w.pts.concat(j.pts);

  // Cumulative arc length of the closed raw polyline.
  const acc = [0];
  for (let i = 1; i <= raw.length; i++) acc.push(acc[i - 1] + len(sub(raw[i % raw.length].p, raw[i - 1].p)));
  const total = acc[raw.length];
  const count = Math.round(total / STEP);
  const step = total / count;

  const pos = new Float64Array(count * 3), up0 = [], bank = new Float64Array(count);
  let k = 0;
  for (let i = 0; i < count; i++) {
    const s = i * step;
    while (acc[k + 1] < s) k++;
    const a = raw[k], b = raw[(k + 1) % raw.length];
    const t = (s - acc[k]) / (acc[k + 1] - acc[k] || 1);
    const p = lerp3(a.p, b.p, t);
    pos.set(p, i * 3);
    up0.push(lerp3(a.B, b.B, t));
    // Shortest way round: a corkscrew ends at 360 degrees and the next piece starts at 0.
    const db = Math.atan2(Math.sin(b.bank - a.bank), Math.cos(b.bank - a.bank));
    bank[i] = a.bank + db * t;
  }

  // Frames: T from central differences of the closed curve, U = path up rolled by the bank and
  // made orthogonal to T, N = T x U (right).
  const T = new Float64Array(count * 3), N = new Float64Array(count * 3), U = new Float64Array(count * 3);
  const P = (i) => { const q = ((i % count) + count) % count; return [pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]]; };
  for (let i = 0; i < count; i++) {
    const t = norm(sub(P(i + 1), P(i - 1)));
    let b = up0[i];
    b = norm(sub(b, [t[0] * dot(b, t), t[1] * dot(b, t), t[2] * dot(b, t)]));
    const r = cross(t, b);                               // path right
    const c = Math.cos(bank[i]), sn = Math.sin(bank[i]);
    const u = norm([b[0] * c + r[0] * sn, b[1] * c + r[1] * sn, b[2] * c + r[2] * sn]);
    const n = cross(t, u);
    T.set(t, i * 3); U.set(u, i * 3); N.set(n, i * 3);
  }

  // Curvature split into the deck plane (kn, + = bends right) and the deck normal (ku, + = bends
  // toward the deck's up side: a dip, the inside of a loop, a banked turn).
  const kn = new Float64Array(count), ku = new Float64Array(count);
  const Tv = (i) => { const q = ((i % count) + count) % count; return [T[q * 3], T[q * 3 + 1], T[q * 3 + 2]]; };
  for (let i = 0; i < count; i++) {
    const dT = sub(Tv(i + 1), Tv(i - 1));
    const kv = [dT[0] / (2 * step), dT[1] / (2 * step), dT[2] / (2 * step)];
    kn[i] = dot(kv, [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]]);
    ku[i] = dot(kv, [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]]);
  }

  // Zones in arc length (the loop's sideways shift makes the walk a little longer than its pieces).
  const zones = w.ranges.filter((r) => r.tag).map((r) => ({ tag: r.tag, s0: acc[r.i0], s1: acc[r.i1] }));
  const zone = (tag) => zones.filter((z) => z.tag === tag);

  const pads = [];
  for (const plan of PAD_PLAN) {
    const z = zone(plan.tag)[plan.nth || 0];
    const s = z.s0 + (z.s1 - z.s0) * plan.at - (plan.before || 0);
    for (const d of plan.ds) pads.push({ kind: plan.kind, s: ((s % total) + total) % total, d, ...PAD_HALF[plan.kind] });
  }

  const startS = zone('start')[0].s0 + 160;              // start line, with room for the grid behind
  return { length: total, step, count, pos, T, N, U, kn, ku, bank, zones, pads, startS, joinGap: j.gap, halfWidth: HALF_WIDTH };
}

export const wrapS = (track, s) => ((s % track.length) + track.length) % track.length;

// Interpolated frame at station s. Writes into `out` (reused by the caller to avoid garbage).
export function frameAt(track, s, out = { p: [0, 0, 0], T: [0, 0, 0], N: [0, 0, 0], U: [0, 0, 0], kn: 0, ku: 0, bank: 0 }) {
  const x = wrapS(track, s) / track.step;
  const i = Math.floor(x) % track.count, j = (i + 1) % track.count, t = x - Math.floor(x);
  for (const [key, arr] of [['p', track.pos], ['T', track.T], ['N', track.N], ['U', track.U]]) {
    const o = out[key];
    o[0] = arr[i * 3] + (arr[j * 3] - arr[i * 3]) * t;
    o[1] = arr[i * 3 + 1] + (arr[j * 3 + 1] - arr[i * 3 + 1]) * t;
    o[2] = arr[i * 3 + 2] + (arr[j * 3 + 2] - arr[i * 3 + 2]) * t;
  }
  out.kn = track.kn[i] + (track.kn[j] - track.kn[i]) * t;
  out.ku = track.ku[i] + (track.ku[j] - track.ku[i]) * t;
  out.bank = track.bank[i] + (track.bank[j] - track.bank[i]) * t;
  return out;
}

// World position of a point at station s, lateral d, height h above the deck.
export function toWorld(track, s, d, h, out = [0, 0, 0], f = frameAt(track, s)) {
  for (let a = 0; a < 3; a++) out[a] = f.p[a] + f.N[a] * d + f.U[a] * h;
  return out;
}

// Signed distance along the track from a to b in (-L/2, L/2].
export function gapS(track, a, b) {
  let g = wrapS(track, b - a);
  if (g > track.length / 2) g -= track.length;
  return g;
}

export const inZone = (track, s, tag) => track.zones.some((z) => z.tag === tag && s >= z.s0 && s <= z.s1);
