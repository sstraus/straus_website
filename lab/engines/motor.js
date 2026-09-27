// The electric motor: a permanent-magnet synchronous motor with 12 tooth coils and 8 surface
// magnets, in a water-jacketed aluminium housing, with its inverter on the plinth behind it.
// Units: metres. Frame: origin in the middle of the stator stack, x along the shaft (output at +x),
// angles measured from +y towards +z, as in physics.js. A wedge of the housing, stator and coils is
// cut away on the side of the camera; the rotor, the only moving part, is drawn whole.
import * as THREE from 'three/webgpu';
import { uniform, color, vec4, mrt } from 'three/tsl';
import { MOTOR, TAU, toothCurrent } from './physics.js';
import {
  mesh, sectioned, extrude, circlePath, roundedRect, cylinderX, ringX, lathe, pickVolume, windingMaterial,
} from './materials.js';

const DEG = Math.PI / 180;
const STACK = { length: 0.14, outer: 0.11, yoke: 0.096, bore: 0.0715, shoe: 0.0795 };
const TOOTH_HALF = 0.01;
const COIL = { inner: 0.0805, depth: 0.014, side: 0.0095 };
const ROTOR = { core: 0.0652, outer: 0.0702, span: 40 * DEG, length: 0.138 };
const HOUSING = { outer: 0.126, inner: 0.11, half: 0.09 };
const WEDGE = { from: -20 * DEG, to: 100 * DEG }; // the removed wedge, facing the camera

export const MOTOR_LAYOUT = {
  position: new THREE.Vector3(0.3, 0.16, 0.1), // a step nearer the camera than the engine, so the smaller machine reads
  bounds: { min: [-0.16, -0.16, -0.42], max: [0.26, 0.15, 0.13] },
};

const dir = (a, r = 1) => new THREE.Vector2(-Math.sin(a) * r, Math.cos(a) * r); // shape coordinates
const tangent = (a) => new THREE.Vector2(-Math.cos(a), -Math.sin(a));

/** Extrude a shape drawn in the (−z, y) plane between two x positions. */
function slabX(shape, x0, x1, curveSegments = 48) {
  const g = extrude(shape, x1 - x0, { from: 0, curveSegments });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
}

function annulus(rIn, rOut) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, TAU, false);
  shape.holes.push(circlePath(0, 0, rIn, true));
  return shape;
}

function sector(rIn, rOut, span) {
  const points = [];
  const n = 16;
  for (let i = 0; i <= n; i++) points.push(dir(-span / 2 + (span * i) / n, rOut));
  for (let i = n; i >= 0; i--) points.push(dir(-span / 2 + (span * i) / n, rIn));
  return new THREE.Shape(points);
}

/** Wedge planes in world space around the axis through `centre`. */
function wedgePlanes() {
  const n1 = new THREE.Vector3(0, Math.sin(WEDGE.from), -Math.cos(WEDGE.from));
  const n2 = new THREE.Vector3(0, -Math.sin(WEDGE.to), Math.cos(WEDGE.to));
  return [new THREE.Plane(n1, 0), new THREE.Plane(n2, 0)];
}

// ---------- stator ----------

function statorShape() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, STACK.outer, 0, TAU, false);
  const hole = [];
  const pitch = TAU / MOTOR.slots;
  const shoeHalf = (STACK.bore * pitch - 0.004) / 2; // 4 mm slot opening at the bore
  const yokeAt = Math.sqrt(STACK.yoke ** 2 - TOOTH_HALF ** 2);
  const at = (a, radial, side) => {
    const u = dir(a);
    const v = tangent(a);
    return new THREE.Vector2(u.x * radial + v.x * side, u.y * radial + v.y * side);
  };
  for (let k = 0; k < MOTOR.slots; k++) {
    const a = k * pitch;
    hole.push(at(a, yokeAt, -TOOTH_HALF), at(a, STACK.shoe, -TOOTH_HALF), at(a, STACK.shoe, -shoeHalf));
    const half = shoeHalf / STACK.bore;
    for (let i = 0; i <= 6; i++) hole.push(dir(a - half + (2 * half * i) / 6, STACK.bore));
    hole.push(at(a, STACK.shoe, shoeHalf), at(a, STACK.shoe, TOOTH_HALF), at(a, yokeAt, TOOTH_HALF));
    // Along the yoke to the next tooth.
    const a0 = a + Math.asin(TOOTH_HALF / STACK.yoke);
    const a1 = a + pitch - Math.asin(TOOTH_HALF / STACK.yoke);
    for (let i = 1; i < 8; i++) hole.push(dir(a0 + ((a1 - a0) * i) / 8, STACK.yoke));
  }
  shape.holes.push(new THREE.Path(hole));
  return shape;
}

function coilGeometry() {
  const w = TOOTH_HALF + COIL.side;
  const l = STACK.length / 2 + COIL.side;
  const shape = roundedRect(new THREE.Shape(), -w, -l, w, l, COIL.side);
  shape.holes.push(roundedRect(new THREE.Path(), -TOOTH_HALF - 0.0002, -STACK.length / 2 - 0.0002, TOOTH_HALF + 0.0002, STACK.length / 2 + 0.0002, 0.0015));
  return extrude(shape, COIL.depth, { from: COIL.inner, curveSegments: 8 });
}

// ---------- rotor ----------

function buildRotor(m) {
  const rotor = new THREE.Group();
  const turning = new THREE.Group();
  rotor.add(turning);
  turning.add(mesh(cylinderX(ROTOR.core, STACK.length, 64), m.rotorCore));
  const magnet = slabX(sector(ROTOR.core, ROTOR.outer, ROTOR.span), -ROTOR.length / 2, ROTOR.length / 2 - 0.0015, 16);
  const paint = slabX(sector(ROTOR.core + 0.0005, ROTOR.outer - 0.0005, ROTOR.span - 2 * DEG), ROTOR.length / 2 - 0.0015, ROTOR.length / 2, 16);
  for (let k = 0; k < MOTOR.poles; k++) {
    const a = (k * TAU) / MOTOR.poles;
    const piece = new THREE.Group();
    piece.rotation.x = a;
    piece.add(mesh(magnet, m.magnet));
    piece.add(mesh(paint, k % 2 === 0 ? m.paintRed : m.paintBlue)); // north red, south blue
    turning.add(piece);
  }
  // End plates. The balance holes and a white dot are not symmetric, so the rotation reads at any speed.
  const plate = annulus(0.026, ROTOR.core - 0.001);
  for (const [a, r] of [[20, 0.046], [55, 0.046], [200, 0.05]]) {
    const p = dir(a * DEG, r);
    plate.holes.push(circlePath(p.x, p.y, 0.005, true));
  }
  for (const s of [-1, 1]) {
    const p = mesh(slabX(plate, -0.002, 0.002), m.aluminiumDark);
    p.position.x = s * (STACK.length / 2 + 0.002);
    turning.add(p);
  }
  const dot = mesh(cylinderX(0.004, 0.001, 16), m.ceramic);
  dot.position.set(STACK.length / 2 + 0.0045, 0.055, 0);
  turning.add(dot);
  const shaft = mesh(cylinderX(0.025, 0.4, 40), m.polished);
  shaft.position.x = 0.05;
  turning.add(shaft);
  const key = mesh(new THREE.BoxGeometry(0.04, 0.006, 0.008), m.forged);
  key.position.set(0.22, 0.025, 0);
  turning.add(key);
  rotor.add(pickVolume(cylinderX(0.072, 0.16, 16), 'rotor'));
  const shaftPick = pickVolume(cylinderX(0.03, 0.17, 12), 'rotor');
  shaftPick.position.x = 0.165;
  rotor.add(shaftPick);
  return { rotor, turning };
}

// ---------- housing, shields, cradle ----------

function buildHousing(m, cut) {
  const group = new THREE.Group();
  const alu = cut(m.housing);
  // Water jacket: two shells with the coolant channel between them, closed at both ends.
  group.add(mesh(slabX(annulus(0.12, HOUSING.outer), -0.084, 0.084, 96), alu));
  group.add(mesh(slabX(annulus(HOUSING.inner, 0.114), -0.084, 0.084, 96), alu));
  for (const s of [-1, 1]) {
    const end = mesh(slabX(annulus(HOUSING.inner, HOUSING.outer), -0.003, 0.003, 96), alu);
    end.position.x = s * 0.087;
    group.add(end);
  }
  // Stiffening bands round the outside.
  for (const x of [-0.065, 0, 0.065]) {
    const band = mesh(slabX(annulus(HOUSING.outer - 0.001, 0.13), -0.004, 0.004, 96), alu);
    band.position.x = x;
    group.add(band);
  }
  // Coolant ports on the back.
  for (const x of [-0.05, 0.05]) {
    const port = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 20), m.housing);
    port.position.set(x, 0.07, -0.118);
    port.rotation.x = -60 * DEG;
    group.add(port);
  }
  return group;
}

function buildShield(m, cut, side) {
  const shield = new THREE.Group();
  shield.add(mesh(slabX(annulus(0.026, HOUSING.outer), -0.006, 0.006, 96), cut(m.housing)));
  const boss = mesh(slabX(annulus(0.036, 0.046), side > 0 ? 0 : -0.03, side > 0 ? 0.03 : 0, 48), cut(m.housing));
  boss.position.x = side * 0.006;
  shield.add(boss);
  // Sealed ball bearing: outer race, seal, inner race.
  const bearing = new THREE.Group();
  bearing.add(mesh(ringX(0.032, 0.036, 0.016, 48), cut(m.polished)));
  bearing.add(mesh(ringX(0.0275, 0.032, 0.014, 48), cut(m.rubber)));
  bearing.add(mesh(ringX(0.025, 0.0275, 0.016, 48), cut(m.polished)));
  bearing.position.x = side * 0.014;
  shield.add(bearing);
  const bolt = new THREE.CylinderGeometry(0.0045, 0.0045, 0.005, 6);
  bolt.rotateZ(Math.PI / 2);
  const nickel = cut(m.nickel);
  for (let i = 0; i < 8; i++) {
    const p = dir(((i + 0.5) / 8) * TAU, 0.118);
    const b = mesh(bolt, nickel);
    b.position.set(side * 0.0085, p.y, -p.x);
    shield.add(b);
  }
  shield.position.x = side * 0.096;
  return shield;
}

function buildCradle(m) {
  const group = new THREE.Group();
  const y0 = -MOTOR_LAYOUT.position.y;
  const saddle = new THREE.Shape();
  saddle.moveTo(-0.1, y0);
  saddle.lineTo(0.1, y0);
  saddle.lineTo(0.1, -0.078);
  saddle.absarc(0, 0, 0.127, Math.atan2(-0.078, 0.1), Math.atan2(-0.078, -0.1), true);
  saddle.lineTo(-0.1, y0);
  const geometry = slabX(saddle, -0.015, 0.015);
  for (const x of [-0.032, 0.032]) { // between the bands
    const s = mesh(geometry, m.powder);
    s.position.x = x;
    group.add(s);
  }
  const base = mesh(new THREE.BoxGeometry(0.2, 0.01, 0.22), m.powder);
  base.position.y = y0 + 0.005;
  group.add(base);
  return group;
}

// ---------- terminal box, cables, inverter ----------

function buildPower(m) {
  const group = new THREE.Group();
  const angle = -40 * DEG; // up and to the back, outside the cut wedge
  const box = new THREE.Group();
  box.rotation.x = angle;
  const body = mesh(new THREE.BoxGeometry(0.07, 0.035, 0.06), m.housing);
  body.position.y = HOUSING.outer + 0.0165;
  box.add(body);
  const lid = mesh(new THREE.BoxGeometry(0.074, 0.004, 0.064), m.powder);
  lid.position.y = HOUSING.outer + 0.036;
  box.add(lid);
  group.add(box);
  const y0 = -MOTOR_LAYOUT.position.y;
  const inverterZ = -0.3;
  const inverterFront = inverterZ + 0.08;
  // Three phase cables from the glands on the back of the box, down into the front of the inverter.
  const up = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle));
  const back = new THREE.Vector3(0, Math.sin(angle), -Math.cos(angle));
  const glandGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 16);
  for (const [i, x] of [-0.022, 0, 0.022].entries()) {
    const gland = up.clone().multiplyScalar(HOUSING.outer + 0.016).addScaledVector(back, 0.034);
    gland.x = x;
    const g = mesh(glandGeometry, m.plastic);
    g.position.copy(gland);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), back);
    group.add(g);
    const start = gland.clone().addScaledVector(back, 0.006);
    const end = new THREE.Vector3(x * 2.5, y0 + 0.05, inverterFront + 0.012);
    const curve = new THREE.CatmullRomCurve3([
      start,
      start.clone().addScaledVector(back, 0.05),
      new THREE.Vector3(x * 1.8, y0 + 0.13 - i * 0.004, inverterFront + 0.07),
      new THREE.Vector3(x * 2.5, y0 + 0.07, inverterFront + 0.03),
      end,
    ]);
    group.add(mesh(new THREE.TubeGeometry(curve, 48, 0.0065, 12), m.hvCable));
    const socket = mesh(glandGeometry, m.plastic);
    socket.rotation.x = Math.PI / 2;
    socket.position.set(end.x, end.y, inverterFront + 0.004);
    group.add(socket);
  }
  // Inverter: powder-coated case with a finned lid, and a status light.
  const inverter = new THREE.Group();
  const caseMesh = mesh(new RoundedCase(0.26, 0.08, 0.16), m.powder);
  caseMesh.position.y = y0 + 0.04;
  inverter.add(caseMesh);
  for (let i = 0; i < 11; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.003, 0.012, 0.13), m.aluminiumDark);
    fin.position.set(-0.1 + i * 0.02, y0 + 0.086, 0);
    inverter.add(fin);
  }
  const ledMaterial = new THREE.MeshBasicNodeMaterial();
  const green = color(0x3fb950).mul(2.5);
  ledMaterial.colorNode = green;
  ledMaterial.mrtNode = mrt({ emissive: vec4(green, 1) });
  const led = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 16).rotateX(Math.PI / 2), ledMaterial);
  led.position.set(0.1, y0 + 0.06, 0.081);
  inverter.add(led);
  inverter.position.z = inverterZ;
  // DC supply: two heavy cables from the back of the inverter into the plinth.
  for (const x of [-0.06, 0.06]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y0 + 0.04, inverterZ - 0.08),
      new THREE.Vector3(x, y0 + 0.035, inverterZ - 0.11),
      new THREE.Vector3(x, y0 + 0.004, inverterZ - 0.12),
      new THREE.Vector3(x, y0 - 0.02, inverterZ - 0.12),
    ]);
    group.add(mesh(new THREE.TubeGeometry(curve, 24, 0.009, 12), m.hvCable));
  }
  group.add(inverter);
  const inverterPick = pickVolume(new THREE.BoxGeometry(0.27, 0.1, 0.17), 'inverter');
  inverterPick.position.set(0, y0 + 0.05, inverterZ);
  group.add(inverterPick);
  const cablesPick = pickVolume(new THREE.BoxGeometry(0.14, 0.26, 0.14), 'cables');
  cablesPick.position.set(0, 0.0, -0.16);
  group.add(cablesPick);
  return group;
}

/** A box with rounded vertical edges. */
class RoundedCase extends THREE.BufferGeometry {
  constructor(w, h, d) {
    super();
    const shape = roundedRect(new THREE.Shape(), -w / 2, -d / 2, w / 2, d / 2, 0.012);
    const g = extrude(shape, h, { from: 0, bevel: 0.003, curveSegments: 6 });
    g.rotateX(Math.PI / 2);
    g.translate(0, h / 2, 0);
    this.copy(g);
  }
}

// ---------- assembly ----------

export function buildMotor(m, environment) {
  const root = new THREE.Group();
  root.position.copy(MOTOR_LAYOUT.position);
  const planes = wedgePlanes();
  const sections = new Map(); // one sectioned copy per material: each copy is a shader to compile
  const cut = (material) => {
    if (!sections.has(material)) sections.set(material, sectioned(material, planes));
    return sections.get(material);
  };
  const clip = new THREE.ClippingGroup();
  clip.clippingPlanes = planes;
  clip.clipIntersection = true;

  const stator = new THREE.Group();
  stator.add(mesh(slabX(statorShape(), -STACK.length / 2, STACK.length / 2, 12), cut(m.lamination)));
  // Coils: the teeth take the phases A, B, C in turn; each phase shares one current.
  const currents = [uniform(0), uniform(0), uniform(0)];
  const level = uniform(0);
  const windings = currents.map((c) => cut(windingMaterial(c, level, environment)));
  const coil = coilGeometry();
  const basis = new THREE.Matrix4();
  const x = new THREE.Vector3(1, 0, 0);
  for (let k = 0; k < MOTOR.slots; k++) {
    const a = (k * TAU) / MOTOR.slots;
    const t = new THREE.Vector3(0, -Math.sin(a), Math.cos(a));
    const r = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
    const c = mesh(coil, windings[k % 3]);
    c.quaternion.setFromRotationMatrix(basis.makeBasis(t, x, r));
    stator.add(c);
  }
  // Copper busbar rings that join the coils of each phase, at the back end.
  const busbar = slabX(annulus(0.086, 0.098), -0.00125, 0.00125, 96);
  for (const [i, bx] of [-0.082, -0.0848, -0.0876].entries()) {
    const b = mesh(busbar, cut(m.copper));
    b.position.x = bx;
    b.userData.phase = i;
    stator.add(b);
  }
  clip.add(stator);
  const housing = buildHousing(m, cut);
  clip.add(housing);
  const front = buildShield(m, cut, 1);
  const rear = buildShield(m, cut, -1);
  // Resolver under a cover behind the rear shield.
  const resolver = mesh(lathe([[0, 0], [0.045, 0], [0.045, 0.02], [0.04, 0.03], [0, 0.032]], 48), cut(m.housing));
  resolver.rotation.z = Math.PI / 2;
  resolver.position.x = -0.036;
  rear.add(resolver);
  clip.add(front, rear);

  const { rotor, turning } = buildRotor(m);
  const cradle = buildCradle(m);
  const power = buildPower(m);
  const stage = (...objects) => {
    const wrapper = new THREE.Group();
    wrapper.add(...objects);
    root.add(wrapper);
    return wrapper;
  };
  const stages = { stator: stage(clip, cradle), rotor: stage(rotor), power: stage(power) };

  for (const [volume, part] of [
    [cylinderX(0.131, 0.2, 24), 'housing'],
    [cylinderX(0.111, 0.14, 24), 'stator'],
    [cylinderX(0.095, 0.165, 24), 'coil'],
  ]) {
    const pick = pickVolume(volume, part);
    pick.userData.clip = planes;
    pick.userData.clipIntersection = true;
    pick.material.side = THREE.DoubleSide;
    clip.add(pick);
  }
  const pickables = [];
  root.traverse((o) => { if (o.userData.part) pickables.push(o); });

  const explodeList = [
    [front, [0.18, 0, 0]],
    [rotor, [0.3, 0, 0]],
    [rear, [-0.12, 0, 0]],
  ].map(([object, offset]) => ({ object, base: object.position.clone(), offset: new THREE.Vector3(...offset) }));

  const centre = new THREE.Vector3();
  function update(rotorAngle, { torqueFraction, explode }) {
    for (const { object, base, offset } of explodeList) object.position.copy(base).addScaledVector(offset, explode);
    turning.rotation.x = rotorAngle;
    for (let p = 0; p < 3; p++) currents[p].value = toothCurrent(p, rotorAngle);
    level.value = torqueFraction * (1 - explode);
    // The wedge follows the stator when it moves (the intro drops it in).
    clip.getWorldPosition(centre);
    for (const plane of planes) plane.constant = -plane.normal.dot(centre);
  }

  return {
    root, pickables, update, stages,
  };
}

export const MOTOR_POINTS = {
  // Local point for the pinned chip, which sits above it: over the housing.
  label: new THREE.Vector3(0.02, 0.15, 0.03),
};
