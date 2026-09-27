/**
 * Procedural tennis racket in its principal frame, in metres.
 *
 * Axes as in lab/lib/models/racket.js: x is the normal of the string bed
 * (largest inertia), y lies across the head (intermediate), z runs along the
 * handle (smallest). The origin is the centre of mass. The +x side is painted
 * red, the −x side white, so a half twist reads at a glance.
 */
import * as THREE from 'three/webgpu';
import { uv, fract, smoothstep, mix, color, float, uniform, vec3 } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowOutput, unlit } from './post.js';

export const RED = 0xf85149;
export const WHITE = 0xe6edf3;
const GRAPHITE = 0x15181d;

const HEAD = { cz: 0.2, ry: 0.128, rz: 0.163, rim: 0.0075, half: 0.0115 };
const BUTT = -0.32;
const GRIP_TOP = -0.115;
const THROAT_Z = -0.02;

/** Maps shape coordinates (x, y, extrusion z) onto body (y, z, x). */
const SHAPE_TO_BODY = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(1, 0, 0),
);

function ellipseRing(ry, rz, rim) {
  const shape = new THREE.Shape().absellipse(0, 0, ry + rim, rz + rim, 0, Math.PI * 2);
  shape.holes.push(new THREE.Path().absellipse(0, 0, ry - rim, rz - rim, 0, Math.PI * 2, true));
  return shape;
}

/** One half of the head frame: side = +1 builds the red half (x > 0), −1 the white half. */
function headHalf(side, bevel = 0.0035) {
  const depth = HEAD.half - bevel;
  const geometry = new THREE.ExtrudeGeometry(ellipseRing(HEAD.ry, HEAD.rz, HEAD.rim - bevel), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 96,
  });
  geometry.translate(0, 0, side > 0 ? bevel : -depth - bevel);
  return geometry.applyMatrix4(SHAPE_TO_BODY).translate(0, 0, HEAD.cz);
}

/** Thin glowing stripe along the outer edge of one face. */
function rimStripe(side) {
  const geometry = new THREE.ExtrudeGeometry(ellipseRing(HEAD.ry, HEAD.rz, HEAD.rim * 0.28), {
    depth: 0.0012,
    bevelEnabled: false,
    curveSegments: 96,
  });
  geometry.translate(0, 0, side > 0 ? HEAD.half + 0.0003 : -HEAD.half - 0.0015);
  return geometry.applyMatrix4(SHAPE_TO_BODY).translate(0, 0, HEAD.cz);
}

function throatArms() {
  return [-1, 1].map((s) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, s * 0.006, THROAT_Z),
      new THREE.Vector3(0, s * 0.045, 0.02),
      new THREE.Vector3(0, s * 0.092, HEAD.cz - HEAD.rz * 0.72),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.0085, 10, false).scale(1.35, 1, 1);
  });
}

function shaft() {
  return new THREE.CylinderGeometry(0.011, 0.0145, GRIP_TOP - THROAT_Z + 0.004, 8)
    .rotateX(Math.PI / 2)
    .translate(0, 0, (GRIP_TOP + THROAT_Z) / 2);
}

function grip() {
  // Octagonal, like a real handle; uv.x runs around, uv.y along.
  return new THREE.CylinderGeometry(0.0172, 0.0168, GRIP_TOP - BUTT, 8, 1)
    .rotateX(Math.PI / 2)
    .translate(0, 0, (GRIP_TOP + BUTT) / 2);
}

function buttCap() {
  return new THREE.CylinderGeometry(0.0192, 0.0185, 0.012, 8).rotateX(Math.PI / 2).translate(0, 0, BUTT - 0.004);
}

/** Overgrip wound as a helix: overlapping bands with a dark seam. */
function gripMaterial() {
  const turns = 11;
  const band = fract(uv().x.add(uv().y.mul(turns)));
  const seam = smoothstep(0.0, 0.06, band).mul(smoothstep(1.0, 0.9, band));
  const base = color(0xf2f4f7);
  const node = mix(color(0x6e7681), base, seam);
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.85 });
  material.colorNode = node;
  return material;
}

function strings(material) {
  const mains = 16;
  const crosses = 19;
  const geometry = new THREE.CylinderGeometry(0.00085, 0.00085, 1, 5);
  const mesh = new THREE.InstancedMesh(geometry, material, mains + crosses);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const alongZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const alongY = new THREE.Quaternion();
  const ry = HEAD.ry - HEAD.rim;
  const rz = HEAD.rz - HEAD.rim;
  let i = 0;
  for (let n = 0; n < mains; n++) {
    const u = -0.92 + (1.84 * n) / (mains - 1);
    const half = rz * Math.sqrt(1 - u * u);
    mesh.setMatrixAt(i++, m.compose(p.set((n % 2 ? 1 : -1) * 0.0004, u * ry, HEAD.cz), q.copy(alongZ), s.set(1, 2 * half, 1)));
  }
  for (let n = 0; n < crosses; n++) {
    const u = -0.93 + (1.86 * n) / (crosses - 1);
    const half = ry * Math.sqrt(1 - u * u);
    mesh.setMatrixAt(i++, m.compose(p.set((n % 2 ? -1 : 1) * 0.0004, 0, HEAD.cz + u * rz), q.copy(alongY), s.set(1, 2 * half, 1)));
  }
  return mesh;
}

/** A tinted film behind the strings on one side, so each face has one clear colour. */
function faceFilm(side) {
  const geometry = new THREE.CircleGeometry(1, 64)
    .rotateY((side * Math.PI) / 2)
    .scale(1, HEAD.ry - HEAD.rim, HEAD.rz - HEAD.rim)
    .translate(side * 0.0022, 0, HEAD.cz);
  return geometry;
}

/**
 * Builds the racket. Returns the group plus a `glow` uniform (0..∞) that
 * scales the emissive rim stripes, for the flip flash.
 */
export function createRacket() {
  const group = new THREE.Group();
  const glow = uniform(1);

  const lacquer = (hex) =>
    new THREE.MeshPhysicalNodeMaterial({ color: hex, roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 });
  const graphite = new THREE.MeshPhysicalNodeMaterial({ color: GRAPHITE, roughness: 0.35, metalness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 });

  const add = (geometry, material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  add(headHalf(1), lacquer(RED));
  add(headHalf(-1), lacquer(WHITE));
  add(mergeGeometries([...throatArms(), shaft()]), graphite);
  add(grip(), gripMaterial());
  add(buttCap(), graphite);

  for (const [side, hex, strength] of [[1, RED, 3.5], [-1, 0x79c0ff, 3]]) {
    const stripe = new THREE.MeshBasicNodeMaterial();
    stripe.colorNode = color(hex).mul(glow.mul(strength));
    stripe.mrtNode = glowOutput(stripe.colorNode);
    group.add(unlit(new THREE.Mesh(rimStripe(side), stripe)));

    const film = new THREE.MeshStandardNodeMaterial({
      color: side > 0 ? RED : WHITE,
      roughness: 0.6,
      transparent: true,
      opacity: side > 0 ? 0.55 : 0.45,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    film.emissiveNode = color(side > 0 ? RED : WHITE).mul(float(side > 0 ? 0.25 : 0.08));
    film.mrtNode = glowOutput(); // a fill so the face reads, not a light source
    group.add(unlit(new THREE.Mesh(faceFilm(side), film)));
  }

  const stringMaterial = new THREE.MeshStandardNodeMaterial({ color: 0xdfe7ef, roughness: 0.4 });
  const bed = strings(stringMaterial);
  bed.castShadow = true;
  group.add(bed);

  // Blue accent on the butt cap: the site's link colour, lit from inside.
  const cap = new THREE.MeshBasicNodeMaterial();
  cap.colorNode = vec3(0.35, 0.65, 1).mul(4);
  cap.mrtNode = glowOutput(cap.colorNode);
  group.add(unlit(new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0018, 6, 32).translate(0, 0, BUTT - 0.0105), cap)));

  return { group, glow };
}

/**
 * Low-detail silhouettes for the stroboscopic trail: frame, red face, white
 * face. Each face is single-sided, so a ghost shows the colour that faces the camera.
 */
export function ghostGeometries() {
  const frame = mergeGeometries([
    new THREE.ExtrudeGeometry(ellipseRing(HEAD.ry, HEAD.rz, HEAD.rim), { depth: 2 * HEAD.half, bevelEnabled: false, curveSegments: 48 })
      .translate(0, 0, -HEAD.half)
      .applyMatrix4(SHAPE_TO_BODY)
      .translate(0, 0, HEAD.cz),
    ...throatArms().map((g) => g.toNonIndexed()),
    shaft().toNonIndexed(),
    grip().toNonIndexed(),
  ]);
  return { frame, red: faceFilm(1), white: faceFilm(-1) };
}
