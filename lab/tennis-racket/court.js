/**
 * The set: a hard court at night under four floodlight towers.
 * Everything is procedural: the court lines are drawn in the fragment shader,
 * the net is a shader grid, the light beams are additive cones.
 */
import * as THREE from 'three/webgpu';
import {
  positionWorld, abs, max, min, step, smoothstep, fwidth, mix, color, float, vec2, vec3, uv, fract,
  mx_noise_float, normalView, positionViewDirection, dot, time, hash, instanceIndex, sin, cos,
} from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glowOutput, unlit } from './post.js';

// ITF dimensions (metres).
const HALF_DOUBLES = 5.485;
const HALF_SINGLES = 4.115;
const BASELINE = 11.885;
const SERVICE = 6.4;
const WARM = 0xffe6c4;

// The far pair stands by the fence, so a portrait phone does not catch a lamp head at its edge.
export const TOWERS = [
  [-7.5, -12],
  [7.5, -12],
  [-10.5, -22],
  [10.5, -22],
];
const TOWER_HEIGHT = 8.5;

/** Anti-aliased line of width w centred on d = 0. */
function line(d, w) {
  const aa = fwidth(d).mul(1.5);
  return float(1).sub(smoothstep(float(w / 2).sub(aa), float(w / 2).add(aa), abs(d)));
}

function courtMaterial() {
  const p = positionWorld.xz;
  const ax = abs(p.x);
  const az = abs(p.y);
  const inLength = step(az, BASELINE + 0.05);
  const inSingles = step(ax, HALF_SINGLES + 0.03);
  const inService = step(az, SERVICE);

  const lines = max(
    max(line(ax.sub(HALF_DOUBLES), 0.05).mul(inLength), line(ax.sub(HALF_SINGLES), 0.05).mul(inLength)),
    max(
      max(line(az.sub(BASELINE), 0.1).mul(step(ax, HALF_DOUBLES + 0.03)), line(az.sub(SERVICE), 0.05).mul(inSingles)),
      max(line(p.x, 0.05).mul(inService), line(p.x, 0.05).mul(step(BASELINE - 0.1, az)).mul(inLength)),
    ),
  );

  const inside = step(ax, HALF_DOUBLES + 0.6).mul(step(az, BASELINE + 3.5));
  const grain = mx_noise_float(vec3(p.mul(9), 0)).mul(0.5).add(0.5);
  const blotch = mx_noise_float(vec3(p.mul(0.35), 3)).mul(0.5).add(0.5);
  const courtBlue = mix(color(0x0f2d55), color(0x163a6a), grain.mul(0.75).add(blotch.mul(0.25)));
  const apron = mix(color(0x0c241e), color(0x113028), grain);
  const base = mix(apron, courtBlue, inside);

  const material = new THREE.MeshStandardNodeMaterial();
  material.colorNode = mix(base, color(0xc9d1d9), lines);
  material.roughnessNode = mix(float(0.62), float(0.4), lines).add(grain.mul(0.12));
  return material;
}

function net() {
  const group = new THREE.Group();
  const width = 2 * HALF_DOUBLES + 1.83;
  const netMaterial = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, roughness: 0.9 });
  const cell = fract(uv().mul(vec2(width / 0.045, 0.914 / 0.045)));
  const thread = max(
    float(1).sub(smoothstep(0.0, 0.14, min(cell.x, float(1).sub(cell.x)))),
    float(1).sub(smoothstep(0.0, 0.14, min(cell.y, float(1).sub(cell.y)))),
  );
  netMaterial.colorNode = color(0x0b0e12);
  netMaterial.opacityNode = thread.mul(0.85);
  const mesh = unlit(new THREE.Mesh(new THREE.PlaneGeometry(width, 0.914), netMaterial));
  mesh.position.y = 0.457;
  group.add(mesh);

  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.5 });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.02), white);
  tape.position.y = 0.914;
  group.add(tape);

  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.4, metalness: 0.6 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.07, 16), postMaterial);
    post.position.set((s * width) / 2, 0.535, 0);
    post.castShadow = true;
    group.add(post);
  }
  return group;
}

function walls() {
  const material = new THREE.MeshStandardMaterial({ color: 0x0f2019, roughness: 0.95 });
  const rail = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.4, metalness: 0.7 });
  const group = new THREE.Group();
  const specs = [
    { size: [26, 3, 0.1], at: [0, 1.5, -18.4] },
    { size: [0.1, 3, 40], at: [-11, 1.5, 0] },
    { size: [0.1, 3, 40], at: [11, 1.5, 0] },
  ];
  for (const { size, at } of specs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    wall.position.set(...at);
    wall.receiveShadow = true;
    group.add(wall);
    const top = new THREE.Mesh(new THREE.BoxGeometry(size[0] + 0.05, 0.06, size[2] + 0.05), rail);
    top.position.set(at[0], 3.03, at[2]);
    group.add(top);
  }
  return group;
}

/** Materials shared by the four towers: one set of shader programs instead of four. */
function towerMaterials() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x1b2027, roughness: 0.45, metalness: 0.75 });
  const lamp = new THREE.MeshBasicNodeMaterial();
  lamp.colorNode = color(WARM).mul(24);
  lamp.mrtNode = glowOutput(lamp.colorNode);
  // Beam: an open cone from the head towards the court, bright near the lamp.
  const beam = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const facing = abs(dot(normalView, positionViewDirection));
  const along = uv().y; // 1 at the apex (lamp), 0 at the base
  beam.colorNode = color(WARM).mul(facing.pow(2).mul(along.pow(1.6)).mul(0.035));
  beam.mrtNode = glowOutput(); // haze, not an emitter
  return { steel, lamp, beam, lampGeometry: new THREE.CircleGeometry(0.19, 24) };
}

/** A tower: pole, a head with a grid of lamps facing `target`, and a soft beam. */
function tower([x, z], target, { steel, lamp, beam: beamMaterial, lampGeometry }) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, TOWER_HEIGHT, 12), steel);
  pole.position.set(x, TOWER_HEIGHT / 2, z);
  group.add(pole);

  const head = new THREE.Group();
  head.position.set(x, TOWER_HEIGHT + 0.4, z);
  head.lookAt(target);
  group.add(head);

  const housing = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.1, 0.3, 3, 0.08), steel);
  head.add(housing);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const disc = unlit(new THREE.Mesh(lampGeometry, lamp));
      disc.position.set(-0.78 + i * 0.52, -0.25 + j * 0.5, 0.16);
      head.add(disc);
    }
  }

  const length = head.position.distanceTo(target) * 1.05;
  const beam = unlit(new THREE.Mesh(new THREE.ConeGeometry(3.2, length, 48, 1, true), beamMaterial));
  beam.rotation.x = -Math.PI / 2; // apex (+y) towards the head, base along +z (the look direction)
  beam.position.z = length / 2;
  head.add(beam);

  return group;
}

/** Dust hanging in the light: instanced sprites that drift slowly. */
function dust(count, center) {
  const material = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const seed = instanceIndex.toFloat();
  const origin = vec3(hash(seed).sub(0.5).mul(16), hash(seed.add(7.1)).mul(7).add(0.2), hash(seed.add(3.3)).sub(0.5).mul(16));
  const t = time.mul(0.08).add(hash(seed.add(1.7)).mul(100));
  const drift = vec3(sin(t.mul(1.3)), sin(t.mul(0.7)).mul(0.5), cos(t)).mul(0.6);
  material.positionNode = origin.add(drift).add(vec3(...center));
  const twinkle = sin(time.mul(2).add(seed)).mul(0.3).add(0.7);
  material.colorNode = color(WARM).mul(twinkle.mul(0.6));
  material.opacityNode = smoothstep(0.5, 0.2, uv().sub(0.5).length());
  material.scaleNode = hash(seed.add(9.2)).mul(0.018).add(0.008);
  material.mrtNode = glowOutput();
  const sprite = unlit(new THREE.Sprite(material));
  sprite.count = count;
  sprite.frustumCulled = false;
  return sprite;
}

function balls() {
  const felt = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  const n = mx_noise_float(positionWorld.mul(260)).mul(0.5).add(0.5);
  felt.colorNode = mix(color(0xb9d63a), color(0xdcf05a), n);
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(0.0335, 24, 16);
  for (const [x, z] of [[1.6, 6.9], [1.75, 7.05], [-2.2, 3.1], [2.8, 2.2]]) {
    const ball = new THREE.Mesh(geometry, felt);
    ball.position.set(x, 0.0335, z);
    ball.castShadow = true;
    group.add(ball);
  }
  return group;
}

/**
 * Adds the set and its lights to `scene`. `focus` is the point the key light
 * aims at (where the racket flies). Returns the parts as groups, so the loader
 * can compile them one at a time; nothing needs an update per frame.
 */
export function buildCourt(scene, focus) {
  const surface = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), courtMaterial());
  ground.receiveShadow = true;
  surface.add(ground);

  const fixtures = new THREE.Group();
  fixtures.add(net(), walls(), balls());

  const towers = new THREE.Group();
  const shared = towerMaterials();
  const courtCenter = new THREE.Vector3(0, 0, 0);
  for (const t of TOWERS) towers.add(tower(t, courtCenter, shared));

  const air = new THREE.Group();
  air.add(dust(320, [focus.x, 0, focus.z - 9]));
  scene.add(surface, fixtures, towers, air);

  scene.add(new THREE.HemisphereLight(0x2a3d5c, 0x07090d, 0.5));

  // Key: from the far-left tower, casting the racket's shadow towards the camera.
  const key = new THREE.SpotLight(WARM, 420, 60, 0.3, 0.6, 2);
  key.position.set(TOWERS[0][0], TOWER_HEIGHT, TOWERS[0][1]);
  key.target.position.copy(focus);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  // Rim: cooler, from the far-right tower.
  const rim = new THREE.SpotLight(0xd6e4ff, 320, 60, 0.3, 0.7, 2);
  rim.position.set(TOWERS[1][0], TOWER_HEIGHT, TOWERS[1][1]);
  rim.target.position.copy(focus);
  scene.add(rim, rim.target);

  // Wash over the whole court from the far towers.
  for (const [x, z] of TOWERS.slice(2)) {
    const wash = new THREE.SpotLight(WARM, 300, 80, 0.55, 0.8, 2);
    wash.position.set(x, TOWER_HEIGHT, z);
    wash.target.position.set(-x * 0.2, 0, 4);
    scene.add(wash, wash.target);
  }

  // Soft fill from behind the camera so the red face is never a black silhouette.
  const fill = new THREE.SpotLight(0xbcd4ff, 90, 40, 0.5, 1, 2);
  fill.position.set(3, 7, 16);
  fill.target.position.copy(focus);
  scene.add(fill, fill.target);
  return { surface, fixtures, towers, air };
}
