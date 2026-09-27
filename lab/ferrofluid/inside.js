// Glowing field lines for the cutaway view: traced once from the coil model in fieldlines.js,
// swept around the axis, merged into one mesh. Pulses run along B; they reverse with AC.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uniform, uv, color, mix, float, smoothstep, positionWorld, vec2 } from 'three/tsl';
import { windingLoops, traceLine } from './fieldlines.js';

const SEEDS = [0.6, 1.2, 1.8, 2.3, 2.65]; // cm from the axis, at the middle of the coil
const AZIMUTHS = 12;
const LIMIT = { r: 18, y: 24 }; // lines fade out and stop here
const DASH = 1.6; // cm between pulses

/** Split a traced [r, y] line into runs above the plate and inside the display limits. */
function visibleRuns(line) {
  const runs = [];
  let run = [];
  for (const [r, y] of line) {
    if (y >= 0 && r <= LIMIT.r && y <= LIMIT.y) run.push([r, y]);
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs.filter((r) => r.length > 8);
}

export function createFieldLines({ rIn, rOut, y0, y1 }) {
  const loops = windingLoops({ rIn, rOut, y0, y1 });
  const middle = (y0 + y1) / 2;
  const profiles = SEEDS.flatMap((r) => visibleRuns(traceLine(loops, [r, middle], { step: 0.1 })));

  const geometries = [];
  for (let k = 0; k < AZIMUTHS; k++) {
    const phi = (k / AZIMUTHS) * Math.PI * 2 + 0.13;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    for (const run of profiles) {
      const points = run.filter((_, i) => i % 3 === 0 || i === run.length - 1).map(([r, y]) => new THREE.Vector3(r * s, y, r * c));
      const curve = new THREE.CatmullRomCurve3(points);
      const length = curve.getLength();
      const geometry = new THREE.TubeGeometry(curve, Math.max(8, Math.round(length * 2)), 0.035, 5, false);
      // uv.x in centimetres along the line, so the pulses have the same spacing on every line.
      const uvs = geometry.attributes.uv;
      for (let i = 0; i < uvs.count; i++) uvs.setX(i, uvs.getX(i) * length);
      geometries.push(geometry);
    }
  }
  const geometry = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());

  const strength = uniform(0); // 0 hidden, 1 full current and cutaway open
  const flow = uniform(0); // pulse phase, advanced by the drive current
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const phase = uv().x.div(DASH).sub(flow).fract();
  const pulse = phase.mul(phase.oneMinus()).mul(4).pow(6);
  const fade = smoothstep(float(LIMIT.r), float(7), vec2(positionWorld.x, positionWorld.z).length())
    .mul(smoothstep(float(LIMIT.y), float(12), positionWorld.y));
  // Emissive, not colour: the lines are real emitters for the bloom MRT.
  material.colorNode = color(0x000000);
  material.emissiveNode = mix(color(0x58a6ff), color(0xe6f1ff), pulse).mul(pulse.mul(2.2).add(0.35)).mul(fade).mul(strength);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  return { mesh, strength, flow };
}
