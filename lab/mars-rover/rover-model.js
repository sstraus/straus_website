// The rover: a six-wheeled Mars rover of the Perseverance class, 3 m long, 2.7 m wide, 2.2 m to the
// top of its mast, on a rocker-bogie suspension. The body follows the physics chassis; the wheels
// sit where the physics puts them; the rocker and bogie arms are drawn between the body and the
// wheels, so they flex over every dune the way the real linkage does.
// Frame: the physics centre of mass is the origin, x forward, y up, z across (+z faces the camera).
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { color, float, mix, smoothstep, abs, fract, positionLocal, mx_noise_float, mx_fractal_noise_float, normalWorld, vec3 } from 'three/tsl';
import { ROVER } from './physics.js';

const SIDE = 1.12; // m: half the track width, wheel centre to wheel centre across
const TAU = Math.PI * 2;

export function roverMaterials(environment) {
  const hero = (m, intensity) => {
    m.envMap = environment;
    m.envMapIntensity = intensity;
    return m;
  };
  // Painted aluminium body: warm white, a satin clearcoat, fine panel seams and a film of dust that
  // settles on everything facing up.
  const paint = hero(new THREE.MeshPhysicalNodeMaterial({ color: 0xe8e4dc, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.25 }), 1);
  paint.name = 'paint';
  {
    const seams = smoothstep(0.02, 0, abs(fract(positionLocal.x.mul(2.2)).sub(0.5)).sub(0.47)).mul(0.25);
    const dust = smoothstep(0.3, 0.9, normalWorld.y).mul(mx_fractal_noise_float(positionLocal.mul(6), 3, 2, 0.5).mul(0.5).add(0.5));
    paint.colorNode = mix(color(0xe8e4dc).mul(float(1).sub(seams)), color(0xc8906a), dust.mul(0.4));
    paint.roughnessNode = float(0.4).add(dust.mul(0.3));
  }
  // Multi-layer insulation: crinkled gold foil on the deck.
  const foil = hero(new THREE.MeshStandardNodeMaterial({ color: 0xd2a445, metalness: 1, roughness: 0.32 }), 1.4);
  foil.name = 'foil';
  foil.roughnessNode = float(0.22).add(mx_noise_float(positionLocal.mul(38)).mul(0.18).add(0.1));
  foil.colorNode = color(0xd2a445).mul(mx_noise_float(positionLocal.mul(24)).mul(0.12).add(0.95));
  // The suspension and the mast: anodised titanium and aluminium, dark grey with a brushed grain.
  const anodised = hero(new THREE.MeshStandardNodeMaterial({ color: 0x3b3f45, metalness: 0.7, roughness: 0.42 }), 1.1);
  anodised.name = 'anodised';
  anodised.roughnessNode = float(0.38).add(mx_noise_float(positionLocal.mul(vec3(60, 2, 2))).mul(0.08));
  // Wheels: machined aluminium, dusty in the grooves.
  const aluminium = hero(new THREE.MeshStandardNodeMaterial({ color: 0xb9bcc0, metalness: 0.72, roughness: 0.4 }), 1.2);
  aluminium.name = 'wheel';
  {
    const grime = mx_fractal_noise_float(positionLocal.mul(14), 3, 2, 0.5).mul(0.5).add(0.5);
    aluminium.colorNode = mix(color(0xb9bcc0), color(0x9a6448), grime.mul(0.45));
    aluminium.roughnessNode = float(0.38).add(grime.mul(0.3));
  }
  // The power source: a finned cylinder, dark and hot.
  const rtg = hero(new THREE.MeshStandardNodeMaterial({ color: 0x24262a, metalness: 0.65, roughness: 0.5 }), 0.9);
  rtg.name = 'rtg';
  // Camera glass.
  const glass = hero(new THREE.MeshPhysicalNodeMaterial({ color: 0x0b0d12, roughness: 0.06, metalness: 0, clearcoat: 1 }), 2);
  glass.name = 'glass';
  return { paint, foil, anodised, aluminium, rtg, glass };
}

const mesh = (geometry, material, cast = true) => {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

/** One wheel: a thin rim with a row of chevron cleats (grousers) and curved spokes to the hub. */
function wheelGeometry() {
  const r = ROVER.wheelRadius;
  const width = 0.4;
  const parts = [];
  // The rim, open at both sides, and a lip on each edge.
  const rim = new THREE.CylinderGeometry(r * 0.96, r * 0.96, width, 48, 1, true);
  rim.rotateX(Math.PI / 2);
  parts.push(rim);
  for (const side of [-1, 1]) {
    const lip = new THREE.TorusGeometry(r * 0.955, 0.012, 6, 48);
    lip.translate(0, 0, (side * width) / 2);
    parts.push(lip);
  }
  // Grousers: 48 chevron cleats, each two short bars meeting at the middle of the tread.
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    for (const half of [-1, 1]) {
      const bar = new THREE.BoxGeometry(0.016, 0.028, width * 0.52);
      bar.rotateY(half * 0.35);
      bar.translate(half * 0.016, 0, (half * width) / 4);
      bar.translate(0, r * 0.975, 0);
      bar.rotateZ(a);
      parts.push(bar);
    }
  }
  // Hub and six curved titanium spokes.
  const hub = new THREE.CylinderGeometry(r * 0.28, r * 0.28, width * 0.5, 24);
  hub.rotateX(Math.PI / 2);
  parts.push(hub);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26, width * 0.12),
      new THREE.Vector3(Math.cos(a + 0.5) * r * 0.62, Math.sin(a + 0.5) * r * 0.62, width * 0.2),
      new THREE.Vector3(Math.cos(a + 0.8) * r * 0.94, Math.sin(a + 0.8) * r * 0.94, width * 0.12),
    );
    parts.push(new THREE.TubeGeometry(curve, 10, 0.013, 6, false));
  }
  // Every part is an indexed geometry, so they merge into one: one draw per wheel.
  return mergeGeometries(parts);
}

export function buildRover(m) {
  const root = new THREE.Group();
  root.name = 'rover';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // ---- the body: a warm white box with its deck ----
  const chassis = mesh(new RoundedBoxGeometry(2.25, 0.6, 1.7, 3, 0.07), m.paint);
  chassis.position.set(0.05, -0.08, 0);
  body.add(chassis);
  const deck = mesh(new RoundedBoxGeometry(1.7, 0.05, 1.45, 2, 0.02), m.foil, false);
  deck.position.set(-0.05, 0.245, 0);
  body.add(deck);
  // A dark belly pan and the cable run under it.
  const belly = mesh(new RoundedBoxGeometry(2.0, 0.08, 1.4, 2, 0.03), m.anodised, false);
  belly.position.set(0.05, -0.41, 0);
  body.add(belly);

  // ---- the power source at the back: a finned cylinder tilted up ----
  const rtg = new THREE.Group();
  rtg.name = 'MMRTG';
  const core = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 24), m.rtg);
  rtg.add(core);
  for (let i = 0; i < 8; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.2, 0.58, 0.018), m.rtg);
    const a = (i / 8) * TAU;
    fin.position.set(Math.cos(a) * 0.29, 0, Math.sin(a) * 0.29);
    fin.rotation.y = -a;
    rtg.add(fin);
  }
  rtg.position.set(-1.2, 0.18, 0);
  rtg.rotation.z = -1.0;
  body.add(rtg);

  // ---- the mast, with its camera head, at the front left ----
  const mast = new THREE.Group();
  mast.name = 'mast';
  const post = mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.05, 16), m.anodised);
  post.position.y = 0.52;
  mast.add(post);
  const head = new THREE.Group();
  head.position.y = 1.08;
  const box = mesh(new RoundedBoxGeometry(0.34, 0.2, 0.46, 2, 0.03), m.paint);
  head.add(box);
  for (const z of [-0.12, 0.12]) {
    const barrel = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 16), m.anodised);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.2, -0.02, z);
    const lens = mesh(new THREE.CircleGeometry(0.038, 16), m.glass, false);
    lens.rotation.y = Math.PI / 2;
    lens.position.set(0.271, -0.02, z);
    head.add(barrel, lens);
  }
  const laserWindow = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 24), m.glass, false);
  laserWindow.rotation.z = Math.PI / 2;
  laserWindow.position.set(0.18, 0.05, 0);
  head.add(laserWindow);
  mast.add(head);
  mast.position.set(0.85, 0.22, 0.55);
  body.add(mast);

  // ---- the high-gain antenna: a hexagonal plate on a gimbal ----
  const antenna = new THREE.Group();
  const gimbal = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), m.anodised);
  gimbal.position.y = 0.11;
  const dish = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 6), m.paint);
  dish.position.y = 0.24;
  dish.rotation.x = 0.5;
  antenna.add(gimbal, dish);
  antenna.position.set(-0.45, 0.25, -0.45);
  body.add(antenna);

  // ---- the arm, stowed across the front, with its tool turret ----
  const arm = new THREE.Group();
  arm.name = 'arm';
  const upper = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 12), m.anodised);
  upper.rotation.x = Math.PI / 2;
  upper.position.set(1.25, -0.05, 0);
  const turret = mesh(new RoundedBoxGeometry(0.26, 0.24, 0.26, 2, 0.03), m.paint);
  turret.position.set(1.28, -0.02, 0.52);
  const drill = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 10), m.aluminium);
  drill.position.set(1.28, -0.2, 0.52);
  arm.add(upper, turret, drill);
  body.add(arm);

  // ---- the suspension and the wheels, both sides ----
  const wheelGeo = wheelGeometry();
  const link = new THREE.BoxGeometry(1, 0.07, 0.08); // stretched between two points each frame
  const sides = [-1, 1].map((side) => {
    const wheels = [0, 1, 2].map(() => {
      const w = mesh(wheelGeo, m.aluminium);
      root.add(w);
      return w;
    });
    const arms = ['rocker front', 'rocker back', 'bogie front', 'bogie back', 'strut 0', 'strut 1', 'strut 2'].map((name) => {
      const a = mesh(link, m.anodised);
      a.name = name;
      root.add(a);
      return a;
    });
    return { side, wheels, arms };
  });

  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  const pivot = new THREE.Vector3();
  const bogie = new THREE.Vector3();
  const knee = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let roll = 0;

  /** Stretches a unit box between two world points. */
  function between(object, a, b) {
    object.position.copy(a).add(b).multiplyScalar(0.5);
    v.copy(b).sub(a);
    object.scale.set(Math.max(0.01, v.length()), 1, 1);
    object.quaternion.setFromUnitVectors(X, v.normalize());
  }

  /** Place everything from the physics pose; `distance` rolls the wheels. */
  function update(pose, distance, time) {
    root.position.set(0, 0, 0);
    body.position.set(pose.x, pose.y, 0);
    body.rotation.z = pose.a;
    body.updateMatrixWorld();
    roll = -distance / ROVER.wheelRadius;
    // The mast head looks around a little, the way the real one takes its pictures.
    head.rotation.y = Math.sin(time * 0.4) * 0.35;

    for (const s of sides) {
      const z = s.side * SIDE;
      // Wheel centres from the physics, on this side of the rover.
      pose.wheels.forEach((wheel, i) => {
        s.wheels[i].position.set(wheel.x, wheel.y, z);
        s.wheels[i].rotation.set(0, 0, roll);
        // The knee: where the arm meets the wheel's steering strut, just above the hub.
        knee[i].set(wheel.x, wheel.y + 0.22, z * 0.9);
      });
      // Rocker pivot on the side of the body, and the bogie pivot between the middle and rear wheels.
      pivot.set(0.2, -0.2, z * 0.86).applyMatrix4(body.matrixWorld);
      bogie.copy(knee[1]).add(knee[2]).multiplyScalar(0.5);
      w.copy(knee[2]).sub(knee[1]);
      bogie.x -= w.y * 0.25;
      bogie.y += Math.abs(w.x) * 0.22;
      between(s.arms[0], pivot, knee[0]);
      between(s.arms[1], pivot, bogie);
      between(s.arms[2], bogie, knee[1]);
      between(s.arms[3], bogie, knee[2]);
      for (let i = 0; i < 3; i++) {
        w.copy(knee[i]);
        v.set(pose.wheels[i].x, pose.wheels[i].y, z);
        between(s.arms[4 + i], w, v);
      }
    }
  }

  return { root, body, sides, update };
}

const X = new THREE.Vector3(1, 0, 0);
