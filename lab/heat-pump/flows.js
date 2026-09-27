/**
 * Air streaks, outside only: garden air drawn through the coil from the house
 * side and the far side, and the air the fan blows out: colder in winter
 * (blue), warmer in summer (orange). Positions are computed on the GPU from
 * the instance index and the time.
 */
import * as THREE from 'three/webgpu';
import { color, float, hash, instanceIndex, mix, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';
import { U, noGlow } from './materials.js';

/**
 * @param start  [min, max] corners of the box where streaks are born
 * @param dir    direction of travel (unit vector)
 * @param length distance travelled over one life
 * @param spread growth of the cross-section over the life (exhaust fans out)
 */
function stream({ count, start, dir, length, tint, along, spread = 0, center }) {
  const speed = uniform(0.5);
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const seed = instanceIndex.toFloat();
  const t = hash(seed.add(0.5)).add(time.mul(speed)).fract();
  const box = vec3(hash(seed.add(1.1)), hash(seed.add(2.3)), hash(seed.add(3.7)));
  const origin = vec3(...start[0]).add(box.mul(vec3(...start[1].map((n, i) => n - start[0][i]))));
  const fan = center ? origin.sub(vec3(...center)).mul(t.mul(spread).add(1)).add(vec3(...center)) : origin;
  material.positionNode = positionLocal.mul(float(1).add(t.mul(1.5))).add(fan).add(vec3(...dir).mul(t.mul(length)));
  const life = sin(t.mul(Math.PI));
  material.colorNode = mix(tint, color(0x6b5dd3), U.thermal.mul(0.6)).mul(life.mul(0.5).mul(U.air));
  material.mrtNode = noGlow();
  const geometry = new THREE.PlaneGeometry(0.05, 0.0022);
  if (along === 'z') geometry.rotateY(Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return { mesh, speed };
}

export function createAir() {
  // The garden air itself: cool blue in winter, pale amber in summer.
  const intake = mix(color(0x9fd4ff), color(0xffd9a8), U.fanWarm);
  const exhaust = mix(color(0x58a6ff), color(0xff8a3a), U.fanWarm);
  const streams = [
    // Few and short: they only mark where the air enters the coil and leaves the fan.
    stream({ count: 16, start: [[1.58, 0.45, -0.95], [1.64, 1.15, -0.45]], dir: [1, 0, 0], length: 0.38, tint: intake, along: 'x' }),
    stream({ count: 10, start: [[2.08, 0.45, -1.45], [2.36, 1.15, -1.4]], dir: [0, 0, 1], length: 0.33, tint: intake, along: 'z' }),
    stream({ count: 22, start: [[2.47, 0.64, -0.86], [2.5, 0.96, -0.54]], dir: [1, 0, 0], length: 0.6, tint: exhaust, along: 'x', spread: 0.5, center: [2.47, 0.8, -0.7] }),
  ];
  const group = new THREE.Group();
  for (const s of streams) group.add(s.mesh);
  return {
    group,
    /** Streak speed follows the fan, which follows the compressor frequency in Hz. */
    setRate(hz) {
      for (const s of streams) s.speed.value = 0.15 + 0.009 * hz;
    },
  };
}
