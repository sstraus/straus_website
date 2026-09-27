// The ferrofluid free surface: a dense grid displaced on the GPU.
// The CPU model (physics.js) solves one amplitude per surface cell; this module
// turns those cells into a hexagonal field of spikes with TSL.
import * as THREE from 'three/webgpu';
import {
  texture, uniform, vec2, vec3, float, cos, pow, clamp, exp, length, min, normalize,
  smoothstep, positionGeometry, transformNormalToView,
} from 'three/tsl';

const SQRT3_2 = Math.sqrt(3) / 2;
const MIN_SHARPNESS = 1;
const MAX_SHARPNESS = 3.6;
const SPIKE_HEIGHT = 0.35; // cm of spike per unit amplitude (chosen, see the essay)

// Normalised hexagonal pattern in [0, 1]: 1 on the spike tips.
function hexPattern(x, z, k) {
  return clamp(
    cos(x.mul(k))
      .add(cos(x.mul(-0.5).add(z.mul(SQRT3_2)).mul(k)))
      .add(cos(x.mul(-0.5).sub(z.mul(SQRT3_2)).mul(k)))
      .add(1.5)
      .div(4.5),
    0,
    1,
  );
}

// Mean of pattern^p over one cell, so the troughs sink as the spikes rise (volume is conserved).
function patternMean(p, n = 96) {
  let sum = 0;
  const k = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // x over two periods and z over three periods of the oblique waves: a whole number of cells.
      const x = ((i + 0.5) / n) * 2;
      const z = ((j + 0.5) / n) * 2 * Math.sqrt(3);
      const c = Math.cos(k * x) + Math.cos(k * (-0.5 * x + SQRT3_2 * z)) + Math.cos(k * (-0.5 * x - SQRT3_2 * z));
      sum += Math.pow(Math.min(Math.max((c + 1.5) / 4.5, 0), 1), p);
    }
  }
  return sum / (n * n);
}

/**
 * @param {object} o
 * @param {number} o.radius  inner dish radius, cm
 * @param {number} o.wavelength  critical wavelength, cm
 * @param {number} o.rings  number of radial rings in the model
 */
export function createFluid({ radius, wavelength, rings }) {
  const data = new Uint16Array(rings * rings * 4);
  const profile = new THREE.DataTexture(data, rings, rings, THREE.RGBAFormat, THREE.HalfFloatType);
  profile.magFilter = THREE.LinearFilter;
  profile.minFilter = THREE.LinearFilter;
  profile.needsUpdate = true;

  const k = uniform((2 * Math.PI) / wavelength);
  const R = float(radius);

  // Height of the surface above the rest level at (x, z), cm.
  const heightAt = (x, z) => {
    const r = length(vec2(x, z));
    const uv = vec2(x, z).div(R.mul(2)).add(0.5);
    const cell = texture(profile, uv).level(0);
    const phaseX = x.add(cell.w.mul(0.35));
    const phaseZ = z.sub(cell.w.mul(0.22));
    const spikes = cell.x.mul(pow(hexPattern(phaseX, phaseZ, k), cell.z));
    const wall = smoothstep(R, R.sub(0.25), r);
    const meniscus = exp(R.sub(r).div(-0.12)).mul(0.08);
    return spikes.mul(wall).add(cell.y).add(cell.w.mul(0.10)).add(meniscus);
  };

  // Points outside the dish collapse onto the wall.
  const clampedXZ = () => {
    const xz = positionGeometry.xz;
    return xz.mul(min(float(1), R.div(length(xz).max(1e-4))));
  };

  // Oil-based ferrofluid is an opaque black dielectric: all its look is reflection.
  // Both layers are near mirrors: a rough base lobe smears the studio strips into a milky haze.
  const material = new THREE.MeshPhysicalNodeMaterial({
    color: 0x010102,
    roughness: 0.03,
    metalness: 0,
    ior: 1.55,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.015,
  });

  material.positionNode = (() => {
    const xz = clampedXZ();
    return vec3(xz.x, heightAt(xz.x, xz.y), xz.y);
  })();

  // Per-pixel normal from central differences: sharp highlights on the spike flanks.
  material.normalNode = (() => {
    const xz = clampedXZ();
    const e = 0.012;
    const dx = heightAt(xz.x.sub(e), xz.y).sub(heightAt(xz.x.add(e), xz.y));
    const dz = heightAt(xz.x, xz.y.sub(e)).sub(heightAt(xz.x, xz.y.add(e)));
    return transformNormalToView(normalize(vec3(dx, 2 * e, dz)));
  })();

  const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2, 360, 360);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const means = Array.from({ length: 33 }, (_, i) => patternMean(MIN_SHARPNESS + ((MAX_SHARPNESS - MIN_SHARPNESS) * i) / 32));
  const meanAt = (p) => {
    const t = ((p - MIN_SHARPNESS) / (MAX_SHARPNESS - MIN_SHARPNESS)) * 32;
    const i = Math.min(31, Math.floor(t));
    return means[i] + (means[i + 1] - means[i]) * (t - i);
  };

  /** Upload the model state: amplitude (dimensionless) and mound (metres) per ring. */
  function update(model) {
    for (let i = 0; i < rings * rings; i++) {
      const a = model.amplitude[i];
      const height = Math.max(a - model.floor, 0) * SPIKE_HEIGHT; // a flat mirror at rest
      const sharpness = MIN_SHARPNESS + (MAX_SHARPNESS - MIN_SHARPNESS) * Math.min(a / 1.4, 1);
      const mound = model.mound[i] * 100 - height * meanAt(sharpness);
      data[i * 4] = THREE.DataUtils.toHalfFloat(height);
      data[i * 4 + 1] = THREE.DataUtils.toHalfFloat(mound);
      data[i * 4 + 2] = THREE.DataUtils.toHalfFloat(sharpness);
      data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(model.disturbance[i]);
    }
    profile.needsUpdate = true;
  }

  /** Own reflection strength: the fluid is the hero, so it mirrors the studio harder than the set. */
  function setEnvironment(map, intensity) {
    material.envMap = map;
    material.envMapIntensity = intensity;
  }

  return { mesh, update, setEnvironment, spikeHeight: SPIKE_HEIGHT };
}
