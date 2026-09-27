// Field lines of the coil for the cutaway view. Pure JavaScript, no three.js.
// The coil is a set of coaxial circular loops; each loop has the exact field
// (complete elliptic integrals). Units: lengths in cm, field in units of mu0*I per cm.
// The soft iron core is left out: it makes the field stronger, the shape of the lines
// above the dish stays close to that of the air-core coil.

/** Complete elliptic integrals K(m) and E(m), parameter m = k^2, by the arithmetic-geometric mean. */
export function ellipticKE(m) {
  let a = 1;
  let b = Math.sqrt(1 - m);
  let c = Math.sqrt(m);
  let sum = (c * c) / 2;
  let power = 1;
  while (Math.abs(c) > 1e-15) {
    const an = (a + b) / 2;
    c = (a - b) / 2;
    b = Math.sqrt(a * b);
    a = an;
    power *= 2;
    sum += (power / 2) * c * c;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - sum) };
}

/** Field of one loop of radius a in the plane z = 0, at (r, z). Returns { br, bz }. */
export function loopField(a, r, z) {
  const s = a * a + r * r + z * z;
  const alpha2 = s - 2 * a * r;
  const beta2 = s + 2 * a * r;
  const beta = Math.sqrt(beta2);
  const { K, E } = ellipticKE(1 - alpha2 / beta2);
  const c = 1 / Math.PI;
  const bz = (c / (2 * alpha2 * beta)) * ((a * a - r * r - z * z) * E + alpha2 * K);
  // Br is odd in r: near the axis use the first-order expansion instead of 0/0.
  if (r < 1e-6 * a) return { br: (3 * a * a * z * r) / (4 * Math.pow(a * a + z * z, 2.5)), bz };
  const br = ((c * z) / (2 * alpha2 * beta * r)) * (s * E - alpha2 * K);
  return { br, bz };
}

/** Loops of a winding: `layers` radii between rIn and rOut, `rows` heights between y0 and y1. */
export function windingLoops({ rIn, rOut, y0, y1, layers = 3, rows = 12 }) {
  const loops = [];
  for (let i = 0; i < layers; i++) {
    const a = rIn + ((i + 0.5) / layers) * (rOut - rIn);
    for (let j = 0; j < rows; j++) loops.push({ a, y: y0 + ((j + 0.5) / rows) * (y1 - y0) });
  }
  return loops;
}

export function coilField(loops, r, y) {
  let br = 0;
  let bz = 0;
  for (const loop of loops) {
    const f = loopField(loop.a, r, y - loop.y);
    br += f.br;
    bz += f.bz;
  }
  return { br, bz };
}

/**
 * Trace one field line in the (r, y) half-plane from a seed, forwards and backwards,
 * until it closes back on the seed height at a radius outside `closeOutside`, or leaves the box.
 * Returns an ordered list of [r, y] points.
 */
export function traceLine(loops, seed, { step = 0.08, closeOutside = 6, box = 60, maxSteps = 6000 } = {}) {
  const direction = (r, y, sign) => {
    const { br, bz } = coilField(loops, Math.abs(r), y);
    const n = Math.hypot(br, bz) || 1;
    return [(sign * br) / n, (sign * bz) / n];
  };
  const run = (sign) => {
    const points = [];
    let [r, y] = seed;
    for (let i = 0; i < maxSteps; i++) {
      const [k1r, k1y] = direction(r, y, sign);
      const [k2r, k2y] = direction(r + (step / 2) * k1r, y + (step / 2) * k1y, sign);
      const [k3r, k3y] = direction(r + (step / 2) * k2r, y + (step / 2) * k2y, sign);
      const [k4r, k4y] = direction(r + step * k3r, y + step * k3y, sign);
      const nr = r + (step / 6) * (k1r + 2 * k2r + 2 * k3r + k4r);
      const ny = y + (step / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
      // Closed: crossed the seed height again, outside the winding.
      if (i > 10 && nr > closeOutside && (y - seed[1]) * (ny - seed[1]) <= 0) {
        points.push([nr, seed[1]]);
        break;
      }
      r = Math.max(nr, 0);
      y = ny;
      points.push([r, y]);
      if (r > box || Math.abs(y) > box) break;
    }
    return points;
  };
  const forward = run(1);
  const backward = run(-1);
  return [...backward.reverse(), seed, ...forward];
}
