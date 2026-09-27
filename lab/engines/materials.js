// Product-render materials for both machines, the section treatment of the cut housings, and the
// small geometry helpers they share. Units: metres.
import * as THREE from 'three/webgpu';
import {
  color, float, vec3, vec4, uniform, mix, abs, sin, select, smoothstep, fwidth, fract, mrt, uv,
  positionWorld, positionLocal, frontFacing, normalView, cameraViewMatrix, materialColor,
  materialRoughness, materialMetalness, mx_noise_float,
} from 'three/tsl';

export const PALETTE = {
  blue: new THREE.Color(0x58a6ff),
  orange: new THREE.Color(0xffa657),
  cut: new THREE.Color(0xb8382b), // section faces are painted red, as on a museum cutaway
};

/** For additive or unlit helpers that must not bloom. */
export const noGlow = () => mrt({ emissive: vec4(0, 0, 0, 1) });

export function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

const standard = (hex, roughness, metalness, extra = {}) =>
  new THREE.MeshStandardNodeMaterial({ color: hex, roughness, metalness, ...extra });
const physical = (hex, roughness, metalness, extra = {}) =>
  new THREE.MeshPhysicalNodeMaterial({ color: hex, roughness, metalness, ...extra });

/** Metal with a fine grain in colour and roughness, so large faces never look like plastic. */
function grained(material, scale, colourAmount, roughAmount, position = positionWorld) {
  const n = mx_noise_float(position.mul(scale));
  material.colorNode = materialColor.mul(n.mul(colourAmount).add(1));
  material.roughnessNode = materialRoughness.add(n.mul(roughAmount));
  return material;
}

/**
 * Machined surface: fine tool marks across one axis, in world space for fixed parts and in local
 * space for moving ones (world-space marks would slide over a turning crank).
 */
function machined(material, axis, pitch, roughAmount, position = positionWorld) {
  const marks = mx_noise_float(vec3(position[axis].mul(1 / pitch), position.x.mul(3), 0)).mul(0.5).add(0.5);
  material.roughnessNode = materialRoughness.add(marks.mul(roughAmount));
  material.colorNode = materialColor.mul(marks.mul(0.06).add(0.97));
  return material;
}

export function createMaterials(environment) {
  const hero = (material, intensity) => {
    material.envMap = environment;
    material.envMapIntensity = intensity;
    return material;
  };

  // Engine castings and running gear.
  const aluminium = grained(standard(0xb4b9c1, 0.42, 1), 60, 0.06, 0.1); // sand-cast block and head
  const aluminiumDark = grained(standard(0x7d838c, 0.5, 1), 60, 0.06, 0.1);
  const castIron = grained(standard(0x4f5359, 0.62, 0.9), 140, 0.1, 0.12);
  // Moving parts take their detail in local space, so it turns with them.
  const forged = grained(hero(standard(0x8a9098, 0.3, 1), 1.5), 90, 0.08, 0.12, positionLocal); // shot-peened steel
  const polished = hero(physical(0xe3e7ec, 0.07, 1), 1.8);
  const ground = machined(hero(physical(0xe6e9ee, 0.06, 1), 2), 'x', 0.0004, 0.1, positionLocal); // ground journals, round the crank axis
  const bore = machined(hero(standard(0xa7adb5, 0.18, 1), 1.4), 'y', 0.0008, 0.12);
  const pistonAlloy = machined(hero(standard(0xc9cdd3, 0.22, 1), 1.6), 'y', 0.0006, 0.16, positionLocal); // turned skirt
  const springSteel = hero(standard(0x3c4450, 0.3, 1), 1.2);
  const cam = hero(physical(0xc9ced4, 0.12, 1), 1.6);
  const gasket = standard(0x2a2e34, 0.55, 0.3);
  const rubber = standard(0x121316, 0.82, 0);
  const plastic = physical(0x15171b, 0.42, 0, { clearcoat: 0.35, clearcoatRoughness: 0.3 });
  const ceramic = physical(0xeae7df, 0.3, 0, { clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const nickel = hero(standard(0xdfe3e8, 0.16, 1), 1.5);
  const brass = hero(standard(0xd4a254, 0.24, 1), 1.2);

  // Timing belt: black rubber with teeth that scroll with the belt.
  const beltTravel = uniform(0);
  const belt = standard(0x16171a, 0.72, 0);
  const tooth = smoothstep(0.35, 0.5, abs(fract(uv().x.mul(1 / 0.0095).sub(beltTravel)).sub(0.5))); // uv.x: metres along the belt
  belt.colorNode = mix(color(0x0d0e10), color(0x202226), tooth);

  // Motor.
  const housing = grained(standard(0xa9b0b9, 0.34, 1), 80, 0.05, 0.08);
  const lamination = laminated(0x4b5058, 0x2b2f35, 0.0016); // electrical steel stack, x is the motor axis
  const rotorCore = laminated(0x3d4148, 0x24272c, 0.0016);
  const magnet = hero(physical(0xd9dde2, 0.15, 1, { clearcoat: 0.4, clearcoatRoughness: 0.08 }), 1.6); // nickel-plated NdFeB
  const copper = hero(standard(0xd08a55, 0.18, 1), 1.4); // bare busbars
  const hvCable = physical(0xff7a1a, 0.45, 0, { clearcoat: 0.3, clearcoatRoughness: 0.35 });
  const powder = grained(standard(0x262b33, 0.6, 0.25), 300, 0.05, 0.08);
  const paintRed = physical(0xc0392b, 0.4, 0, { clearcoat: 0.6 });
  const paintBlue = physical(0x2f6fd0, 0.4, 0, { clearcoat: 0.6 });

  // Studio.
  const plinth = grained(standard(0x1b2029, 0.36, 0.85), 30, 0.05, 0.08);
  const floor = standard(0x0d1219, 0.88, 0);
  const strip = standard(0x000000, 0.4, 0);
  strip.emissiveNode = color(PALETTE.blue).mul(0.12);

  return {
    aluminium, aluminiumDark, castIron, forged, polished, ground, bore, pistonAlloy, springSteel, cam, gasket,
    rubber, plastic, ceramic, nickel, brass, belt, beltTravel, housing, lamination, rotorCore, magnet,
    copper, hvCable, powder, paintRed, paintBlue, plinth, floor, strip,
  };
}

/** Stacked sheets across the x axis, antialiased so the stripes never shimmer. */
function laminated(hexA, hexB, pitch) {
  const material = standard(hexA, 0.4, 1);
  const u = positionLocal.x.mul(1 / pitch);
  const w = fwidth(u).max(0.001);
  const tri = abs(fract(u).sub(0.5)).mul(2); // 0 in the middle of a sheet, 1 at the joint
  const joint = smoothstep(float(0.8).sub(w.mul(2)), float(1), tri);
  const line = mix(joint, float(0.25), smoothstep(0.3, 0.8, w)); // too fine to resolve: average it
  material.colorNode = mix(color(hexA), color(hexB), line.mul(0.8));
  material.roughnessNode = mix(float(0.32), float(0.62), line);
  return material;
}

/**
 * Enamelled copper, wound in turns: glossy coat, grooves between the turns along `axis` of the
 * local frame, and an emissive glow that follows `current` (−1..1): warm for one sign, cool for the other.
 */
export function windingMaterial(current, level, environment, axis = 'z', pitch = 0.0012) {
  const material = new THREE.MeshPhysicalNodeMaterial({ color: 0xb8622e, metalness: 1, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06 });
  material.envMap = environment;
  material.envMapIntensity = 1.3;
  const groove = sin(positionLocal[axis].mul((Math.PI * 2) / pitch)).mul(0.5).add(0.5);
  material.colorNode = color(0xb8622e).mul(groove.mul(0.35).add(0.65));
  material.roughnessNode = float(0.2).add(groove.oneMinus().mul(0.2));
  const tint = mix(color(0x4f8dff), color(0xff5a2a), current.mul(0.5).add(0.5));
  material.emissiveNode = tint.mul(abs(current).mul(level).mul(1.6));
  return material;
}

/**
 * The same material, with its cut faces closed. A clipped solid shows its own back faces through the
 * opening; those are drawn flat, painted and lit with the normal of the nearest cut plane, so the
 * opening reads as a solid section. `planes` are THREE.Plane objects in world space; they can move.
 */
export function sectioned(base, planes) {
  const material = base.clone();
  material.side = THREE.DoubleSide;
  material.shadowSide = THREE.DoubleSide;
  const normals = planes.map((p) => uniform(p.normal));
  const constants = planes.map((p) => uniform(0).onRenderUpdate(() => p.constant));
  let nearest = normals[0];
  if (planes.length === 2) {
    const d0 = abs(normals[0].dot(positionWorld).add(constants[0]));
    const d1 = abs(normals[1].dot(positionWorld).add(constants[1]));
    nearest = select(d0.lessThan(d1), normals[0], normals[1]);
  }
  // The face points out of the solid, into the removed part: against the plane normal.
  const cutNormal = cameraViewMatrix.mul(vec4(nearest.negate(), 0)).xyz.normalize();
  material.colorNode = select(frontFacing, base.colorNode ?? materialColor, color(PALETTE.cut));
  material.roughnessNode = select(frontFacing, base.roughnessNode ?? materialRoughness, float(0.55));
  material.metalnessNode = select(frontFacing, base.metalnessNode ?? materialMetalness, float(0.05));
  material.normalNode = select(frontFacing, normalView, cutNormal);
  return material;
}

// ---------- geometry helpers ----------

/** Extrude a shape by `depth` along local z, centred on z = 0 unless `from` is given. */
export function extrude(shape, depth, { bevel = 0, curveSegments = 24, from = -depth / 2 } = {}) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel, curveSegments, bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2,
  });
  geometry.translate(0, 0, from + bevel);
  return geometry;
}

export function circlePath(x, y, r, clockwise = false) {
  const path = new THREE.Path();
  path.absarc(x, y, r, 0, Math.PI * 2, clockwise);
  return path;
}

export function roundedRect(target, x0, y0, x1, y1, r) {
  target.moveTo(x0 + r, y0);
  target.lineTo(x1 - r, y0);
  target.quadraticCurveTo(x1, y0, x1, y0 + r);
  target.lineTo(x1, y1 - r);
  target.quadraticCurveTo(x1, y1, x1 - r, y1);
  target.lineTo(x0 + r, y1);
  target.quadraticCurveTo(x0, y1, x0, y1 - r);
  target.lineTo(x0, y0 + r);
  target.quadraticCurveTo(x0, y0, x0 + r, y0);
  return target;
}

/** A cylinder along x. */
export function cylinderX(radius, length, segments = 40, radiusTop = radius) {
  const g = new THREE.CylinderGeometry(radiusTop, radius, length, segments);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** A tube (ring) along x: inner and outer radius, closed ends. */
export function ringX(rIn, rOut, length, segments = 48) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  shape.holes.push(circlePath(0, 0, rIn, true));
  const g = extrude(shape, length, { curveSegments: segments });
  g.rotateY(Math.PI / 2);
  return g;
}

/** Lathe profile [r, y] pairs around y. */
export function lathe(points, segments = 40) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

export class Helix extends THREE.Curve {
  constructor(radius, height, turns) {
    super();
    Object.assign(this, { radius, height, turns });
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.radius, t * this.height, Math.sin(a) * this.radius);
  }
}

/** Invisible simple volume for the raycaster, on layer 1 so it is never drawn. */
export function pickVolume(geometry, part) {
  const volume = new THREE.Mesh(geometry, new THREE.MeshBasicNodeMaterial());
  volume.layers.set(1);
  volume.userData.part = part;
  return volume;
}
