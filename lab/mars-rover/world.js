// The world around the rover: the sky (a Martian day with its blue sunset, the stars and the two
// moons at night), the haze, the sun, the dune field the rover drives on, the rocks beside the track
// and the mesas on the horizon. Units: metres. x runs along the track, y is up, z is towards the
// camera; the rover drives along z = 0.
import * as THREE from 'three/webgpu';
import {
  color, float, vec3, vec4, uniform, mix, smoothstep, dot, normalize, max, pow, positionLocal,
  positionWorld, normalWorld, mx_noise_float, mx_fractal_noise_float, fog, rangeFogFactor, mrt, sin,
  floor, fract, clamp, step,
} from 'three/tsl';
import { mulberry32 } from './terrain.js';

export const CHUNK = 64; // m of track per terrain chunk
const CHUNKS = 6; // chunks alive at once: 64 m behind the rover, the rest ahead
const COLUMN = 0.25; // m between terrain samples along x
// Rows across the track, from the front edge (towards the camera) to the far edge of the field.
const ROWS = [9, 7, 5.5, 4.2, 3.2, 2.4, 1.6, 0.8, 0, -0.8, -1.6, -2.4, -3.2, -4.2, -5.5, -7, -9, -12, -16, -21, -28, -37, -49, -64, -82, -104];
const TRACK = 3; // m: within this distance of the track the ground is the track's own profile

const SKY = {
  // Butterscotch by day (the dust), blue round the sun at sunset, dark blue-black at night.
  dayZenith: new THREE.Color(0xc9a27e),
  dayHorizon: new THREE.Color(0xe7c7a1),
  duskZenith: new THREE.Color(0x3a3140),
  duskHorizon: new THREE.Color(0x9a7d6a),
  nightZenith: new THREE.Color(0x05070d),
  nightHorizon: new THREE.Color(0x151823),
  blue: new THREE.Color(0x7fa9d9),
  sun: new THREE.Color(0xfff3dc),
};

/** The ground profile across the track: the track itself near z = 0, a wider dune field beyond. */
export function groundHeight(terrain, x, z) {
  const near = terrain.height(x);
  const w = Math.min(1, Math.max(0, (Math.abs(z) - TRACK) / 9));
  const blend = w * w * (3 - 2 * w);
  if (blend === 0) return near;
  // The field beyond is the same kind of dunes, shifted and scaled so it never repeats the track.
  const far = terrain.height(x * 0.93 + z * 1.7 + 911) * (1 + Math.abs(z) / 60) + Math.sin(x * 0.011 + z * 0.05) * 2;
  return near * (1 - blend) + far * blend - blend * Math.max(0, z) * 0.35;
}

export function createWorld(scene, firstTerrain) {
  let terrain = firstTerrain;
  const root = new THREE.Group();
  root.name = 'world';

  // ---------- sky ----------
  const u = {
    zenith: uniform(SKY.dayZenith.clone()),
    horizon: uniform(SKY.dayHorizon.clone()),
    sunDir: uniform(new THREE.Vector3(0.3, 0.8, -0.5).normalize()),
    blue: uniform(0),
    night: uniform(0),
    sunUp: uniform(1),
    phobos: uniform(new THREE.Vector3(0, 1, 0)),
  };
  const skyMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  skyMaterial.name = 'sky';
  {
    const d = normalize(positionLocal);
    const up = d.y;
    const base = mix(u.horizon, u.zenith, smoothstep(-0.02, 0.55, up));
    const cosSun = max(dot(d, u.sunDir), 0);
    // A small white sun: from Mars it looks about two thirds as wide as from Earth.
    const disc = smoothstep(0.99994, 0.99997, cosSun).mul(u.sunUp);
    const glow = pow(cosSun, 6).mul(0.35).mul(u.sunUp);
    // The blue sunset: fine dust scatters blue light forward, so the blue stays close to the sun.
    const halo = pow(cosSun, 22).mul(u.blue).mul(1.4);
    // Stars: sparse points on a grid of directions, twinkling a little.
    const cell = floor(d.mul(420));
    const hash = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
    const star = step(0.9965, hash).mul(smoothstep(0.02, 0.2, up)).mul(u.night);
    const haze = mx_fractal_noise_float(d.mul(vec3(3, 9, 3)), 3, 2, 0.5).mul(0.03);
    const sky = base.add(color(SKY.dayHorizon).mul(glow)).add(color(SKY.blue).mul(halo))
      .add(color(SKY.sun).mul(disc.mul(3))).add(vec3(star.mul(0.9))).add(haze);
    skyMaterial.colorNode = sky;
    skyMaterial.mrtNode = mrt({ emissive: vec4(color(SKY.sun).mul(disc.mul(2.2)), 1) }); // only the sun blooms
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 64, 32), skyMaterial);
  sky.name = 'sky';
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(sky);

  // Phobos and Deimos: two small grey rocks, only in the night sky.
  const moonMaterial = new THREE.MeshStandardNodeMaterial({ color: 0x8e8478, roughness: 1, fog: false });
  moonMaterial.name = 'moon';
  moonMaterial.colorNode = color(0x8e8478).mul(mx_noise_float(positionLocal.mul(0.6)).mul(0.25).add(0.9));
  moonMaterial.emissiveNode = color(0x8e8478).mul(0.35);
  const phobos = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 2), moonMaterial);
  phobos.scale.set(1.25, 0.95, 1);
  phobos.name = 'Phobos';
  const deimos = new THREE.Mesh(new THREE.IcosahedronGeometry(4.5, 2), moonMaterial);
  deimos.name = 'Deimos';
  root.add(phobos, deimos);

  // ---------- haze ----------
  const fogColor = uniform(SKY.dayHorizon.clone());
  scene.fogNode = fog(fogColor, rangeFogFactor(float(70), float(900)));

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight(0xe2c3a0, 0x5a3322, 0.9);
  // Two lights for one sun. The key comes from the camera's side of the track and casts the shadows,
  // so the rover is never a black silhouette (a lab rule). The rim comes from where the sun really
  // is in the sky, behind the dunes, and draws the bright edge along every crest and panel.
  const rim = new THREE.DirectionalLight(0xfff0dc, 1.2);
  root.add(rim, rim.target);
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  const cam = sun.shadow.camera;
  cam.left = -22; cam.right = 22; cam.top = 16; cam.bottom = -10; cam.near = 1; cam.far = 140;
  root.add(hemi, sun, sun.target);

  // ---------- the ground ----------
  const ground = groundMaterial();
  const rockMaterial = rocksMaterial();
  const rockGeometry = boulderGeometry();
  const chunks = [];
  for (let i = 0; i < CHUNKS; i++) chunks.push(createChunk(ground, rockGeometry, rockMaterial));
  chunks.forEach((c) => root.add(c.group));

  function placeChunk(chunk, index) {
    chunk.index = index;
    const x0 = index * CHUNK;
    const columns = Math.round(CHUNK / COLUMN) + 1;
    const position = chunk.mesh.geometry.attributes.position;
    for (let r = 0; r < ROWS.length; r++) {
      for (let c = 0; c < columns; c++) {
        const x = x0 + c * COLUMN;
        const z = ROWS[r];
        position.setXYZ(r * columns + c, x, groundHeight(terrain, x, z), z);
      }
    }
    position.needsUpdate = true;
    chunk.mesh.geometry.computeVertexNormals();
    chunk.mesh.geometry.computeBoundingSphere();
    chunk.mesh.geometry.computeBoundingBox();
    // Rocks on both sides of the track, never on it: the wheels run at z = ±1.2 m.
    const rand = mulberry32(terrain.seed * 977 + index * 131);
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let n = 0;
    for (let k = 0; k < chunk.rocks.instanceMatrix.count; k++) {
      const x = x0 + rand() * CHUNK;
      const side = rand() < 0.7 ? -1 : 1;
      const z = side < 0 ? -(2.8 + rand() ** 1.6 * 60) : 2.8 + rand() * 5;
      const size = 0.12 + rand() ** 3 * (z < -8 ? 2.4 : 0.9);
      e.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
      q.setFromEuler(e);
      s.set(size * (0.8 + rand() * 0.6), size * (0.5 + rand() * 0.4), size * (0.8 + rand() * 0.6));
      p.set(x, groundHeight(terrain, x, z) + s.y * 0.35, z);
      matrix.compose(p, q, s);
      chunk.rocks.setMatrixAt(n++, matrix);
    }
    chunk.rocks.count = n;
    chunk.rocks.instanceMatrix.needsUpdate = true;
    chunk.rocks.computeBoundingSphere();
  }

  // ---------- the horizon ----------
  const mesas = [
    { z: -260, height: 26, color: 0x9c6448, seed: 3 },
    { z: -520, height: 55, color: 0xa8775d, seed: 7 },
    { z: -950, height: 120, color: 0xb88c72, seed: 11 },
  ].map((layer) => {
    const m = mesaLayer(layer);
    root.add(m);
    return m;
  });

  const tmpSun = new THREE.Vector3();
  const tmp = new THREE.Color();
  /** Every frame: follow the rover, recycle the ground, light the sol. */
  function update(camera, roverX, sky) {
    // Ground chunks: one behind the rover, the rest in front.
    const first = Math.floor(roverX / CHUNK) - 1;
    const wanted = new Set(Array.from({ length: CHUNKS }, (_, i) => first + i));
    const free = chunks.filter((c) => !wanted.has(c.index));
    for (const index of wanted) {
      if (chunks.some((c) => c.index === index)) continue;
      placeChunk(free.pop(), index);
    }

    // The sky dome and the horizon follow the camera, so they never come closer.
    skyMeshFollow(camera);
    for (const m of mesas) m.position.x = Math.floor(camera.position.x / m.userData.period) * m.userData.period;

    // The sun crosses the sky from behind the camera's left to the far right: it rises in the east.
    const elevation = sky.sun;
    const azimuth = -0.9 + sky.sol * 2.2;
    tmpSun.set(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), -0.35 - Math.sin(azimuth) * 0.3).normalize();
    u.sunDir.value.copy(tmpSun);
    u.sunUp.value = THREE.MathUtils.clamp(elevation / 0.05 + 1, 0, 1);
    u.blue.value = sky.blue;
    u.night.value = sky.night;
    const day = THREE.MathUtils.clamp(elevation / 0.35, 0, 1);
    const dusk = 1 - day;
    tmp.copy(SKY.duskZenith).lerp(SKY.dayZenith, day).lerp(SKY.nightZenith, sky.night);
    u.zenith.value.copy(tmp);
    tmp.copy(SKY.duskHorizon).lerp(SKY.dayHorizon, day).lerp(SKY.nightHorizon, sky.night);
    u.horizon.value.copy(tmp);
    fogColor.value.copy(tmp);

    // The light: warm and high by day, low and orange at sunset, a dim blue moonlight at night.
    sun.position.set(roverX + tmpSun.x * 70, Math.max(4, tmpSun.y * 70), 45);
    sun.target.position.set(roverX + 6, 0, 0);
    rim.position.set(roverX + tmpSun.x * 70, tmpSun.y * 70, tmpSun.z * 70);
    rim.target.position.set(roverX + 6, 0, 0);
    rim.intensity = (1.1 * day + 1.6 * dusk * (1 - sky.night)) * u.sunUp.value;
    rim.color.copy(SKY.sun).lerp(SKY.blue, sky.blue * 0.6);
    sun.intensity = 3.2 * day + 0.8 * dusk * (1 - sky.night) + 0.12 * sky.night;
    sun.color.setHSL(0.08, 0.6 * dusk, 0.8 + 0.1 * day).lerp(new THREE.Color(0x9fb4e0), sky.night);
    hemi.intensity = 0.25 + 0.75 * day - 0.15 * sky.night;
    hemi.color.copy(tmp.copy(SKY.dayHorizon).lerp(SKY.nightHorizon, sky.night));

    // The moons: Phobos races across the sky from the west, Deimos barely moves.
    const moonUp = sky.night > 0.05 ? 1 : 0.0001;
    const phobosAngle = (sky.sol * 2 * 2) % 1 * Math.PI; // twice a sol
    phobos.position.set(camera.position.x - Math.cos(phobosAngle) * 700, 60 + Math.sin(phobosAngle) * 520, -900);
    phobos.scale.setScalar(moonUp * 1.1);
    deimos.position.set(camera.position.x + 340 - sky.sol * 120, 380, -1000);
    deimos.scale.setScalar(moonUp);
  }

  function skyMeshFollow(camera) {
    sky.position.copy(camera.position);
  }

  /** A new run on new ground: every chunk is laid again. */
  function reset(next) {
    terrain = next;
    chunks.forEach((c, i) => placeChunk(c, i - 1));
  }

  // The first frame needs ground under the rover.
  reset(terrain);

  return { root, sun, rim, hemi, chunks, mesas, sky, moons: [phobos, deimos], update, reset };
}

// ---------- pieces ----------

function createChunk(ground, rockGeometry, rockMaterial) {
  const columns = Math.round(CHUNK / COLUMN) + 1;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(columns * ROWS.length * 3), 3));
  const index = [];
  for (let r = 0; r < ROWS.length - 1; r++) {
    for (let c = 0; c < columns - 1; c++) {
      const a = r * columns + c;
      const b = a + 1;
      const d = a + columns;
      const e = d + 1;
      index.push(a, b, d, b, e, d);
    }
  }
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, ground);
  mesh.name = 'dunes';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 90);
  rocks.name = 'rocks';
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const group = new THREE.Group();
  group.name = 'ground chunk';
  group.add(mesh, rocks);
  return { group, mesh, rocks, index: null };
}

/**
 * Martian regolith: rust-coloured dust over darker sand, lighter where the wind has swept fine
 * dust into the hollows, streaked darker down the steep slip faces where the sand avalanches.
 */
function groundMaterial() {
  const material = new THREE.MeshStandardNodeMaterial({ color: 0xb4663e, roughness: 0.93, metalness: 0 });
  material.name = 'regolith';
  const p = positionWorld;
  const blotch = mx_fractal_noise_float(p.xz.mul(0.045), 4, 2, 0.55);
  const grain = mx_noise_float(p.mul(9));
  // Wind ripples: fine crests across the track, bent by a slow noise so they are never ruled lines.
  const warp = mx_noise_float(p.xz.mul(0.08)).mul(2.2);
  const ripple = smoothstep(0.55, 1, sin(p.x.mul(2.1).add(p.z.mul(0.35)).add(warp)).mul(0.5).add(0.5));
  const steep = smoothstep(0.93, 0.8, normalWorld.y); // 0 on the flat, 1 on a slip face
  const streak = mx_noise_float(vec3(p.x.mul(3), p.y.mul(0.4), p.z.mul(0.4)));
  const rust = color(0xb4663e);
  const dust = color(0xd49a6c);
  const dark = color(0x6e3a25);
  let base = mix(rust, dust, clamp(blotch.mul(0.9).add(0.35), 0, 1));
  base = mix(base, dark, steep.mul(streak.mul(0.35).add(0.45)));
  base = base.mul(ripple.mul(0.08).add(0.96)).mul(grain.mul(0.07).add(1));
  material.colorNode = base;
  material.roughnessNode = float(0.9).add(grain.mul(0.06)).sub(steep.mul(0.06));
  return material;
}

/** Basalt boulders: dark, pitted, with a coat of rust-coloured dust on their tops. */
function rocksMaterial() {
  const material = new THREE.MeshStandardNodeMaterial({ color: 0x4a3a33, roughness: 0.85 });
  material.name = 'basalt';
  const pits = mx_noise_float(positionLocal.mul(7));
  const dusty = smoothstep(0.35, 0.85, normalWorld.y);
  material.colorNode = mix(color(0x3e322d).mul(pits.mul(0.2).add(0.95)), color(0xb07550), dusty.mul(0.55));
  material.roughnessNode = float(0.8).add(pits.mul(0.12));
  return material;
}

/** One boulder: a sphere dented by noise into a rough, faceted lump. */
function boulderGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  const rand = mulberry32(8812);
  const bumps = Array.from({ length: 7 }, () => new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    let r = 1;
    for (const b of bumps) r -= Math.max(0, v.dot(b) - 0.55) * 0.9; // flat fracture faces
    v.multiplyScalar(r * (0.92 + 0.08 * Math.sin(v.x * 9) * Math.cos(v.z * 7)));
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * One layer of mesas and buttes on the horizon: flat tops, steep sides, the way eroded layered rock
 * stands in Martian craters. The profile repeats every `period` metres, so the layer can follow the
 * camera by whole periods and never shows a seam.
 */
function mesaLayer({ z, height, color: hex, seed }) {
  const period = 1600;
  const rand = mulberry32(seed);
  const waves = Array.from({ length: 5 }, (_, i) => ({ k: ((i + 1) * 2 * Math.PI * (1 + Math.floor(rand() * 3))) / period, p: rand() * 6.28, a: 1 / (i + 1) }));
  const profile = (x) => {
    const s = waves.reduce((sum, w) => sum + w.a * Math.sin(w.k * x + w.p), 0);
    // Flat tops: squash everything above a level into a plateau.
    const t = Math.tanh(s * 2.4);
    return height * (0.35 + 0.65 * Math.max(0, t));
  };
  const columns = 480;
  const depths = [0, -30, -90];
  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array((columns + 1) * depths.length * 3);
  for (let r = 0; r < depths.length; r++) {
    for (let c = 0; c <= columns; c++) {
      const x = -period + (c / columns) * period * 2.5;
      const y = r === 0 ? -20 : profile(x) * (r === 1 ? 1 : 0.8);
      pos.set([x, y, depths[r]], (r * (columns + 1) + c) * 3);
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const index = [];
  for (let r = 0; r < depths.length - 1; r++) {
    for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c;
      index.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
    }
  }
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ color: hex, roughness: 1 });
  material.name = 'mesa';
  const strata = sin(positionWorld.y.mul(0.9)).mul(0.5).add(0.5);
  material.colorNode = color(hex).mul(strata.mul(0.12).add(0.92)).mul(mx_noise_float(positionWorld.mul(0.05)).mul(0.1).add(1));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'mesas';
  mesh.position.z = z;
  mesh.userData.period = period;
  mesh.frustumCulled = false;
  return mesh;
}

