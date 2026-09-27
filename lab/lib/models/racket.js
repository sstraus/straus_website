/**
 * Tennis racket: physical data and a procedural model in its principal frame.
 *
 * Axes follow Mardešić et al., PRL 125, 064301 (2020): z along the handle
 * (smallest I), y in the plane of the head (intermediate I), x perpendicular to
 * the head (largest I). Supplemental Table 1 gives a = Iy/Iz − 1 = 12.54 and
 * b = 1 − Iy/Ix = 0.06. Iz is normalised to 1; only ratios matter for free rotation.
 * The model is 1.6 units long with the origin at the centre of mass.
 */
import * as THREE from 'three/webgpu';

const A = 12.54;
const B = 0.06;

export const racket = {
  a: A,
  b: B,
  inertia: [(1 + A) / (1 - B), 1 + A, 1], // [Ix, Iy, Iz]
  handleEnd: [0, 0, -0.75],
};

const HEAD_CENTER = 0.49;
const HEAD_RY = 0.28;
const HEAD_RZ = 0.36;

/** Builds the mesh. The two string beds have different colours so the twist is visible. */
export function createRacketModel({ frameColor = 0x2f81f7, faceColors = [0xf85149, 0xe6edf3] } = {}) {
  const model = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.45, metalness: 0.2 });

  // Head ring in the y–z plane (its normal is body x).
  const ring = new THREE.TorusGeometry(1, 0.09, 12, 72)
    .rotateY(Math.PI / 2)
    .scale(0.35, HEAD_RY, HEAD_RZ)
    .translate(0, 0, HEAD_CENTER);
  model.add(new THREE.Mesh(ring, frame));

  faceColors.forEach((color, i) => {
    const sign = i === 0 ? 1 : -1; // first face looks along +x
    const geometry = new THREE.CircleGeometry(1, 48)
      .rotateY((sign * Math.PI) / 2)
      .scale(1, HEAD_RY * 0.97, HEAD_RZ * 0.97)
      .translate(sign * 0.004, 0, HEAD_CENTER);
    model.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true, opacity: 0.85 })));
  });

  const strings = [];
  for (let s = -0.9; s <= 0.9001; s += 0.15) {
    const half = Math.sqrt(1 - s * s);
    strings.push(0, s * HEAD_RY, HEAD_CENTER - half * HEAD_RZ, 0, s * HEAD_RY, HEAD_CENTER + half * HEAD_RZ);
    strings.push(0, -half * HEAD_RY, HEAD_CENTER + s * HEAD_RZ, 0, half * HEAD_RY, HEAD_CENTER + s * HEAD_RZ);
  }
  const stringGeometry = new THREE.BufferGeometry();
  stringGeometry.setAttribute('position', new THREE.Float32BufferAttribute(strings, 3));
  model.add(new THREE.LineSegments(stringGeometry, new THREE.LineBasicMaterial({ color: 0x30363d })));

  const grip = new THREE.CylinderGeometry(0.042, 0.038, 0.5, 16).rotateX(Math.PI / 2).translate(0, 0, -0.5);
  model.add(new THREE.Mesh(grip, new THREE.MeshStandardMaterial({ color: 0xe6edf3, roughness: 0.9 })));

  // Throat: two beams from the top of the grip to where they meet the head ring.
  const throatStart = new THREE.Vector3(0, 0, -0.25);
  for (const side of [-1, 1]) {
    const end = new THREE.Vector3(0, side * 0.17, 0.205);
    const dir = end.clone().sub(throatStart);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, dir.length(), 10), frame);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    beam.position.copy(throatStart).addScaledVector(dir, 0.5);
    model.add(beam);
  }
  return model;
}
