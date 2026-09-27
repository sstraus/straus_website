// Effects, all instanced: one additive particle pool (sparks, explosions, exhaust trails, speed
// lines, dust, far trails), expanding rings (shockwaves, mine pulses), tumbling debris, the bolts
// in flight and the mines on the deck. Five draw calls in total. Pools keep a fixed count: a dead
// slot has a zero-scale matrix, so nothing ever rebuilds.
import * as THREE from 'three/webgpu';
import { spriteMaterial, glowSolidMaterial, ringMaterial, structureMaterial } from './materials.js';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function pool(geometry, material, count, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, ZERO);
  mesh.renderOrder = 4;
  return mesh;
}

export function createEffects({ particles = 1600, bolts = 12, mines = 24, rings = 16, debris = 64 } = {}) {
  const sprites = pool(new THREE.PlaneGeometry(1, 1), spriteMaterial(), particles, 'particles');
  const solid = glowSolidMaterial();
  const boltMesh = pool(new THREE.OctahedronGeometry(1, 0).scale(0.32, 0.32, 2.6), solid, bolts, 'bolts');
  const mineMesh = pool(new THREE.IcosahedronGeometry(0.9, 1), solid, mines, 'mines');
  const ringMesh = pool(new THREE.PlaneGeometry(2, 2), ringMaterial(), rings, 'rings');
  const debrisMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), structureMaterial(), debris);
  debrisMesh.name = 'debris';
  debrisMesh.frustumCulled = false;
  for (let i = 0; i < debris; i++) debrisMesh.setMatrixAt(i, ZERO);
  const group = new THREE.Group();
  group.name = 'effects';
  group.add(sprites, boltMesh, mineMesh, ringMesh, debrisMesh);

  // Particle state, structure of arrays. A particle is a camera-facing quad; with `stretch` it is
  // drawn as a streak along its velocity, with `axis` as a streak of length `len` along that axis.
  const P = {
    pos: new Float32Array(particles * 3), vel: new Float32Array(particles * 3), axis: new Float32Array(particles * 3),
    col: new Float32Array(particles * 3), age: new Float32Array(particles), life: new Float32Array(particles),
    size: new Float32Array(particles), stretch: new Float32Array(particles), len: new Float32Array(particles),
    drag: new Float32Array(particles),
  };
  let next = 0;

  function spawn({ pos, vel = null, color, life = 0.5, size = 0.5, stretch = 0, axis = null, len = 0, drag = 0 }) {
    const i = next;
    next = (next + 1) % particles;
    for (let a = 0; a < 3; a++) {
      P.pos[i * 3 + a] = pos[a];
      P.vel[i * 3 + a] = vel ? vel[a] : 0;
      P.axis[i * 3 + a] = axis ? axis[a] : 0;
      P.col[i * 3 + a] = color[a];
    }
    P.age[i] = 0;
    P.life[i] = life;
    P.size[i] = size;
    P.stretch[i] = stretch;
    P.len[i] = axis ? len : 0;
    P.drag[i] = drag;
  }

  // A spherical burst: `n` particles from `pos`, carried by `base` velocity.
  const rnd = () => Math.random() * 2 - 1;
  function burst(pos, base, { n = 30, speed = 20, color, life = 0.6, size = 0.6, stretch = 0.03, drag = 2.5 }) {
    for (let k = 0; k < n; k++) {
      let x = rnd(), y = rnd(), z = rnd();
      const l = Math.hypot(x, y, z) || 1;
      const v = speed * (0.4 + 0.6 * Math.random()) / l;
      x *= v; y *= v; z *= v;
      spawn({
        pos, vel: [base[0] + x, base[1] + y, base[2] + z], color,
        life: life * (0.6 + 0.4 * Math.random()), size: size * (0.6 + 0.8 * Math.random()), stretch, drag,
      });
    }
  }

  const m = new THREE.Matrix4(), c = new THREE.Color();
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), V = new THREE.Vector3();
  const camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
  const camPrev = new THREE.Vector3(), camVel = new THREE.Vector3();

  function update(dt, camera) {
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const cp = camera.position;
    // Streaks stretch with the velocity seen from the camera (motion blur), not in the world: a
    // spark carried at the ship's 110 m/s is almost still on screen.
    if (dt > 0) camVel.subVectors(cp, camPrev).divideScalar(dt);
    if (camVel.lengthSq() > 250000) camVel.set(0, 0, 0);   // a jump or a cut, not motion
    camPrev.copy(cp);
    for (let i = 0; i < particles; i++) {
      if (P.age[i] >= P.life[i]) { sprites.setMatrixAt(i, ZERO); continue; }
      P.age[i] += dt;
      const k = Math.exp(-P.drag[i] * dt);
      for (let a = 0; a < 3; a++) {
        P.vel[i * 3 + a] *= k;
        P.pos[i * 3 + a] += P.vel[i * 3 + a] * dt;
      }
      const t = Math.min(1, P.age[i] / P.life[i]);
      const fade = (1 - t) * (1 - t);
      const px = P.pos[i * 3], py = P.pos[i * 3 + 1], pz = P.pos[i * 3 + 2];
      const s = P.size[i];
      let long = 0;
      if (P.len[i] > 0) {
        V.set(P.axis[i * 3], P.axis[i * 3 + 1], P.axis[i * 3 + 2]);
        long = P.len[i];
      } else if (P.stretch[i] > 0) {
        V.set(P.vel[i * 3], P.vel[i * 3 + 1], P.vel[i * 3 + 2]).sub(camVel);
        long = s + V.length() * P.stretch[i];
      }
      Z.set(cp.x - px, cp.y - py, cp.z - pz).normalize();
      if (long > 0) {
        V.addScaledVector(Z, -V.dot(Z));                // the axis as seen on screen
        const l = V.length();
        if (l < 1e-4) { X.copy(camRight).multiplyScalar(s); Y.copy(camUp).multiplyScalar(s); } else {
          Y.copy(V).multiplyScalar(long / l);
          X.crossVectors(Y, Z).normalize().multiplyScalar(s);
        }
      } else {
        X.copy(camRight).multiplyScalar(s);
        Y.copy(camUp).multiplyScalar(s);
      }
      m.makeBasis(X, Y, Z).setPosition(px, py, pz);
      sprites.setMatrixAt(i, m);
      sprites.setColorAt(i, c.setRGB(P.col[i * 3] * fade, P.col[i * 3 + 1] * fade, P.col[i * 3 + 2] * fade));
    }
    sprites.instanceMatrix.needsUpdate = true;
    sprites.instanceColor.needsUpdate = true;
    updateRings(dt);
  }

  // Rings: a flat ring that grows from r0 to r1 over its life, in the plane given by (a, b) or
  // facing the camera when no plane is given, carried along at `vel` (the ship it came from).
  const R = Array.from({ length: rings }, () => ({ age: 1, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), r0: 0, r1: 0, color: [0, 0, 0], facing: false }));
  let nextRing = 0;
  function ring({ pos, vel = null, a = null, b = null, r0 = 0.5, r1 = 12, life = 0.5, color }) {
    const r = R[nextRing];
    nextRing = (nextRing + 1) % rings;
    r.p.fromArray(pos);
    if (vel) r.v.fromArray(vel); else r.v.set(0, 0, 0);
    r.facing = !a;
    if (a) { r.a.fromArray(a); r.b.fromArray(b); }
    Object.assign(r, { age: 0, life, r0, r1, color });
  }

  // Debris: dark shards that tumble away and shrink.
  const D = Array.from({ length: debris }, () => ({ age: 1, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), spin: 0, size: 0 }));
  let nextDebris = 0;
  function shards(pos, base, { n = 12, speed = 18, size = 0.25, life = 1.4 } = {}) {
    for (let k = 0; k < n; k++) {
      const d = D[nextDebris];
      nextDebris = (nextDebris + 1) % debris;
      d.p.fromArray(pos);
      d.v.set(rnd(), rnd(), rnd()).setLength(speed * (0.3 + 0.7 * Math.random())).add(V.fromArray(base));
      d.axis.set(rnd(), rnd(), rnd()).normalize();
      Object.assign(d, { age: 0, life: life * (0.6 + 0.4 * Math.random()), spin: 6 + 14 * Math.random(), size: size * (0.5 + Math.random()) });
    }
  }

  const q = new THREE.Quaternion(), S = new THREE.Vector3();
  function updateRings(dt) {
    for (let i = 0; i < rings; i++) {
      const r = R[i];
      if (r.age >= r.life) { ringMesh.setMatrixAt(i, ZERO); continue; }
      r.age += dt;
      r.p.addScaledVector(r.v, dt);
      const t = Math.min(1, r.age / r.life);
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - t) ** 3);
      if (r.facing) { X.copy(camRight); Y.copy(camUp); } else { X.copy(r.a); Y.copy(r.b); }
      Z.crossVectors(X, Y);
      m.makeBasis(X.multiplyScalar(rad), Y.multiplyScalar(rad), Z).setPosition(r.p);
      ringMesh.setMatrixAt(i, m);
      const k = (1 - t) ** 1.5;
      ringMesh.setColorAt(i, c.setRGB(r.color[0] * k, r.color[1] * k, r.color[2] * k));
    }
    ringMesh.instanceMatrix.needsUpdate = true;
    ringMesh.instanceColor.needsUpdate = true;
    for (let i = 0; i < debris; i++) {
      const d = D[i];
      if (d.age >= d.life) { debrisMesh.setMatrixAt(i, ZERO); continue; }
      d.age += dt;
      d.v.multiplyScalar(Math.exp(-0.8 * dt));
      d.p.addScaledVector(d.v, dt);
      q.setFromAxisAngle(d.axis, d.spin * d.age);
      debrisMesh.setMatrixAt(i, m.compose(d.p, q, S.setScalar(d.size * (1 - (d.age / d.life) ** 2))));
    }
    debrisMesh.instanceMatrix.needsUpdate = true;
  }

  // Bolts and mines are posed by the caller each frame: set(i, matrix, color) for live ones,
  // then finish(n) clears the rest.
  const posed = (mesh) => ({
    set(i, matrix, color) { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color); },
    finish(n) {
      for (let i = n; i < mesh.count; i++) mesh.setMatrixAt(i, ZERO);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    },
    capacity: mesh.count,
  });

  return { group, spawn, burst, ring, shards, update, bolts: posed(boltMesh), mines: posed(mineMesh) };
}
