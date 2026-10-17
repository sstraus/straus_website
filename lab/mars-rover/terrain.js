/**
 * The ground: an endless, seeded height profile along x, in metres. Pure, so node can test it.
 *
 * The track is a field of dunes, the way wind builds them on Mars and everywhere else: each one has
 * a long, gentle windward side and a short, steep slip face on the lee, as steep as loose sand can
 * stand (the angle of repose, about 30 to 34°). That asymmetry is the whole game:
 *   - the rover climbs the windward side and leaves the ground at the crest;
 *   - coming down on the slip face, falling along it, is a clean landing, and the slope throws it
 *     forward faster (the Tiny Wings engine);
 *   - flying too far, it comes down on the rising windward side of the NEXT dune, nose into the
 *     sand: a hard landing. Jumping at the right point carries it over that dune to its slip face.
 * Every face is straight with rounded ends, so the height and its slope are continuous (the wheels
 * are never kicked by a corner). Fine wind ripples ride on top. The first stretch is flat.
 */

export const FLAT_START = 60; // m of level ground before the first dune
export const MAX_SLOPE = 0.8; // dh/dx: about 39°, the steepest face the generator may make
const LEE = Math.tan((31 * Math.PI) / 180); // the steepest point of a slip face
const STOSS = Math.tan((15 * Math.PI) / 180); // the steepest point of a windward side

/** Seeded random numbers (mulberry32), so a run can be replayed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smoothstep and its derivative: 0 → 1 with zero slope at both ends (for the ripples' fade-in).
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const smoothSlope = (t) => (t <= 0 || t >= 1 ? 0 : 6 * t * (1 - t));

/**
 * A straight face with rounded ends: 0 → 1 over t in [0, 1], rising at a constant rate in the
 * middle and bending to zero slope over a fraction `r` at each end. A real dune face is straight,
 * not an S-curve: the windward side rises at the same angle right from its foot, which is what
 * makes landing on it hard.
 */
function face(t, r) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const m = 1 / (1 - r);
  if (t < r) return (m * t * t) / (2 * r);
  if (t > 1 - r) return 1 - (m * (1 - t) * (1 - t)) / (2 * r);
  return m * (t - r / 2);
}
function faceSlope(t, r) {
  if (t <= 0 || t >= 1) return 0;
  const m = 1 / (1 - r);
  if (t < r) return (m * t) / r;
  if (t > 1 - r) return (m * (1 - t)) / r;
  return m;
}
const TOE = 0.2; // rounding of the windward side, at its foot and at the crest
const BRINK = 0.18; // rounding of the slip face, at the brink and at its foot

/** 0 at the start, 1 from about 2.5 km on. */
export const difficulty = (x) => Math.max(0, Math.min(1, (x - FLAT_START) / 2500));

export function createTerrain(seed = 1) {
  const rand = mulberry32(seed);
  const ripple = mulberry32(seed ^ 0x5bd1e995);
  const ripples = [
    { a: 0.03, k: (2 * Math.PI) / 3.1, p: ripple() * 6.283 },
    { a: 0.015, k: (2 * Math.PI) / 1.7, p: ripple() * 6.283 },
  ];
  // The dunes are laid out one after another as the rover needs them.
  // Each: { start, crest, end, height, base, after } — windward from start to crest, slip face to end.
  const dunes = [];
  let cursor = FLAT_START;
  let level = 0; // dunes stand on a floor that wanders up and down a little, like a real dune field

  function grow(until) {
    while (cursor < until) {
      const d = difficulty(cursor);
      const height = 1.2 + rand() * (1.3 + 4.3 * d);
      const windward = (height / ((1 - TOE) * STOSS)) * (1 + rand() * 0.4);
      // The floor after this dune sits a little lower or higher: the slip face may not fall all the
      // way back, or may fall a little further. Its length follows the real fall, so its steepest
      // point is never past the angle of repose.
      const drop = (rand() - 0.55) * 0.5 * height;
      const lee = ((height - drop) / ((1 - BRINK) * LEE)) * (1 + rand() * 0.15);
      const start = cursor;
      const crest = start + windward;
      const end = crest + lee;
      dunes.push({ start, crest, end, height, base: level, after: level + drop });
      level += drop;
      // A stretch of floor before the next dune: long at first, short later on.
      cursor = end + rand() * (4 - 3 * d) + 1.5;
    }
  }

  /** The dune that covers x, or the one just before it (for the floor between dunes). */
  function duneAt(x) {
    grow(x + 400);
    if (dunes.length === 0 || x < dunes[0].start) return null;
    let lo = 0;
    let hi = dunes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (dunes[mid].start <= x) lo = mid; else hi = mid - 1;
    }
    return dunes[lo];
  }

  const ripplesAt = (x) => ripples.reduce((s, r) => s + r.a * Math.sin(r.k * x + r.p), 0);
  const ripplesSlope = (x) => ripples.reduce((s, r) => s + r.a * r.k * Math.cos(r.k * x + r.p), 0);
  // The ripples fade in after the flat start, so the first metres are level.
  const fade = (x) => smooth((x - FLAT_START) / 20);
  const fadeSlope = (x) => smoothSlope((x - FLAT_START) / 20) / 20;
  const ripplesBase = ripplesAt(FLAT_START);

  function height(x) {
    const r = fade(x) * (ripplesAt(x) - ripplesBase);
    const dune = duneAt(x);
    if (!dune) return r;
    if (x <= dune.crest) {
      // Windward: from the floor up to the crest.
      return r + dune.base + dune.height * face((x - dune.start) / (dune.crest - dune.start), TOE);
    }
    // Slip face: from the crest down to the floor that follows it.
    const top = dune.base + dune.height;
    return r + top + (dune.after - top) * face((x - dune.crest) / (dune.end - dune.crest), BRINK);
  }

  function slope(x) {
    const r = fadeSlope(x) * (ripplesAt(x) - ripplesBase) + fade(x) * ripplesSlope(x);
    const dune = duneAt(x);
    if (!dune) return r;
    if (x <= dune.crest) {
      const w = dune.crest - dune.start;
      return r + (dune.height / w) * faceSlope((x - dune.start) / w, TOE);
    }
    const w = dune.end - dune.crest;
    const top = dune.base + dune.height;
    return r + ((dune.after - top) / w) * faceSlope((x - dune.crest) / w, BRINK);
  }

  /** Every dune that starts in [x0, x1), for the renderer. */
  function features(x0, x1) {
    grow(x1 + 50);
    return dunes.filter((d) => d.start >= x0 && d.start < x1);
  }

  /** The next dune crest ahead of x (for the coach and the chips), or null. */
  function nextCrest(x, within = 120) {
    grow(x + within + 50);
    const dune = dunes.find((d) => d.crest > x);
    return dune && dune.crest - x <= within ? { c: dune.crest, h: dune.height, dune } : null;
  }

  return { seed, height, slope, features, nextCrest };
}
