// Load progress for the bench loader, without the DOM: labelled steps, progress inside a step,
// a displayed value that never stalls and never goes back, and one timing row per step.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const CREEP = 0.35; // 1/s: how fast the idle stroke closes the gap to the end of the current step
const CREEP_LIMIT = 0.97; // the idle stroke never reaches the end of a step by itself
const FOLLOW = 10; // 1/s: how fast the displayed value catches up with reported progress

/**
 * steps: the expected number of steps, including the first one (the module download).
 * now: clock in ms; the default performance.now() counts from the navigation start.
 */
export function createLoadModel({ steps = 10, first = 'Loading three.js', now = () => performance.now(), start = 0 } = {}) {
  let total = Math.max(1, steps);
  let index = 0;
  let sub = 0;
  let shown = 0;
  let finished = false;
  let phase = { label: first, since: start };
  const rows = [];

  const target = () => clamp01((index + sub) / total);
  const stepEnd = () => clamp01((index + 1) / total);

  return {
    get label() { return phase.label; },
    get rows() { return rows; },
    get value() { return shown; },
    /** Change the expected number of steps (it never drops below the steps already taken). */
    expect(n) { total = Math.max(n, index + 1); },
    step(label) {
      if (finished) return;
      const t = now();
      rows.push({ phase: phase.label, ms: Math.round(t - phase.since) });
      phase = { label, since: t };
      index += 1;
      sub = 0;
      if (index >= total) total = index + 1;
    },
    /** Progress inside the current step, 0..1. Out-of-order reports never move it back. */
    progress(f) { sub = Math.max(sub, clamp01(f)); },
    /** Advance the displayed value by dt seconds and return it. */
    tick(dt) {
      if (finished) return shown;
      const t = target();
      let next = t > shown ? shown + (t - shown) * Math.min(1, dt * FOLLOW) : shown;
      // Idle stroke: while nothing reports, keep moving towards the end of this step.
      const cap = t + (stepEnd() - t) * CREEP_LIMIT;
      if (next < cap) next += (cap - next) * Math.min(1, dt * CREEP);
      shown = Math.max(shown, Math.min(next, stepEnd()));
      return shown;
    },
    /** Close the last step and add the total. Returns the timing rows. */
    finish() {
      if (finished) return rows;
      const t = now();
      rows.push({ phase: phase.label, ms: Math.round(t - phase.since) });
      rows.push({ phase: 'total', ms: Math.round(t - start) });
      finished = true;
      shown = 1;
      return rows;
    },
  };
}

/**
 * How much of one pen stroke is drawn when the whole sketch is at `p` (0..1).
 * delay and duration are the stroke's pen times, total is the pen time of the whole sketch.
 */
export function strokeFraction(p, delay, duration, total) {
  if (p >= 1) return 1; // exact at the end, whatever the float rounding of p * total
  return clamp01((p * total - delay) / Math.max(duration, 1e-6));
}

/**
 * Objects with the same key share one shader build in three r186 (RenderObject material and
 * geometry keys), so precompile renders one of them per key. Duck-typed on Object3D fields.
 */
export function unitKey(o) {
  const materials = Array.isArray(o.material) ? o.material : [o.material];
  const layout = Object.keys(o.geometry.attributes).sort()
    .map((name) => `${name}${o.geometry.attributes[name].itemSize}`).join(',');
  let clip = '';
  for (let p = o.parent; p; p = p.parent) if (p.isClippingGroup) { clip = p.uuid; break; }
  return [
    o.type,
    materials.map((m) => m.uuid).join('+'),
    layout,
    Object.keys(o.geometry.morphAttributes).join(','),
    o.geometry.index ? 'i' : '',
    o.receiveShadow, o.castShadow,
    o.isInstancedMesh || o.isBatchedMesh || o.count > 1 ? o.uuid : '', // their buffers are part of the key
    clip,
  ].join('|');
}

/**
 * three r186 gives each render target its own framebuffer texture for the transmission copy, made
 * with clone(), so all of them share one image. The first one to see a new size writes it into that
 * image and re-allocates; the others then see the new size already there and keep their old GPU
 * texture, and the copy of the bigger frame into it fails. Returns true when `texture` is new or its
 * image size changed since the last call (the caller then sets needsUpdate), and records the size.
 */
export function sizeChanged(sizes, texture) {
  const { width, height } = texture.image;
  const last = sizes.get(texture);
  sizes.set(texture, { width, height });
  return !last || last.width !== width || last.height !== height;
}
