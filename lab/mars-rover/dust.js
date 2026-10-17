// Dust: puffs thrown up by the wheels, and a cloud when the rover lands. Real dust, not a signal:
// it rises, drifts and settles under Mars gravity, slowed by an air so thin that fine grains still
// hang in it for a while. One instanced mesh of camera-facing quads, updated on the CPU.
import * as THREE from 'three/webgpu';
import { color, vec4, uv, attribute, smoothstep, length, uniform, mix, mrt, mx_noise_float, positionWorld } from 'three/tsl';
import { MARS } from './physics.js';

const COUNT = 280;

export function createDust() {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
  const tone = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
  geometry.setAttribute('fade', fade);
  geometry.setAttribute('tone', tone);
  const light = uniform(1);
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.name = 'dust';
  {
    const r = length(uv().sub(0.5)).mul(2);
    const soft = smoothstep(1, 0.2, r).mul(mx_noise_float(positionWorld.mul(2.2)).mul(0.35).add(0.75));
    const tint = mix(color(0xc98a5c), color(0xe3b48a), attribute('tone', 'float')).mul(light);
    material.colorNode = vec4(tint, soft.mul(attribute('fade', 'float')).mul(0.55));
    material.mrtNode = mrt({ emissive: vec4(0, 0, 0, 1) }); // dust does not glow
  }
  const puffs = new THREE.InstancedMesh(geometry, material, COUNT);
  puffs.name = 'dust';
  puffs.frustumCulled = false;
  puffs.castShadow = false;

  const pool = Array.from({ length: COUNT }, (_, i) => ({ i, alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: 1, size: 1, grow: 1 }));
  let next = 0;
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  function emit(x, y, z, vx, vy, vz, size, life) {
    const d = pool[next];
    next = (next + 1) % COUNT;
    d.alive = true;
    d.p.set(x, y, z);
    d.v.set(vx, vy, vz);
    d.age = 0;
    d.life = life;
    d.size = size;
    d.grow = 1.5 + rand() * 1.5;
    tone.setX(d.i, rand());
  }

  return {
    mesh: puffs,
    light,
    /** A puff behind each wheel that is on the ground, more of them the faster it goes. */
    trail(pose, speed, dt) {
      if (speed < 2) return;
      const rate = speed * 0.9 * dt; // puffs per wheel this frame
      for (const w of pose.wheels) {
        if (!w.contact) continue;
        for (let k = rate + rand(); k >= 1; k--) {
          const z = (rand() < 0.5 ? -1 : 1) * 1.12 + (rand() - 0.5) * 0.3;
          emit(w.x - 0.2, w.y - 0.18, z, -speed * 0.15 + (rand() - 0.5), 0.4 + rand() * 0.9, (rand() - 0.5) * 0.8, 0.25 + rand() * 0.25, 1.4 + rand() * 1.2);
        }
      }
    },
    /** A cloud when the rover lands: bigger for a harder hit. */
    burst(x, y, hit) {
      const n = Math.min(60, 10 + hit * 7);
      for (let k = 0; k < n; k++) {
        const a = rand() * Math.PI * 2;
        const s = 1 + rand() * hit * 0.6;
        emit(x + (rand() - 0.5) * 2.4, y - 0.8, (rand() - 0.5) * 2.8, Math.cos(a) * s, 0.5 + rand() * s * 0.7, Math.sin(a) * s * 0.6, 0.35 + rand() * 0.4, 1.8 + rand() * 1.6);
      }
    },
    update(camera, dt) {
      for (const d of pool) {
        if (!d.alive) {
          fade.setX(d.i, 0);
          matrix.makeScale(0.0001, 0.0001, 0.0001);
          puffs.setMatrixAt(d.i, matrix);
          continue;
        }
        d.age += dt;
        if (d.age >= d.life) { d.alive = false; continue; }
        // Mars gravity pulls the grains down; the thin air slows them only a little.
        d.v.y -= MARS.g * 0.18 * dt;
        d.v.multiplyScalar(1 - 0.9 * dt);
        d.p.addScaledVector(d.v, dt);
        const t = d.age / d.life;
        fade.setX(d.i, Math.min(1, t * 8) * (1 - t) * (1 - t));
        scale.setScalar(d.size * (1 + t * d.grow));
        matrix.compose(d.p, camera.quaternion, scale);
        puffs.setMatrixAt(d.i, matrix);
      }
      puffs.instanceMatrix.needsUpdate = true;
      fade.needsUpdate = true;
      tone.needsUpdate = true;
    },
  };
}
