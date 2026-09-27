// An original racer: a flat, wide wedge with sharp chines and a needle nose. The engine pods
// are bulges of the one hull, not separate tubes; a faceted canopy set low into the spine, raked
// blade fins carrying a rear wing, three flat slot nozzles. Lofted from polygon sections.
// Every ship is an instance of the same meshes; team colour, thrust and race number are
// per-instance attributes of one paint material, so four ships cost one shader per part.
// Local frame: X right, Y up, -Z forward. Nose at z = -3.0, tail at z = 2.3; 5.3 m by 3.4 m.
import * as THREE from 'three/webgpu';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  paintMaterial, canopyMaterial, exhaustMaterial, plumeMaterial, shieldMaterial, spriteMaterial,
} from './materials.js';

const SEGS = 20;
export const TAIL = 2.3;
const POD_X = 1.25;
// Sections: [f (forward, m), half width, top, bottom] at centre (cx, cy). `e` = super-ellipse
// exponent (2 = ellipse, larger = boxier). Both ends are capped.
function loft(sections, { cx = 0, cy = 0, e = 2.4 } = {}) {
  const pos = [], index = [];
  for (const [f, w, top, bottom] of sections) {
    for (let j = 0; j < SEGS; j++) {
      const a = (j / SEGS) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      pos.push(cx + w * Math.sign(c) * Math.abs(c) ** (2 / e), cy + (s > 0 ? top : bottom) * Math.sign(s) * Math.abs(s) ** (2 / e), -f);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a = i * SEGS + j, b = i * SEGS + ((j + 1) % SEGS), c = a + SEGS, d = b + SEGS;
      index.push(a, c, b, b, c, d);
    }
  }
  for (const [end, flip] of [[0, false], [sections.length - 1, true]]) {
    const [f, , top, bottom] = sections[end];
    const centre = pos.length / 3;
    pos.push(cx, cy + (top - bottom) * 0.5, -f);
    for (let j = 0; j < SEGS; j++) {
      const a = end * SEGS + j, b = end * SEGS + ((j + 1) % SEGS);
      if (flip) index.push(centre, b, a); else index.push(centre, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// The body: one loft through polygon sections. Rows: [z, half span at the chine, spine top,
// pod x, pod top, chine y, keel]. Each section runs spine, shoulder, valley, pod crown, pod
// flank, chine, underside, keel on the right and mirrors to the left.
const BODY = [
  [-3.0, 0.04, 0.03, 0.03, 0.03, 0.0, -0.03],
  [-2.2, 0.5, 0.12, 0.3, 0.1, 0.0, -0.08],
  [-1.2, 1.1, 0.22, 0.78, 0.17, 0.0, -0.13],
  [-0.2, 1.58, 0.27, 1.08, 0.25, 0.0, -0.15],
  [0.9, 1.72, 0.26, 1.22, 0.29, -0.01, -0.15],
  [1.8, 1.62, 0.22, 1.25, 0.29, -0.02, -0.14],
  [TAIL, 1.46, 0.18, 1.25, 0.27, -0.02, -0.12],
];
function bodySection([z, w, top, podX, podTop, chineY, keel]) {
  const half = [
    [0, top], [podX * 0.25, top * 0.97], [podX * 0.6, top * 0.72], [podX, podTop],
    [podX + (w - podX) * 0.5, podTop * 0.55], [w, chineY], [w * 0.85, keel * 0.55], [podX * 0.7, keel], [0, keel],
  ];
  return mirrorHalf(half, z);
}
// A closed section from its right half (centre points first and last), mirrored to the left.
function mirrorHalf(half, z) {
  const left = half.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  return [...half, ...left].map(([x, y]) => [x, y, z]);
}
// Linear in z between the BODY rows: the spine's height, for parts that sit on it.
function spineTop(z) {
  const k = Math.max(1, BODY.findIndex((r) => r[0] >= z));
  const [z0, , t0] = BODY[k - 1], [z1, , t1] = BODY[k];
  return t0 + (t1 - t0) * Math.min(1, Math.max(0, (z - z0) / (z1 - z0)));
}

// A closed loft through rings of [x, y, z] points (same count per ring), capped at both ends.
function polyLoft(rings) {
  const n = rings[0].length;
  const pos = rings.flat(2), index = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * n + j, b = i * n + ((j + 1) % n), c = a + n, d = b + n;
      index.push(a, c, b, b, c, d);
    }
  }
  for (const [end, flip] of [[0, false], [rings.length - 1, true]]) {
    const r = rings[end], centre = pos.length / 3;
    pos.push(0, r.reduce((acc, q) => acc + q[1], 0) / n, r[0][2]);
    for (let j = 0; j < n; j++) {
      const a = end * n + j, b = end * n + ((j + 1) % n);
      if (flip) index.push(centre, b, a); else index.push(centre, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}
const body = () => polyLoft(BODY.map(bodySection));

// The canopy: a long, low faceted blister sunk into the spine, pointed at both ends. Rows:
// [z, half width, height above the spine]. Its base sits 3 cm inside the hull.
const CANOPY = [[-2.1, 0.03, 0.01], [-1.4, 0.2, 0.08], [-0.6, 0.27, 0.12], [0.1, 0.24, 0.11], [0.6, 0.16, 0.08], [0.9, 0.05, 0.05]];
// Behind it a painted dorsal fairing carries the line on to the tail, so the canopy reads as part
// of one spine, not a bubble on a slab.
const FAIRING = [[0.3, 0.05, 0.05], [0.7, 0.2, 0.1], [1.4, 0.18, 0.08], [2.1, 0.12, 0.04], [TAIL, 0.08, 0.02]];
function canopySection([z, w, rise]) {
  const base = spineTop(z) - 0.03, top = base + 0.03 + rise;
  const half = [[0, top], [w * 0.45, top - rise * 0.12], [w * 0.85, base + 0.03 + rise * 0.45], [w, base], [0, base - 0.02]];
  return mirrorHalf(half, z);
}
// The fairing is a sharp ridge: a triangle standing on the spine.
function ridgeSection([z, w, rise]) {
  const base = spineTop(z) - 0.03;
  return mirrorHalf([[0, base + 0.03 + rise], [w, base], [0, base - 0.02]], z);
}

const mirror = (g) => {
  const m = g.clone().scale(-1, 1, 1);
  const idx = m.index ? m.index.array : null;
  if (idx) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  else {
    const p = m.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      for (let a = 0; a < 3; a++) { const t = p.array[(i + 1) * 3 + a]; p.array[(i + 1) * 3 + a] = p.array[(i + 2) * 3 + a]; p.array[(i + 2) * 3 + a] = t; }
    }
  }
  m.computeVertexNormals();
  return m;
};
const pair = (g) => [g, mirror(g)];
const CREASE = 0.6; // rad: edges sharper than ~35° stay hard

// A part of the paint mesh: creased normals (smooth over the curves, sharp at the chines and plate
// edges) with the per-vertex masks `paint` and `hot`. A low `crease` keeps every facet flat.
// `paint` may be a function of (x, y, z) for parts that are half paint, half carbon.
function part(g, paint = 1, hot = 0, crease = CREASE) {
  const src = g.clone();
  for (const name of Object.keys(src.attributes)) if (name !== 'position') src.deleteAttribute(name);
  const flat = toCreasedNormals(src, crease);
  const p = flat.attributes.position, n = p.count;
  const pm = new Float32Array(n), hm = new Float32Array(n).fill(hot);
  for (let i = 0; i < n; i++) pm[i] = typeof paint === 'function' ? paint(p.getX(i), p.getY(i), p.getZ(i)) : paint;
  flat.setAttribute('paint', new THREE.BufferAttribute(pm, 1));
  flat.setAttribute('hot', new THREE.BufferAttribute(hm, 1));
  return flat;
}

// A flat plate in the (z, y) plane from a polygon of [z, y] points, `t` thick, at x.
function plate(points, t, x) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  // Extrude builds in (x, y) along +z; turn it so shape-x becomes z and the thickness runs along x.
  return new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(x + t / 2, 0, 0);
}

// Nozzles: x, y, half width, half height. Flat slots in a thin frame with a hot lip; the plume
// starts at the frame.
export const NOZZLES = [[0, 0.03, 0.4, 0.075], [POD_X, 0.08, 0.24, 0.11], [-POD_X, 0.08, 0.24, 0.11]];
// A four-sided tube along z, `hw` by `hh`, from a cylinder turned so its faces are flat.
const slot = (rTop, rBottom, len, hw, hh) => new THREE.CylinderGeometry(rTop * Math.SQRT2, rBottom * Math.SQRT2, len, 4, 1, true)
  .rotateY(Math.PI / 4).scale(hw, 1, hh).rotateX(-Math.PI / 2);

// Airbrake flaps: a hinge on each side of the spine, the plate trails behind it.
export const FLAP = { x: 0.68, y: 0.2, z: 1.25, span: 0.6, chord: 0.62, max: 1.05 };

export function shipGeometries() {
  // Painted on top, carbon underneath the chines.
  const underside = (x, y) => (y > -0.005 ? 1 : 0);
  // Intake slots: dark scoops on the pod crowns, just behind the leading edge.
  const scoop = loft([[0.95, 0.03, 0.01, 0.01], [0.75, 0.15, 0.06, 0.02], [0.3, 0.17, 0.07, 0.02], [0.2, 0.15, 0.01, 0.02]], { cx: POD_X * 0.93, cy: 0.2, e: 3 });
  // Fins: raked blades on the outer flanks of the pods, clear of the race number.
  const fin = plate([[0.8, 0.1], [2.3, 0.1], [2.6, 0.78], [2.25, 0.78]], 0.05, 1.5);
  // Nozzle frames: an outer shell (carbon) and an inner lip that glows with the thrust.
  const frame = (hw, hh, inner) => slot(1, 1.04, 0.16, hw, hh).translate(0, 0, TAIL + 0.05).scale(inner ? 0.9 : 1, inner ? 0.9 : 1, 1);
  const frames = [], lips = [];
  for (const [x, y, hw, hh] of NOZZLES) {
    frames.push(part(frame(hw, hh, false).translate(x, y, 0), 0));
    lips.push(part(mirror(frame(hw, hh, true)).translate(x, y, 0), 0, 1));
  }

  const paint = mergeGeometries([
    part(body(), underside), ...pair(scoop).map((g) => part(g, 0)), ...pair(fin).map((g) => part(g, 1)),
    part(polyLoft(FAIRING.map(ridgeSection)), 1, 0, 0.2), ...frames, ...lips,
  ]);

  const canopy = part(polyLoft(CANOPY.map(canopySection)), 0, 0, 0.2);

  // A flap: hinge at the origin, the plate trails toward +z.
  const flap = part(new THREE.BoxGeometry(FLAP.span, 0.035, FLAP.chord).translate(0, 0, FLAP.chord / 2), 1);

  const exhaust = mergeGeometries(NOZZLES.map(([x, y, hw, hh]) => new THREE.PlaneGeometry(2 * hw * 0.88, 2 * hh * 0.88).translate(x, y, TAIL + 0.12)));
  exhaust.deleteAttribute('normal');
  // Plumes: open tapered slots, 1 m long, starting at the nozzle plane; the matrix stretches them.
  const plume = mergeGeometries(NOZZLES.map(([x, y, hw, hh]) => slot(0.8, 0.1, 1, hw, hh).translate(x, y, 0.5)));
  const shield = new THREE.IcosahedronGeometry(3.3, 3).scale(0.85, 0.55, 1);
  shield.deleteAttribute('uv');
  const glow = new THREE.PlaneGeometry(1, 1);
  return { paint, canopy, flap, exhaust, plume, shield, glow };
}

// Race numbers as seven-segment codes (bits a..g).
const DIGIT = [63, 6, 91, 79, 102, 109, 125, 7, 127, 111];

/**
 * Instanced meshes for `count` ships. setShip(i, matrix, look, ground) poses one ship:
 * look = { thrust, shield, zap, plume (m), brakeL, brakeR, hover (m), boost }; `ground` is the
 * deck under the ship (X right, Y forward, Z up); look.near (0..1) dims the glowing parts of a
 * rival close to the camera. commit() uploads. Every ship but `player` fades near the camera.
 */
export function createShipMeshes(count, colors, numbers, player = 0) {
  const g = shipGeometries();
  const make = (geometry, material, name, n = count) => {
    const mesh = new THREE.InstancedMesh(geometry, material, n);
    mesh.name = name;
    mesh.frustumCulled = false;
    return mesh;
  };
  const tinted = (mesh) => {
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count * 3), 3);
    return mesh;
  };
  // Paint data per instance: the team colour and (thrust, zap, number, rival).
  const shipData = (geometry, n, perShip) => {
    const team = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const drive = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    for (let k = 0; k < n; k++) {
      const i = Math.floor(k / perShip);
      team.setXYZ(k, colors[i].r, colors[i].g, colors[i].b);
      drive.setXYZW(k, 0, 0, DIGIT[numbers[i] % 10], i === player ? 0 : 1);
    }
    geometry.setAttribute('team', team);
    geometry.setAttribute('drive', drive);
    return drive;
  };
  const paintMat = paintMaterial();
  const flapGeometry = g.flap;
  const drive = shipData(g.paint, count, 1);
  const flapDrive = shipData(flapGeometry, count * 2, 2);
  shipData(g.canopy, count, 1);
  const paint = make(g.paint, paintMat, 'ship-paint');
  const flaps = make(flapGeometry, paintMat, 'ship-flaps', count * 2);
  const canopy = make(g.canopy, canopyMaterial(), 'ship-canopy');
  const exhaust = tinted(make(g.exhaust, exhaustMaterial(), 'ship-exhaust'));
  const plume = tinted(make(g.plume, plumeMaterial(), 'ship-plume'));
  const shield = tinted(make(g.shield, shieldMaterial(), 'ship-shield'));
  const glow = tinted(make(g.glow, spriteMaterial(), 'ship-hover-glow'));
  // Ships cast and receive: receiving puts the shadow into their own shaders, so the shadow pass
  // runs (and compiles) while the loader draws them alone.
  for (const m of [paint, flaps, canopy]) m.castShadow = m.receiveShadow = true;
  glow.renderOrder = 1;
  plume.renderOrder = 3;
  shield.renderOrder = 3;
  const group = new THREE.Group();
  group.name = 'ships';
  group.add(glow, paint, flaps, canopy, exhaust, plume, shield);

  const white = new THREE.Color(1, 1, 1), blue = new THREE.Color(0.75, 0.88, 1.5);
  const c = new THREE.Color(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const m = new THREE.Matrix4(), hinge = new THREE.Matrix4(), rot = new THREE.Matrix4(), stretch = new THREE.Matrix4();

  return {
    group,
    meshes: { paint, flaps, canopy, exhaust, plume, shield, glow },
    setShip(i, matrix, look, ground) {
      paint.setMatrixAt(i, matrix);
      canopy.setMatrixAt(i, matrix);
      exhaust.setMatrixAt(i, matrix);
      drive.setX(i, look.thrust);
      drive.setY(i, look.zap);
      for (const [k, side, amount] of [[0, -1, look.brakeL], [1, 1, look.brakeR]]) {
        hinge.makeTranslation(side * FLAP.x, FLAP.y, FLAP.z);
        rot.makeRotationX(-FLAP.max * amount);
        flaps.setMatrixAt(i * 2 + k, m.multiplyMatrices(matrix, hinge).multiply(rot));
        flapDrive.setY(i * 2 + k, look.zap);
      }
      // Exhaust: a white-blue core with a hint of team colour, hotter with the thrust; the short
      // plume grows with it and fades to nothing within about a ship length.
      const near = look.near ?? 1;
      c.copy(blue).lerp(colors[i], 0.2).multiplyScalar((0.3 + 1.6 * look.thrust + look.boost) * near);
      exhaust.setColorAt(i, c);
      if (look.plume > 0.05) {
        stretch.makeTranslation(0, 0, TAIL + 0.2).multiply(rot.makeScale(1 + 0.2 * look.boost, 1 + 0.2 * look.boost, look.plume));
        plume.setMatrixAt(i, m.multiplyMatrices(matrix, stretch));
        plume.setColorAt(i, c.copy(blue).lerp(colors[i], 0.15).multiplyScalar((0.15 + 0.55 * look.thrust + 0.5 * look.boost) * near));
      } else {
        plume.setMatrixAt(i, zero);
      }
      // Hover glow: an ellipse on the deck, fading as the ship climbs.
      const fade = Math.max(0, 1 - (look.hover - 0.8) / 2.5);
      glow.setMatrixAt(i, m.copy(ground).multiply(rot.makeScale(4.2, 6.5, 1)));
      glow.setColorAt(i, c.copy(colors[i]).lerp(white, 0.4).multiplyScalar(0.35 * fade * near * (0.6 + 0.6 * look.thrust)));
      if (look.shield > 0) {
        shield.setMatrixAt(i, matrix);
        shield.setColorAt(i, c.copy(colors[i]).lerp(white, 0.5).multiplyScalar((0.6 + 0.6 * look.shield) * near));
      } else {
        shield.setMatrixAt(i, zero);
      }
    },
    commit() {
      for (const mesh of [paint, flaps, canopy, exhaust, plume, shield, glow]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      drive.needsUpdate = flapDrive.needsUpdate = true;
    },
  };
}
