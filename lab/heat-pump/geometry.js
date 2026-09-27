/**
 * Geometry helpers: bevelled blocks, installer-bent tubes and a kit that
 * merges many small parts into one draw call per material.
 */
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { routeSegments } from './layout.js';

const v3 = (a) => new THREE.Vector3(...a);

/** A box between two corners with rounded edges. The bevel never exceeds a third of the thinnest side. */
export function block(min, max, bevel = 0.006) {
  const size = max.map((n, i) => n - min[i]);
  const radius = Math.min(bevel, Math.min(...size) / 3);
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius);
  geometry.translate(...size.map((s, i) => min[i] + s / 2));
  return geometry;
}

/**
 * A tube along a route: one ring pair per straight leg, eight per bend, so a
 * 60 m floor loop stays light. uv.x runs 0 → 1 along the flow.
 */
export function tube(route, radius = route.radius, radial = 12) {
  const segments = routeSegments(route);
  const curves = segments.map((s) => (s.type === 'line' ? new THREE.LineCurve3(v3(s.a), v3(s.b)) : new THREE.QuadraticBezierCurve3(v3(s.a), v3(s.control), v3(s.b))));
  const lengths = curves.map((c) => c.getLength());
  const total = lengths.reduce((a, b) => a + b, 0);
  let done = 0;
  const parts = curves.map((curve, i) => {
    const geometry = new THREE.TubeGeometry(curve, segments[i].type === 'line' ? 1 : 8, radius, radial, false);
    const uv = geometry.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (done + uv.getX(k) * lengths[i]) / total);
    done += lengths[i];
    return geometry;
  });
  return mergeGeometries(parts, false);
}

/** A cylinder between two points. */
export function rod(a, b, radius, radial = 16, radiusB = radius) {
  const from = v3(a);
  const to = v3(b);
  const geometry = new THREE.CylinderGeometry(radiusB, radius, from.distanceTo(to), radial, 1);
  geometry.translate(0, from.distanceTo(to) / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  geometry.applyQuaternion(q);
  geometry.translate(from.x, from.y, from.z);
  return geometry;
}

/** A lathe profile [[r, y], ...] turned about an axis through `at`, pointing along `axis`. */
export function turned(profile, at, axis = [0, 1, 0], radial = 32) {
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), radial);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(axis).normalize()));
  geometry.translate(...at);
  return geometry;
}

/** Moves and turns a geometry in place: `rotate` is Euler XYZ in radians. */
export function place(geometry, position = [0, 0, 0], rotate = [0, 0, 0]) {
  geometry.applyMatrix4(new THREE.Matrix4().compose(v3(position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotate)), new THREE.Vector3(1, 1, 1)));
  return geometry;
}

/**
 * Collects geometries per material and merges them. Every part keeps its own
 * shape; only the draw calls are shared.
 */
export class Kit {
  constructor() {
    this.parts = new Map();
  }

  add(material, ...geometries) {
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(...geometries);
    return this;
  }

  /** One mesh per material, added to `group`. */
  build(group = new THREE.Group(), { castShadow = true, receiveShadow = true } = {}) {
    for (const [material, geometries] of this.parts) {
      const clean = geometries.map((g) => {
        const flat = g.index ? g.toNonIndexed() : g;
        for (const name of Object.keys(flat.attributes)) if (!['position', 'normal', 'uv'].includes(name)) flat.deleteAttribute(name);
        if (!flat.attributes.uv) flat.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(flat.attributes.position.count * 2), 2));
        return flat;
      });
      const mesh = new THREE.Mesh(mergeGeometries(clean, false), material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}
