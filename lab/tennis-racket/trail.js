/**
 * Stroboscopic trail: frozen copies of the racket, like a multi-exposure
 * sports photo. Three instanced meshes (frame, red face, white face) with
 * additive blending; an instance's colour is its brightness.
 */
import * as THREE from 'three/webgpu';
import { ghostGeometries, RED, WHITE } from './racket-model.js';
import { glowOutput, unlit } from './post.js';

const FRAME = new THREE.Color(0x79c0ff);
const FLIP = new THREE.Color(0xd2a8ff);
const RED_C = new THREE.Color(RED);
const WHITE_C = new THREE.Color(WHITE);

export function createTrail(capacity) {
  const { frame, red, white } = ghostGeometries();
  // Ghosts are exposures, not lights: nothing goes to bloom.
  const material = () => {
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
    m.mrtNode = glowOutput();
    return m;
  };
  const meshes = [frame, red, white].map((geometry) => {
    const mesh = unlit(new THREE.InstancedMesh(geometry, material(), capacity));
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    mesh.count = 0;
    mesh.frustumCulled = false;
    return mesh;
  });
  const group = new THREE.Group();
  group.add(...meshes);

  let ghosts = []; // { matrix, born, flip }
  const tmp = new THREE.Color();

  return {
    group,

    clear() {
      ghosts = [];
      for (const mesh of meshes) mesh.count = 0;
    },

    /** Freezes a copy at `matrix` (world). `flip` marks the exposure closest to a flip. */
    capture(matrix, now, flip = false) {
      ghosts.push({ matrix: matrix.clone(), born: now, flip });
      if (ghosts.length > capacity) ghosts.shift();
    },

    /**
     * Uploads the ghosts. `life` (seconds of simulated time) fades old ones;
     * Infinity keeps the whole exposure. `now` is the current simulated time.
     */
    update(now, life, gain = 1) {
      ghosts = ghosts.filter((g) => now - g.born < life);
      ghosts.forEach((g, i) => {
        // Older exposures are dimmer, so the trail shows its direction.
        const age = Number.isFinite(life) ? 1 - (now - g.born) / life : 0.3 + (0.7 * (i + 1)) / ghosts.length;
        const k = gain * age * age;
        meshes.forEach((mesh) => mesh.setMatrixAt(i, g.matrix));
        meshes[0].setColorAt(i, tmp.copy(g.flip ? FLIP : FRAME).multiplyScalar(k * (g.flip ? 1.4 : 0.12)));
        meshes[1].setColorAt(i, tmp.copy(RED_C).multiplyScalar(k * (g.flip ? 0.9 : 0.26)));
        meshes[2].setColorAt(i, tmp.copy(WHITE_C).multiplyScalar(k * (g.flip ? 0.6 : 0.3)));
      });
      for (const mesh of meshes) {
        mesh.count = ghosts.length;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
