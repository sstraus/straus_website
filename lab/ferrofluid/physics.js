// Ferrofluid in a vertical magnetic field: the Rosensweig normal-field instability.
// Pure JavaScript, no three.js, so it can be tested with `node --test`.
//
// Exact linear theory (Cowley & Rosensweig 1967):
//   - critical wavelength  lambda_c = 2*pi*sqrt(sigma / (rho*g))
//   - critical magnetization  M_c^2 = (2/mu0) * (1 + 1/mu_r) * sqrt(rho*g*sigma)
// Phenomenological part (labelled as such on the page):
//   - spike amplitude A follows a Ginzburg-Landau type equation with a
//     quadratic term, the standard form for hexagons, which gives hysteresis:
//       dA/dt = (eps*A + beta*A^2 - A^3) / tau + D * laplacian(A)

export const MU0 = 4e-7 * Math.PI;
export const G = 9.81;

// A light hydrocarbon ferrofluid, close to Ferrotec EFH1. Linear magnetization law.
export const FLUID = {
  density: 1210, // kg/m^3
  surfaceTension: 0.025, // N/m
  susceptibility: 1.6, // chi, so mu_r = 2.6
};

/** Critical wavelength in metres. */
export function criticalWavelength(fluid = FLUID) {
  return 2 * Math.PI * Math.sqrt(fluid.surfaceTension / (fluid.density * G));
}

/** Critical magnetization inside the fluid, A/m. */
export function criticalMagnetization(fluid = FLUID) {
  const mu = fluid.susceptibility + 1;
  const root = Math.sqrt(fluid.density * G * fluid.surfaceTension);
  return Math.sqrt((2 / MU0) * (1 + 1 / mu) * root);
}

/**
 * Critical applied flux density above a flat layer, tesla.
 * Normal B is continuous, so the field inside is H = B / (mu0 * mu_r) and M = chi * H.
 */
export function criticalField(fluid = FLUID) {
  const mu = fluid.susceptibility + 1;
  return (MU0 * mu * criticalMagnetization(fluid)) / fluid.susceptibility;
}

/**
 * Normal magnetic traction on the free surface of a linear fluid, pascal:
 * mu0 * integral(M dH) + mu0 * M^2 / 2 = chi * B^2 / (2 * mu0 * mu_r).
 */
export function magneticPressure(b, fluid = FLUID) {
  const mu = fluid.susceptibility + 1;
  return (fluid.susceptibility * b * b) / (2 * MU0 * mu);
}

/**
 * Axial flux density of a cylindrical permanent magnet, tesla.
 * z: distance from the pole face, radius and thickness in the same unit, br: remanence.
 */
export function magnetAxialField(z, radius, thickness, br) {
  const far = z + thickness;
  return (br / 2) * (far / Math.hypot(radius, far) - z / Math.hypot(radius, z));
}

/**
 * Radial profile of the vertical field component in a horizontal plane,
 * normalised to 1 on the axis. Point-dipole approximation at height h.
 */
export function dipoleProfile(r, h) {
  const q = (r * r) / (h * h);
  return (1 - q / 2) / Math.pow(1 + q, 2.5);
}

/** Vertical field at a point below an off-axis cylindrical magnet (dipole radial approximation). */
export function magnetFieldAt(x, z, magnetX, magnetZ, gap, radius, thickness, remanence) {
  const axial = magnetAxialField(gap, radius, thickness, remanence);
  return axial * dipoleProfile(Math.hypot(x - magnetX, z - magnetZ), gap + thickness / 2);
}

const BETA = 0.6;
const TAU = 0.15;
const DIFFUSION = 5e-6;
const FLOOR = 0.01;
const MAX_STEP = 1 / 500;
const MOUND_RELAX = 0.28; // chosen viscous response time, seconds

/** A square surface grid; cells outside the circular dish are ignored. */
export class SurfaceModel {
  constructor({ rings = 96, radius = 0.045, depth = 0.004, fluid = FLUID } = {}) {
    this.rings = rings;
    this.radius = radius;
    this.depth = depth;
    this.fluid = fluid;
    this.dr = 2 * radius / (rings - 1);
    this.criticalField = criticalField(fluid);
    this.floor = FLOOR;
    const size = rings * rings;
    this.field = new Float64Array(size);
    this.amplitude = new Float64Array(size).fill(FLOOR);
    this.mound = new Float64Array(size);
    this.disturbance = new Float64Array(size);
    this.scratch = new Float64Array(size);
    this.time = 0;
    this.knocks = [];
  }

  coordinate(i) { return -this.radius + i * this.dr; }
  index(x, z) {
    const i = Math.max(0, Math.min(this.rings - 1, Math.round((x + this.radius) / this.dr)));
    const j = Math.max(0, Math.min(this.rings - 1, Math.round((z + this.radius) / this.dr)));
    return j * this.rings + i;
  }
  sample(x, z) {
    const index = this.index(x, z);
    return { field: this.field[index], amplitude: this.amplitude[index], mound: this.mound[index] };
  }
  knock(x, z) { this.knocks.push({ x, z, time: this.time }); }

  /** fieldAt(x,z) returns vertical flux density in tesla, in dish coordinates. */
  step(dt, fieldAt) {
    const { rings, field } = this;
    for (let j = 0; j < rings; j++) {
      const z = this.coordinate(j);
      for (let i = 0; i < rings; i++) field[j * rings + i] = fieldAt(this.coordinate(i), z);
    }
    const substeps = Math.max(1, Math.ceil(dt / MAX_STEP));
    for (let s = 0; s < substeps; s++) this.advance(dt / substeps);
    this.updateMound(dt);
    this.time += dt;
    this.knocks = this.knocks.filter((knock) => this.time - knock.time < 2);
    for (let j = 0; j < rings; j++) {
      const z = this.coordinate(j);
      for (let i = 0; i < rings; i++) {
        const x = this.coordinate(i);
        let wave = 0;
        for (const knock of this.knocks) {
          const age = this.time - knock.time;
          const distance = Math.hypot(x - knock.x, z - knock.z);
          const front = distance - age * 0.055;
          wave += Math.exp(-front * front / (2 * 0.003 * 0.003)) * Math.exp(-age * 2.5) * Math.sin(age * 26);
        }
        this.disturbance[j * rings + i] = wave;
      }
    }
  }

  advance(dt) {
    const { rings, dr, radius, amplitude: a, scratch: next, field } = this;
    const bc2 = this.criticalField ** 2;
    const diffusion = DIFFUSION / (dr * dr);
    for (let j = 0; j < rings; j++) {
      const z = this.coordinate(j);
      for (let i = 0; i < rings; i++) {
        const x = this.coordinate(i);
        const k = j * rings + i;
        if (x * x + z * z >= radius * radius) { next[k] = FLOOR; continue; }
        const eps = (field[k] ** 2 - bc2) / bc2;
        const left = a[k - 1] ?? FLOOR;
        const right = a[k + 1] ?? FLOOR;
        const up = a[k - rings] ?? FLOOR;
        const down = a[k + rings] ?? FLOOR;
        const growth = (eps * a[k] + BETA * a[k] ** 2 - a[k] ** 3) / TAU;
        next[k] = Math.max(FLOOR, a[k] + dt * (growth + diffusion * (left + right + up + down - 4 * a[k])));
      }
    }
    a.set(next);
  }

  /** Magnetic-pressure lift, area balanced and relaxed by viscosity. */
  updateMound(dt) {
    const { rings, field, mound, fluid, radius } = this;
    let sum = 0;
    let count = 0;
    for (let j = 0; j < rings; j++) for (let i = 0; i < rings; i++) {
      const x = this.coordinate(i), z = this.coordinate(j);
      if (x * x + z * z >= radius * radius) continue;
      sum += magneticPressure(field[j * rings + i], fluid);
      count++;
    }
    const mean = sum / count;
    const blend = 1 - Math.exp(-dt / MOUND_RELAX);
    for (let j = 0; j < rings; j++) for (let i = 0; i < rings; i++) {
      const k = j * rings + i;
      const lift = Math.max((magneticPressure(field[k], fluid) - mean) / (fluid.density * G), -0.9 * this.depth);
      mound[k] += (lift - mound[k]) * blend;
    }
  }

  maxAmplitude() {
    let max = 0;
    for (const v of this.amplitude) max = Math.max(max, v);
    return max;
  }

  activeArea(threshold = 0.3) {
    let cells = 0;
    for (const v of this.amplitude) if (v > threshold) cells++;
    return cells * this.dr * this.dr;
  }
}

/** Nearest-neighbour distance of a hexagonal pattern built from three waves of wavelength lambda. */
export function hexSpacing(lambda) {
  return (2 * lambda) / Math.sqrt(3);
}

/** Number of spikes that fit in an area, one per hexagonal cell. */
export function spikeCount(area, lambda) {
  const a = hexSpacing(lambda);
  return Math.round(area / ((Math.sqrt(3) / 2) * a * a));
}
