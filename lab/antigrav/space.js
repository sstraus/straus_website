// Space around the circuit, in layers so that the scale and the speed read through parallax.
//  - Far: baked once into a cube map (Milky Way with dust lanes, three nebulae, faint galaxies,
//    the planet with its rings, a moon, a gas giant). Only the sun is live.
//  - Mid: star points on three shells at 1.8, 3.4 and 6 km, which slide against each other and
//    against the baked layer when the camera climbs, drops or flies across the circuit.
//  - Near: rocks and ice drifting 40 to 500 m from the deck, a shipyard 2.6 km out with blinking
//    beacons, another circuit hanging 3 km away with ships' light trails, far traffic, meteors.
// Light: a sun flare with ghosts, god rays when the sun sits on an edge of the station, the
// ring or the deck, and a blue rim light from the planet. Everything is instanced; the heavy
// maths runs once in the bake.
import * as THREE from 'three/webgpu';
import {
  uniform, vec3, float, mix, smoothstep, step, abs, max, pow, exp, sqrt, dot, normalize, length, sin,
  mx_noise_float, mx_fractal_noise_float, mx_worley_noise_float, positionWorld, cameraPosition, cubeTexture,
  instancedBufferAttribute, instanceColor, uv, atan,
} from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  glowOutput, U, SUN, PLANET, structureMaterial, hullMaterial, neonMaterial, spriteMaterial,
} from './materials.js';

const hex = (v) => uniform(new THREE.Color(v));
const unit = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// Far set pieces: directions and angular radii (rad).
const RINGS = { normal: unit(0.18, 1, 0.32), inner: 1.3, outer: 2.25 };     // in planet radii
const MOON = { dir: unit(-0.55, -0.12, -0.83), radius: 2.4 * Math.PI / 180 };
// The gas giant sits about 73° from the sun, so it shows a thick crescent with a terminator.
const GIANT = { dir: unit(0.45, 0.2, 0.87), radius: 8 * Math.PI / 180, axis: unit(0.25, 1, 0.1) };
const GALAXY_NORMAL = unit(0.3, 0.8, 0.52);
const NEBULAE = [
  { dir: unit(-0.2, 0.55, 0.81), size: 0.3, color: [0.55, 0.12, 0.45] },
  { dir: unit(0.7, 0.62, 0.35), size: 0.22, color: [0.08, 0.35, 0.45] },
  { dir: unit(-0.9, 0.35, -0.25), size: 0.26, color: [0.5, 0.22, 0.06] },
];
const GALAXIES = [unit(0.1, 0.95, -0.3), unit(-0.6, 0.7, 0.4), unit(0.9, 0.2, 0.4), unit(-0.3, 0.3, -0.9), unit(0.5, 0.8, 0.3)];

// A disc of angular radius `radius` around `dir`: returns { inside, n } with the sphere normal.
function sphereHit(dir, centre, radius) {
  const R = Math.sin(radius), cosA = Math.cos(radius);
  const b = dot(dir, centre);
  const t = b.sub(sqrt(max(b.mul(b).sub(1 - R * R), 0)));
  const n = normalize(dir.mul(t).sub(centre).div(R));
  return { inside: smoothstep(cosA - 0.0003, cosA + 0.0003, b), n, b, t, cosA };
}

// Sun disc, glare and corona in direction `dir`, HDR.
function sunLight(dir) {
  const sd = max(dot(dir, U.sun), 0);
  const disc = smoothstep(0.99985, 0.99993, sd).mul(20);
  const corona = pow(sd, 900).mul(2.5).add(pow(sd, 120).mul(0.15)).add(pow(sd, 18).mul(0.025));
  return vec3(1, 0.93, 0.82).mul(disc.add(corona));
}

/** The far layer, analytic, for the one-time bake. */
function skyBakeMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false });
  m.fog = false;
  const dir = normalize(positionWorld.sub(cameraPosition));
  const sun = U.sun;

  // Dust stars: one candidate per Worley cell, most switched off. The bright ones are sprites.
  const w = mx_worley_noise_float(dir.mul(210));
  const on = step(0.66, mx_noise_float(dir.mul(210).floor().mul(0.731)).mul(0.5).add(0.5));
  const stars = pow(smoothstep(0.14, 0.0, w), 2).mul(on).mul(mx_noise_float(dir.mul(90)).mul(0.3).add(0.5));

  // The Milky Way: a band with a warm core, star clouds and dark dust lanes.
  const g = dot(dir, uniform(GALAXY_NORMAL));
  const bandK = exp(g.mul(g).mul(-16));
  const core = pow(max(dot(dir, uniform(unit(0.6, -0.35, 0.72))), 0), 3);
  const clouds = mx_fractal_noise_float(dir.mul(5), 5, 2, 0.5).mul(0.5).add(0.5);
  const lanes = smoothstep(0.52, 0.72, mx_fractal_noise_float(dir.mul(9).add(3.3), 4, 2, 0.55).mul(0.5).add(0.5));
  const milky = mix(vec3(0.06, 0.07, 0.11), vec3(0.2, 0.15, 0.1), core).mul(bandK.mul(clouds).mul(float(1).sub(lanes.mul(0.85))));
  const grain = step(0.6, mx_noise_float(dir.mul(520))).mul(bandK).mul(0.25);

  // Nebulae: soft blobs torn by noise, in three hues.
  let neb = vec3(0);
  for (const [i, n] of NEBULAE.entries()) {
    const a = float(1).sub(dot(dir, uniform(n.dir)));
    const blob = exp(a.div(n.size * n.size * 0.5).negate());
    const tear = smoothstep(0.35, 0.8, mx_fractal_noise_float(dir.mul(6 + i * 2).add(i * 7.1), 4, 2.1, 0.55).mul(0.5).add(0.5));
    neb = neb.add(vec3(...n.color).mul(blob.mul(tear)).mul(0.5));
  }

  // Faint galaxies: small tilted ellipses with a bright core.
  let gal = float(0);
  for (const [i, d] of GALAXIES.entries()) {
    const a = new THREE.Vector3(0, 1, 0).cross(d).normalize().applyAxisAngle(d, i * 1.3);
    const b = d.clone().cross(a);
    const x = dot(dir, uniform(a)).div(0.012), y = dot(dir, uniform(b)).div(0.004);
    const r2 = x.mul(x).add(y.mul(y));
    gal = gal.add(exp(r2.negate()).add(exp(r2.mul(-12)).mul(0.6)).mul(step(0, dot(dir, uniform(d)))));
  }
  let space = vec3(0.003, 0.004, 0.009).add(milky).add(neb).add(vec3(stars.add(grain))).add(vec3(0.5, 0.45, 0.4).mul(gal.mul(0.25)));

  // The gas giant: a lit sphere. Bands along a tilted axis, torn by turbulence, a storm oval,
  // pale poles; lit from the sun with a soft terminator, darker toward the limb, a warm rim.
  const gi = sphereHit(dir, uniform(GIANT.dir), GIANT.radius);
  const gAxis = uniform(GIANT.axis);
  const gAcross = GIANT.axis.clone().cross(GIANT.dir).normalize();
  const gLat = dot(gi.n, gAxis);
  const warp = mx_fractal_noise_float(gi.n.mul(3.2), 4, 2, 0.55).mul(0.07).add(mx_noise_float(gi.n.mul(11)).mul(0.015));
  const bandA = sin(gLat.add(warp).mul(26)).mul(0.5).add(0.5);
  const bandB = sin(gLat.add(warp.mul(1.6)).mul(71)).mul(0.5).add(0.5);
  let giantCol = mix(hex(0xb88a52), hex(0xe6d3ad), bandA);
  giantCol = mix(giantCol, hex(0x86492a), smoothstep(0.62, 0.95, bandB).mul(0.4));
  giantCol = mix(giantCol, hex(0x98a2ab), smoothstep(0.62, 0.9, abs(gLat)));
  const stormAt = GIANT.dir.clone().negate().addScaledVector(GIANT.axis, -0.3).addScaledVector(gAcross, 0.35).normalize();
  const se = gi.n.sub(uniform(stormAt));
  const storm = exp(dot(se, uniform(gAcross)).pow(2).div(0.01).add(dot(se, gAxis).pow(2).div(0.0035)).negate());
  giantCol = mix(giantCol, hex(0xa3452a), storm.mul(0.75));
  const gNdl = dot(gi.n, sun);
  const gView = max(dot(gi.n, dir.negate()), 0);
  const gLit = smoothstep(-0.1, 0.35, gNdl).mul(max(gNdl, 0).mul(0.5).add(0.12));
  const gRim = pow(max(float(1).sub(gView), 0), 4).mul(smoothstep(-0.25, 0.4, gNdl));
  const giantLit = giantCol.mul(gLit).mul(pow(gView, 0.35)).mul(0.75).add(vec3(0.9, 0.72, 0.5).mul(gRim.mul(0.35))).add(0.002);
  const gHalo = exp(max(float(gi.cosA).sub(gi.b), 0).mul(-160)).mul(float(1).sub(gi.inside))
    .mul(smoothstep(-0.3, 0.5, dot(normalize(dir.sub(uniform(GIANT.dir).mul(gi.b))), sun)));
  space = mix(space.add(vec3(0.5, 0.4, 0.28).mul(gHalo.mul(0.12))), giantLit, gi.inside);

  // The moon: grey, cratered, lit from the sun.
  const mo = sphereHit(dir, uniform(MOON.dir), MOON.radius);
  const craters = smoothstep(0.1, 0.4, mx_worley_noise_float(mo.n.mul(5))).mul(0.4).add(0.6);
  const moonCol = vec3(0.5, 0.49, 0.47).mul(craters).mul(max(dot(mo.n, sun), 0).mul(0.8).add(0.01));
  space = mix(space, moonCol, mo.inside);

  // The planet: ray against a sphere at unit distance. Lit side toward the sun; kept below
  // white so the tone mapper never burns it out.
  const P = uniform(PLANET.dir.clone());
  const R = Math.sin(PLANET.radius);
  const pl = sphereHit(dir, P, PLANET.radius);
  const n = pl.n;
  const ndl = dot(n, sun);
  const day = smoothstep(-0.12, 0.25, ndl);
  const cont = mx_fractal_noise_float(n.mul(2.2), 5, 2, 0.5);
  const land = smoothstep(0.02, 0.08, cont);
  const lat = abs(n.y);
  const ground = mix(hex(0x2f4a2c), hex(0x8d7650), smoothstep(0.1, 0.5, mx_noise_float(n.mul(5)).add(0.3).sub(lat)));
  const ice = smoothstep(0.78, 0.86, lat.add(cont.mul(0.15)));
  let surface = mix(hex(0x06203d), ground, land);
  surface = mix(surface, vec3(0.7), ice);
  const cloud = smoothstep(0.05, 0.4, mx_fractal_noise_float(n.mul(4.5).add(vec3(3.1, 0, 0)), 4, 2.1, 0.5));
  surface = mix(surface, vec3(0.62), cloud.mul(0.8));
  const view = max(dot(n, dir.negate()), 0);
  const rim = pow(max(float(1).sub(view), 0), 3);
  const air = vec3(0.3, 0.52, 0.95).mul(rim.mul(day.mul(0.5).add(0.05)));
  // City lights on the night side: fine, sparse points in clusters on land, dimmed by cloud.
  const cities = land.mul(float(1).sub(ice)).mul(float(1).sub(cloud.mul(0.85))).mul(float(1).sub(day))
    .mul(step(0.86, mx_noise_float(n.mul(260)).mul(0.5).add(0.5))).mul(smoothstep(0.55, 0.75, mx_noise_float(n.mul(14)).mul(0.5).add(0.5)));
  const planet = surface.mul(max(ndl, 0).mul(0.55).add(0.05).mul(day)).add(air).add(vec3(1, 0.7, 0.4).mul(cities.mul(0.35)));

  // The rings: a plane through the planet's centre. Hidden behind the planet's disc, dark in
  // its shadow, banded by radius.
  const RN = uniform(RINGS.normal);
  const tr = dot(P, RN).div(dot(dir, RN));
  const H = dir.mul(tr);
  const rr = length(H.sub(P)).div(R);
  const ringBand = smoothstep(RINGS.inner, RINGS.inner + 0.04, rr).mul(float(1).sub(smoothstep(RINGS.outer - 0.05, RINGS.outer, rr)));
  const gaps = mx_noise_float(vec3(rr.mul(40), 0, 0)).mul(0.5).add(0.5).mul(float(1).sub(smoothstep(1.78, 1.8, rr).mul(float(1).sub(smoothstep(1.86, 1.88, rr))).mul(0.85)));
  const toP = P.sub(H);
  const bs = dot(sun, toP);
  const shadow = step(0, bs).mul(step(dot(toP, toP).sub(bs.mul(bs)), R * R));
  const hidden = pl.inside.mul(step(pl.t, tr));
  const ringK = ringBand.mul(gaps).mul(step(0, tr)).mul(float(1).sub(hidden)).mul(float(1).sub(shadow.mul(0.9)));
  const ringCol = vec3(0.55, 0.5, 0.44).mul(ringK).mul(0.35);

  const halo = exp(max(float(pl.cosA).sub(pl.b), 0).mul(-90)).mul(float(1).sub(pl.inside))
    .mul(dot(normalize(dir.sub(P.mul(pl.b))), sun).mul(0.45).add(0.55));
  const sky = mix(space.add(vec3(0.25, 0.45, 0.9).mul(halo.mul(0.45))), planet, pl.inside);
  m.colorNode = sky.mul(float(1).sub(ringBand.mul(gaps).mul(step(0, tr)).mul(float(1).sub(hidden)).mul(0.5))).add(ringCol);
  m.name = 'sky-bake';
  return m;
}

/** The live sky: the baked cube map plus the sun, which is the only part that blooms. */
function skyMaterial(cube) {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false });
  m.fog = false;
  const dir = normalize(positionWorld.sub(cameraPosition));
  const behindPlanet = smoothstep(Math.cos(PLANET.radius) - 0.0004, Math.cos(PLANET.radius) + 0.0004, dot(dir, uniform(PLANET.dir.clone())));
  const sunCol = sunLight(dir).mul(float(1).sub(behindPlanet));
  m.colorNode = cubeTexture(cube, dir).rgb.add(sunCol);
  m.mrtNode = glowOutput(sunCol.min(6).mul(0.25));
  m.name = 'sky';
  return m;
}

/** Star points: sprites of constant pixel size; position, colour and size per instance. */
function starMaterial(pos, col, size) {
  const m = new THREE.SpriteNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  m.fog = false;
  m.sizeAttenuation = false;
  m.positionNode = instancedBufferAttribute(pos);
  m.scaleNode = instancedBufferAttribute(size);
  const r = length(uv().sub(0.5)).mul(2);
  const k = pow(max(float(1).sub(r), 0), 2.2);
  const c = instancedBufferAttribute(col);
  m.colorNode = c.mul(k);
  m.mrtNode = glowOutput(c.mul(k).mul(smoothstep(1.2, 3, c.x.add(c.y).add(c.z))));
  m.name = 'stars';
  return m;
}

/** Rocks and ice: rough, dark, a little frost on the sunlit side. */
function rockMaterial() {
  const m = new THREE.MeshStandardNodeMaterial({ flatShading: true });
  const p = positionWorld.mul(0.35);
  const n = mx_fractal_noise_float(p, 3, 2, 0.5).mul(0.5).add(0.5);
  m.colorNode = mix(hex(0x2a2622), hex(0x7d8a96), smoothstep(0.55, 0.75, n));
  m.roughnessNode = float(0.85).sub(smoothstep(0.55, 0.75, n).mul(0.4));
  m.metalnessNode = float(0.05);
  m.name = 'rock';
  return m;
}

/** God rays: a fan of streaks around the sun, additive; the instance colour is the strength. */
function raysMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  m.fog = false;
  const d = uv().sub(0.5);
  const r = length(d).mul(2);
  const a = atan(d.y, d.x);
  const streaks = pow(mx_noise_float(vec3(a.mul(7), U.time.mul(0.15), 0)).mul(0.5).add(0.5).max(0), 3)
    .add(pow(mx_noise_float(vec3(a.mul(23), 4, U.time.mul(0.1))).mul(0.5).add(0.5).max(0), 5).mul(0.6));
  const k = streaks.mul(pow(max(float(1).sub(r), 0), 1.5)).add(pow(max(float(1).sub(r.mul(3)), 0), 3).mul(0.5));
  m.colorNode = vec3(k);
  m.mrtNode = glowOutput(instanceColor.mul(k).mul(0.6));
  m.name = 'god-rays';
  return m;
}

// Deterministic randomness for the layout.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function onSphere(rand) {
  const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
}

// Star shells: `count` stars on a sphere of `radius` around `centre`, clustered toward the band.
function starShell(rand, count, radius, centre, pixel) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count * 2);
  const tint = [[0.75, 0.85, 1.25], [1, 0.95, 0.85], [1.25, 0.9, 0.6], [1.3, 0.7, 0.5]];
  for (let i = 0; i < count; i++) {
    let d = onSphere(rand);
    if (rand() < 0.45) d = d.addScaledVector(GALAXY_NORMAL, -d.dot(GALAXY_NORMAL) * (0.6 + 0.4 * rand())).normalize();
    d.multiplyScalar(radius * (0.9 + 0.2 * rand())).add(centre);
    pos.set([d.x, d.y, d.z], i * 3);
    const bright = rand() < 0.04 ? 3 + 3 * rand() : 0.3 + rand() * rand() * 1.4;
    const t = tint[Math.floor(rand() * tint.length)];
    col.set(t.map((x) => x * bright), i * 3);
    const s = pixel * (bright > 2 ? 2.2 : 1) * (0.7 + 0.6 * rand());
    size.set([s, s], i * 2);
  }
  const sprite = new THREE.Sprite(starMaterial(
    new THREE.InstancedBufferAttribute(pos, 3), new THREE.InstancedBufferAttribute(col, 3), new THREE.InstancedBufferAttribute(size, 2)));
  sprite.count = count;
  sprite.frustumCulled = false;
  sprite.renderOrder = -5;
  return sprite;
}

function trackCentre(track) {
  const c = new THREE.Vector3();
  for (let i = 0; i < track.count; i++) c.x += track.pos[i * 3], c.y += track.pos[i * 3 + 1], c.z += track.pos[i * 3 + 2];
  return c.divideScalar(track.count);
}

function nearTrack(track, p, clearance) {
  for (let i = 0; i < track.count; i += 4) {
    const dx = track.pos[i * 3] - p.x, dy = track.pos[i * 3 + 1] - p.y, dz = track.pos[i * 3 + 2] - p.z;
    if (dx * dx + dy * dy + dz * dz < clearance * clearance) return true;
  }
  return false;
}

// A closed ribbon circuit far away: centre, two in-plane axes, radius, waviness.
function farCircuit(c, a, b, radius) {
  const up = a.clone().cross(b).normalize();
  const at = (t, out = new THREE.Vector3()) => out.copy(c)
    .addScaledVector(a, Math.cos(t) * radius).addScaledVector(b, Math.sin(t) * radius * 0.7)
    .addScaledVector(up, Math.sin(3 * t) * 110);
  const rows = 360, half = 14, pos = [], index = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3(), side = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) {
    const t = (i / rows) * Math.PI * 2;
    at(t, p); at(t + 0.01, q);
    side.subVectors(q, p).cross(up).normalize();
    for (const [k, h] of [[-1, 0], [1, 0], [1, -4], [-1, -4]]) {
      pos.push(p.x + side.x * half * k + up.x * h, p.y + side.y * half * k + up.y * h, p.z + side.z * half * k + up.z * h);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < 4; j++) {
      const a0 = i * 4 + j, a1 = i * 4 + ((j + 1) % 4), b0 = a0 + 4, b1 = a1 + 4;
      index.push(a0, b0, a1, a1, b0, b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  // Edge lights: two thin strips along the rims.
  const strips = [];
  for (const k of [-1, 1]) {
    const sp = [];
    for (let i = 0; i <= rows; i++) {
      const t = (i / rows) * Math.PI * 2;
      at(t, p); at(t + 0.01, q);
      side.subVectors(q, p).cross(up).normalize();
      for (const o of [0, 1.5]) sp.push(p.x + side.x * (half * k - k * o) + up.x * 0.3, p.y + side.y * (half * k - k * o) + up.y * 0.3, p.z + side.z * (half * k - k * o) + up.z * 0.3);
    }
    const si = [];
    for (let i = 0; i < rows; i++) si.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setIndex(si);
    strips.push(sg);
  }
  const light = mergeGeometries(strips);
  light.computeVertexNormals();
  return { deck: g, light, at, up };
}

/**
 * Builds the space layers. `occluders.sunBlockers` are coarse meshes that can hide the sun (deck,
 * station hull, ring); `occluders.ring` places the ring's beacons.
 * update(dt, camera, spawn) animates beacons, rocks, the flare, traffic, meteors and trails;
 * `spawn` is the effects' particle spawner.
 */
export function createSpace(renderer, track, occluders) {
  const group = new THREE.Group();
  group.name = 'space';
  const rand = rng(1234);
  const centre = trackCentre(track);

  // ---------- far layer: bake once ----------
  const bake = new THREE.Scene();
  const bakeSphere = new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), skyBakeMaterial());
  bake.add(bakeSphere);
  const skyTarget = new THREE.CubeRenderTarget(1024, { type: THREE.HalfFloatType });
  new THREE.CubeCamera(1, 1000, skyTarget).update(renderer, bake);
  bakeSphere.geometry.dispose();
  bakeSphere.material.dispose();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), skyMaterial(skyTarget.texture));
  sky.name = 'sky';
  sky.renderOrder = -10;
  sky.frustumCulled = false;

  // ---------- mid layer: star shells ----------
  const stars = new THREE.Group();
  stars.name = 'stars';
  stars.add(starShell(rand, 1400, 1800, centre, 0.0026), starShell(rand, 1400, 3400, centre, 0.0022), starShell(rand, 1800, 6000, centre, 0.0018));

  // ---------- near layer: rocks ----------
  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  const rp = rockGeometry.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(rp, i);
    v.multiplyScalar(0.75 + 0.5 * Math.abs(Math.sin(v.x * 5.1 + v.y * 3.7) * Math.cos(v.z * 4.3)));
    rp.setXYZ(i, v.x, v.y, v.z);
  }
  rockGeometry.deleteAttribute('normal');
  rockGeometry.deleteAttribute('uv');
  rockGeometry.computeVertexNormals();
  const ROCKS = 260;
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial(), ROCKS);
  rocks.name = 'rocks';
  const rockState = [];
  const f = { p: [0, 0, 0], T: [0, 0, 0], N: [0, 0, 0], U: [0, 0, 0] };
  for (let i = 0; rockState.length < ROCKS && i < ROCKS * 20; i++) {
    const k = Math.floor(rand() * track.count);
    for (const key of ['p', 'T', 'N', 'U']) for (let a = 0; a < 3; a++) f[key][a] = track[key === 'p' ? 'pos' : key][k * 3 + a];
    const far = rand() < 0.75 ? 40 + rand() * 160 : 200 + rand() * 300;
    const side = rand() < 0.5 ? -1 : 1;
    const h = (rand() - 0.6) * far;
    const p = new THREE.Vector3(...f.p).addScaledVector(new THREE.Vector3(...f.N), side * far).addScaledVector(new THREE.Vector3(...f.U), h);
    const size = far < 200 ? 0.8 + rand() * rand() * 6 : 3 + rand() * 14;
    if (nearTrack(track, p, 28 + size)) continue;
    rockState.push({ p, size, axis: onSphere(rand), spin: (rand() - 0.5) * 0.6, a: rand() * 6 });
  }
  rocks.count = rockState.length;
  const q = new THREE.Quaternion(), m = new THREE.Matrix4(), s3 = new THREE.Vector3();
  const poseRocks = (t) => {
    rockState.forEach((r, i) => {
      q.setFromAxisAngle(r.axis, r.a + r.spin * t);
      rocks.setMatrixAt(i, m.compose(r.p, q, s3.setScalar(r.size)));
    });
    rocks.instanceMatrix.needsUpdate = true;
  };
  poseRocks(0);
  rocks.computeBoundingSphere();
  rocks.castShadow = false;

  // ---------- shipyard ----------
  const yard = new THREE.Vector3().copy(centre).addScaledVector(unit(-0.62, 0.3, 0.72), 2600);
  const yardAxis = unit(0.8, 0.1, 0.6), yardUp = new THREE.Vector3(0, 1, 0).addScaledVector(yardAxis, -yardAxis.y).normalize();
  const yardMatrix = new THREE.Matrix4().makeBasis(yardAxis, yardUp, yardAxis.clone().cross(yardUp)).setPosition(yard);
  const frames = [new THREE.BoxGeometry(700, 16, 16)];
  for (let k = 0; k < 6; k++) {
    frames.push(new THREE.TorusGeometry(95, 5, 6, 24).rotateY(Math.PI / 2).translate(-250 + k * 100, 0, 0));
    for (let j = 0; j < 4; j++) frames.push(new THREE.BoxGeometry(6, 190, 6).rotateX(j * Math.PI / 4).translate(-250 + k * 100, 0, 0));
  }
  frames.push(new THREE.BoxGeometry(60, 60, 60).translate(380, 0, 0), new THREE.BoxGeometry(20, 140, 20).translate(380, 90, 0));
  const yardFrame = new THREE.Mesh(mergeGeometries(frames.map((g) => { g.deleteAttribute('uv'); return g.toNonIndexed(); })), structureMaterial());
  yardFrame.applyMatrix4(yardMatrix);
  yardFrame.name = 'shipyard';
  // The ship being built: a long hull, plated on one half, bare on the other.
  const hullGeometry = new THREE.CylinderGeometry(60, 45, 420, 24, 1, true, 0, Math.PI * 1.25).rotateZ(Math.PI / 2).translate(-40, 0, 0);
  const uvs = hullGeometry.attributes.uv;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 330, uvs.getY(i) * 420);
  const yardHull = new THREE.Mesh(hullGeometry, hullMaterial());
  yardHull.applyMatrix4(yardMatrix);
  yardHull.name = 'shipyard-hull';

  // ---------- another circuit across the void ----------
  const far = farCircuit(new THREE.Vector3().copy(centre).addScaledVector(unit(0.25, 0.3, -0.92), 3200), unit(1, 0.15, 0.1), unit(0.1, 0.35, -0.93), 950);
  const farDeck = new THREE.Mesh(far.deck, structureMaterial());
  farDeck.name = 'far-circuit';
  const farLights = new THREE.InstancedMesh(far.light, neonMaterial(), 1);
  farLights.setMatrixAt(0, new THREE.Matrix4());
  farLights.setColorAt(0, new THREE.Color(0.25, 0.9, 1.3));
  farLights.name = 'far-circuit-lights';
  farLights.computeBoundingSphere();

  // ---------- beacons: station ring and shipyard ----------
  const beaconAt = [];
  if (occluders.ring) {
    const { matrix, radius, tube } = occluders.ring;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      beaconAt.push({ p: new THREE.Vector3(Math.cos(a) * (radius + tube), Math.sin(a) * (radius + tube), 0).applyMatrix4(matrix), size: 1.6, color: new THREE.Color(1, 0.25, 0.15), phase: k * 0.25, period: 1.6 });
    }
  }
  for (let k = 0; k < 14; k++) {
    const x = -300 + (k % 7) * 110, y = k < 7 ? 105 : -105;
    beaconAt.push({ p: new THREE.Vector3(x, y, 0).applyMatrix4(yardMatrix), size: 9, color: k % 2 ? new THREE.Color(1, 1, 1) : new THREE.Color(1, 0.3, 0.2), phase: rand(), period: 1.1 + rand() });
  }
  const beacons = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), neonMaterial(), beaconAt.length);
  beacons.name = 'beacons';
  beaconAt.forEach((b, i) => beacons.setMatrixAt(i, m.compose(b.p, q.identity(), s3.setScalar(b.size))));
  beacons.computeBoundingSphere();
  const c = new THREE.Color();
  const poseBeacons = (t) => {
    beaconAt.forEach((b, i) => {
      const x = ((t / b.period + b.phase) % 1);
      beacons.setColorAt(i, c.copy(b.color).multiplyScalar(0.15 + 6 * Math.exp(-x * 14)));
    });
    beacons.instanceColor.needsUpdate = true;
  };
  poseBeacons(0);

  // ---------- light: planet rim, flare, god rays ----------
  const rim = new THREE.DirectionalLight(0x4f8dff, 0.9);
  rim.position.copy(PLANET.dir).multiplyScalar(100);
  rim.name = 'planet-rim';

  const FLARE = [   // t along the sun-to-centre line, size (m at 10 m), colour
    [1, 1.8, [0.9, 0.75, 0.55]], [1, 0, [0.3, 0.45, 0.8]], [0.62, 0.55, [0.25, 0.4, 0.9]], [0.35, 0.28, [0.3, 0.8, 0.45]],
    [-0.15, 0.9, [0.5, 0.25, 0.75]], [-0.45, 0.4, [0.9, 0.5, 0.2]], [-0.8, 1.5, [0.2, 0.35, 0.6]],
  ];
  const flare = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), spriteMaterial(), FLARE.length);
  flare.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FLARE.length * 3), 3);
  flare.name = 'flare';
  flare.frustumCulled = false;
  flare.renderOrder = 20;
  const rays = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), raysMaterial(), 1);
  rays.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
  rays.name = 'god-rays';
  rays.frustumCulled = false;
  rays.renderOrder = 19;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < FLARE.length; i++) flare.setMatrixAt(i, zero);
  rays.setMatrixAt(0, zero);

  group.add(sky, stars, rocks, yardFrame, yardHull, farDeck, farLights, beacons, rim, flare, rays);

  // Sun visibility: five rays toward the sun against the occluders, every few frames.
  const raycaster = new THREE.Raycaster();
  raycaster.far = 4000;
  const occ = occluders.sunBlockers;
  const jitter = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const tmp = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
  const sunNdc = new THREE.Vector3(), a1 = new THREE.Vector3(), a2 = new THREE.Vector3();
  let seen = 1, seenSmooth = 1, frame = 0;
  function sunVisibility(camera) {
    a1.copy(SUN).cross(new THREE.Vector3(0, 1, 0)).normalize();
    a2.copy(SUN).cross(a1);
    let v = 0;
    for (const [x, y] of jitter) {
      tmp.copy(SUN).addScaledVector(a1, x * 0.006).addScaledVector(a2, y * 0.006).normalize();
      raycaster.set(camera.position, tmp);
      if (raycaster.intersectObjects(occ, false).length === 0) v += 1 / jitter.length;
    }
    return v;
  }

  function placeSprite(mesh, i, camera, ndcX, ndcY, size, color, k) {
    tmp.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(10).add(camera.position);
    if (size <= 0) {
      // The anamorphic streak: long and thin across the screen.
      m.makeBasis(a1.copy(camRight).multiplyScalar(14), a2.copy(camUp).multiplyScalar(0.12), camFwd).setPosition(tmp);
    } else {
      m.makeBasis(a1.copy(camRight).multiplyScalar(size), a2.copy(camUp).multiplyScalar(size), camFwd).setPosition(tmp);
    }
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setRGB(color[0] * k, color[1] * k, color[2] * k));
  }

  // ---------- life: far trails, traffic, meteors ----------
  const trails = [0, 1, 2, 3, 4].map((i) => ({ t: i * 1.25, speed: (135 + i * 4) / 950, color: [[2, 0.8, 0.3], [0.3, 1.4, 2], [1.8, 0.4, 1.2], [0.8, 1.8, 0.4], [1.8, 1.6, 1.2]][i] }));
  const traffic = [0, 1, 2].map(() => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 }));
  const meteor = { p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, wait: 3 };
  const respawnTraffic = (tr) => {
    const d = onSphere(rand);
    d.y = Math.abs(d.y) * 0.4;
    tr.p.copy(centre).addScaledVector(d.normalize(), 3200);
    const target = tmp.copy(centre).addScaledVector(onSphere(rand), 1200);
    tr.v.subVectors(target, tr.p).setLength(180 + rand() * 120);
    tr.life = 6400 / tr.v.length();
  };
  traffic.forEach((tr) => { respawnTraffic(tr); tr.p.addScaledVector(tr.v, rand() * tr.life * 0.8); });

  const hitAxis = [0, 0, 0], P = new THREE.Vector3(), Q = new THREE.Vector3();
  function update(dt, camera, spawn) {
    const t = U.time.value;
    poseRocks(t);
    poseBeacons(t);

    // The flare follows the sun's screen position; ghosts mirror through the centre.
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    camFwd.setFromMatrixColumn(camera.matrixWorld, 2);
    const facingSun = -camFwd.dot(SUN);
    sunNdc.copy(camera.position).addScaledVector(SUN, 1000).project(camera);
    const onScreen = facingSun > 0 && Math.abs(sunNdc.x) < 1.3 && Math.abs(sunNdc.y) < 1.3;
    if (onScreen && frame++ % 4 === 0) seen = sunVisibility(camera);
    if (!onScreen) seen = 0;
    seenSmooth += (seen - seenSmooth) * Math.min(1, dt * 12);
    const edge = Math.max(0, 1 - Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y)) / 1.3);
    const k = seenSmooth * Math.min(1, edge * 2.5);
    FLARE.forEach(([tt, size, color], i) => {
      if (k < 0.01) { flare.setMatrixAt(i, zero); return; }
      placeSprite(flare, i, camera, sunNdc.x * tt, sunNdc.y * tt, size, color, (i < 2 ? 0.28 : 0.1) * k);
    });
    flare.instanceMatrix.needsUpdate = true;
    flare.instanceColor.needsUpdate = true;
    // God rays: strongest while the sun is partly hidden, a trace when it is clear.
    const partial = 4 * seenSmooth * (1 - seenSmooth);
    const g = (partial * 0.5 + 0.05 * seenSmooth) * Math.min(1, edge * 2.5) * (onScreen ? 1 : 0);
    if (g > 0.01) placeSprite(rays, 0, camera, sunNdc.x, sunNdc.y, 6, [1, 0.85, 0.65], g);
    else rays.setMatrixAt(0, zero);
    rays.instanceMatrix.needsUpdate = true;
    rays.instanceColor.needsUpdate = true;

    if (!spawn) return;
    // Light trails on the far circuit.
    for (const tr of trails) {
      tr.t += tr.speed * dt;
      far.at(tr.t, P);
      far.at(tr.t + 0.002, Q);
      Q.sub(P).normalize();
      hitAxis[0] = Q.x; hitAxis[1] = Q.y; hitAxis[2] = Q.z;
      spawn({ pos: [P.x + far.up.x * 3, P.y + far.up.y * 3, P.z + far.up.z * 3], color: tr.color, life: 0.9, size: 5, axis: hitAxis, len: 16 });
    }
    // Far traffic: a white running light and a red/green blink.
    for (const tr of traffic) {
      tr.p.addScaledVector(tr.v, dt);
      tr.life -= dt;
      if (tr.life <= 0) respawnTraffic(tr);
      spawn({ pos: tr.p.toArray(), color: [0.5, 0.6, 0.8], life: 0.6, size: 4 });
      if ((t * 1.3 + tr.v.x) % 1 < 0.08) spawn({ pos: tr.p.toArray(), color: (tr.v.y > 0 ? [2.4, 0.2, 0.1] : [0.2, 2.4, 0.4]), life: 0.12, size: 9 });
    }
    // A meteor every few seconds: a long streak burning across the far field.
    meteor.wait -= dt;
    if (meteor.wait <= 0 && meteor.life <= 0) {
      const d = onSphere(rand);
      d.y = Math.abs(d.y) * 0.6 + 0.1;
      meteor.p.copy(camera.position).addScaledVector(d.normalize(), 2600);
      meteor.v.copy(onSphere(rand)).addScaledVector(d, -0.4).setLength(1800);
      meteor.life = 0.9 + rand() * 0.6;
      meteor.wait = 5 + rand() * 7;
    }
    if (meteor.life > 0) {
      meteor.life -= dt;
      meteor.p.addScaledVector(meteor.v, dt);
      Q.copy(meteor.v).normalize();
      spawn({ pos: meteor.p.toArray(), color: [1.6, 1.3, 0.9], life: 0.5, size: 5, axis: Q.toArray(), len: 90 });
    }
  }

  return { group, sky, update };
}
