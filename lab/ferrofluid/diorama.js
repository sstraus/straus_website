// The set: studio sweep, anodised base plate, electromagnet with enamelled windings,
// glass petri dish, retort stand with a swivel arm and an NdFeB magnet, bench power
// supply with the current knob, routed test leads. Units: centimetres.
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  uniform, color, mix, float, vec2, vec3, uv, smoothstep, positionWorld, positionLocal,
  mx_noise_float,
} from 'three/tsl';
import { BENCH, STAND } from './rig.js';

export const LAYOUT = {
  ...BENCH,
  dishFloor: BENCH.coilTop + 0.15, // top of the glass bottom
  magnetRadius: 1.0, // NdFeB puck, 20 mm across
  magnetThickness: 1.5,
  supply: new THREE.Vector3(15.5, 0, 4.5),
  supplyAngle: 0.28, // the front panel faces the hero camera
};

// 20 layers of 43 turns of 1.4 mm wire on a 5.4 cm core: about 224 m of copper.
export const COIL = { turns: 860, wireMm: 1.4, ohms: 2.5 };
// Winding cross-section, cm. The field lines of the cutaway are traced for exactly these loops.
export const WINDING = { rIn: 2.9, rOut: 5.57, y0: 0.65, y1: LAYOUT.coilTop - 0.65 };

const KNOB_SWEEP = Math.PI * 1.5;
const KNOB_START = Math.PI / 2 + KNOB_SWEEP / 2;
const TERMINAL_ANGLE = 0.95; // azimuth of the coil terminal block, towards the supply
const CUT_START = -0.5; // azimuth of the fixed face of the cutaway wedge
const CUT_OPEN = 1.6; // wedge angle when fully open, radians: it faces the hero camera

const PALETTE = {
  blue: new THREE.Color(0x58a6ff),
  orange: new THREE.Color(0xffa657),
};

function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// ---------- geometry helpers ----------

// Closed lathe cross-section with rounded corners. corners: [r, y, bevel] in travel order
// (out along the bottom, up the outside, in across the top, down the inside), so normals face out.
function roundedProfile(corners, steps = 4) {
  const n = corners.length;
  const first = corners[0];
  const last = corners[n - 1];
  const start = new THREE.Vector2((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
  const points = [start];
  for (let i = 0; i < n; i++) {
    const [px, py, b] = corners[i];
    if (!b) { points.push(new THREE.Vector2(px, py)); continue; }
    const [ax, ay] = corners[(i + n - 1) % n];
    const [bx, by] = corners[(i + 1) % n];
    const ul = Math.hypot(ax - px, ay - py);
    const vl = Math.hypot(bx - px, by - py);
    const ux = (ax - px) / ul, uy = (ay - py) / ul;
    const vx = (bx - px) / vl, vy = (by - py) / vl;
    const cx = px + b * (ux + vx), cy = py + b * (uy + vy);
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * (Math.PI / 2);
      points.push(new THREE.Vector2(cx - b * (vx * Math.cos(t) + ux * Math.sin(t)), cy - b * (vy * Math.cos(t) + uy * Math.sin(t))));
    }
  }
  points.push(start.clone());
  return points;
}

function lathe(corners, segments = 64, steps = 4) {
  return new THREE.LatheGeometry(roundedProfile(corners, steps), segments);
}

/** A bevelled ring (rIn > 0) or disc (rIn = 0) of height h, sitting on y = 0. */
function ring(rIn, rOut, h, bevel, segments = 64) {
  const inner = rIn > 0 ? bevel : 0;
  return lathe([[rOut, 0, bevel], [rOut, h, bevel], [rIn, h, inner], [rIn, 0, inner]], segments);
}

class Helix extends THREE.Curve {
  constructor(radius, y0, pitch, turns, phase) {
    super();
    Object.assign(this, { radius, y0, pitch, turns, phase });
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = this.phase + t * this.turns * Math.PI * 2;
    return target.set(Math.sin(a) * this.radius, this.y0 + t * this.turns * this.pitch, Math.cos(a) * this.radius);
  }
}

function polar(r, angle, y) {
  return new THREE.Vector3(Math.sin(angle) * r, y, Math.cos(angle) * r);
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

// ---------- materials ----------

function materials() {
  const noise = (scale) => mx_noise_float(positionWorld.mul(scale));

  const floor = new THREE.MeshStandardNodeMaterial({ color: 0x0e131a, roughness: 0.9 });
  floor.roughnessNode = float(0.86).add(noise(0.06).mul(0.1));

  // Dark anodised aluminium, brushed along x.
  const base = new THREE.MeshStandardNodeMaterial({ color: 0x1c212a, metalness: 0.85 });
  const brush = noise(vec3(0.12, 7, 11));
  base.roughnessNode = float(0.34).add(brush.mul(0.07));
  base.colorNode = color(0x1c212a).mul(brush.mul(0.1).add(1));

  // Glass-filled nylon bobbin.
  const bobbin = new THREE.MeshPhysicalNodeMaterial({ color: 0x101217, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.22 });

  // Enamelled magnet wire: copper under a thin glossy polyurethane coat.
  const enamel = new THREE.MeshPhysicalNodeMaterial({ color: 0xc0632f, metalness: 1, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.05 });
  enamel.roughnessNode = float(0.22).add(noise(vec3(3, 40, 3)).mul(0.05));
  const innerCopper = new THREE.MeshStandardNodeMaterial({ color: 0x6e3417, metalness: 1, roughness: 0.45 });

  const steel = new THREE.MeshStandardNodeMaterial({ color: 0xc4cad3, metalness: 1, roughness: 0.2 });
  // Turned steel: fine concentric tool marks on the pole face.
  const turned = new THREE.MeshStandardNodeMaterial({ color: 0xbfc5ce, metalness: 1 });
  turned.roughnessNode = float(0.16).add(mx_noise_float(vec3(positionLocal.xz.length().mul(60), 0, 0)).mul(0.08));
  const darkSteel = new THREE.MeshStandardNodeMaterial({ color: 0x2c323c, metalness: 1, roughness: 0.34 });
  const blackOxide = new THREE.MeshStandardNodeMaterial({ color: 0x17191d, metalness: 0.8, roughness: 0.32 });
  const brass = new THREE.MeshStandardNodeMaterial({ color: 0xd8a657, metalness: 1, roughness: 0.22 });
  const tin = new THREE.MeshStandardNodeMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.3 });
  const nickel = new THREE.MeshPhysicalNodeMaterial({ color: 0xe3e6ec, metalness: 1, roughness: 0.07, clearcoat: 0.3 });

  // Hammertone paint on the cast stand foot.
  const hammertone = new THREE.MeshPhysicalNodeMaterial({ color: 0x252a32, metalness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  hammertone.roughnessNode = float(0.45).add(noise(2.2).mul(0.18));

  // Powder-coated supply cover.
  const powder = new THREE.MeshStandardNodeMaterial({ color: 0x2a3039, metalness: 0.2 });
  powder.roughnessNode = float(0.62).add(noise(9).mul(0.08));

  const plastic = new THREE.MeshPhysicalNodeMaterial({ color: 0x121419, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  const rubber = new THREE.MeshStandardNodeMaterial({ color: 0x0c0d10, roughness: 0.78 });
  const red = new THREE.MeshPhysicalNodeMaterial({ color: 0xb8231d, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.25 });
  const black = new THREE.MeshPhysicalNodeMaterial({ color: 0x141518, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.25 });
  const ptfe = new THREE.MeshStandardNodeMaterial({ color: 0xe6e1d6, roughness: 0.6 });
  const ink = new THREE.MeshPhysicalNodeMaterial({ color: 0x020203, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 });

  // Borosilicate glass with real transmission: refracts the fluid and the coil behind it.
  const glass = new THREE.MeshPhysicalNodeMaterial({
    color: 0xffffff, roughness: 0.015, metalness: 0, transmission: 1, thickness: 0.15, ior: 1.47,
    attenuationColor: 0xe4f2ee, attenuationDistance: 6, side: THREE.FrontSide, depthWrite: false,
    specularIntensity: 1, envMapIntensity: 1.2,
  });

  // Accent lights follow one uniform: the coil power in [0, 1].
  const power = uniform(0);
  const glow = new THREE.MeshStandardNodeMaterial({ color: 0x000000, roughness: 0.4 });
  glow.emissiveNode = mix(color(PALETTE.blue).mul(0.6), color(PALETTE.orange).mul(5), power).mul(power.mul(0.85).add(0.15));
  // The plinth line is a faint constant accent: at the frame edge a bright one blooms into a streak.
  const strip = new THREE.MeshStandardNodeMaterial({ color: 0x000000, roughness: 0.4 });
  strip.emissiveNode = color(PALETTE.blue).mul(0.1);

  return {
    floor, base, bobbin, enamel, innerCopper, steel, turned, darkSteel, blackOxide, brass, tin, nickel,
    hammertone, powder, plastic, rubber, red, black, ptfe, ink, glass, glow, strip, power,
  };
}

// ---------- parts ----------

function buildStudio(m) {
  const group = new THREE.Group();
  const floor = mesh(new THREE.CircleGeometry(160, 64), m.floor, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.6;
  group.add(floor);

  // A curved cyclorama behind the set, like a product photo sweep.
  const sweepMaterial = m.floor.clone();
  sweepMaterial.side = THREE.BackSide;
  const sweep = mesh(new THREE.CylinderGeometry(90, 90, 90, 64, 1, true, -Math.PI * 0.9, Math.PI * 0.8), sweepMaterial, { cast: false });
  sweep.position.set(0, 43, 10);
  group.add(sweep);

  const base = mesh(new RoundedBoxGeometry(48, 1.6, 30, 5, 0.5), m.base);
  base.position.set(4, -0.8, 1);
  group.add(base);

  // A thin light line along the front edge of the plinth.
  const strip = mesh(new THREE.BoxGeometry(46, 0.08, 0.08), m.strip, { cast: false, receive: false });
  strip.position.set(4, -0.9, 16.05);
  group.add(strip);
  return group;
}

function socketScrew(m, headRadius = 0.2) {
  const screw = new THREE.Group();
  screw.add(mesh(ring(0, headRadius, headRadius * 0.9, headRadius * 0.18, 24), m.blackOxide));
  const socket = mesh(new THREE.CylinderGeometry(headRadius * 0.45, headRadius * 0.45, 0.02, 6), m.rubber, { cast: false });
  socket.position.y = headRadius * 0.9 + 0.005;
  screw.add(socket);
  return screw;
}

function coilLabel() {
  return canvasTexture(1024, 256, (ctx) => {
    ctx.fillStyle = '#16191f';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#ffa657';
    ctx.fillRect(0, 0, 1024, 14);
    ctx.fillStyle = '#e6edf3';
    ctx.font = '700 64px "JetBrains Mono", monospace';
    ctx.fillText('ELECTROMAGNET', 48, 104);
    ctx.fillStyle = '#8b949e';
    ctx.font = '500 34px "JetBrains Mono", monospace';
    ctx.fillText(`${COIL.turns} T · Ø${COIL.wireMm} mm Cu · ${COIL.ohms} Ω · 3 A MAX`, 48, 168);
    ctx.fillText('SOFT IRON CORE Ø54 · LAB 07', 48, 216);
  });
}

// Flat section faces of the cutaway, built in the plane at azimuth 0 (the +z half-plane).
// rects: [rIn, rOut, y0, y1]; uv = (r, y) in cm. `facing` +1: normal towards +azimuth, -1: towards -azimuth.
function sectionGeometry(rects, facing) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const index = [];
  for (const [r0, r1, y0, y1] of rects) {
    const base = positions.length / 3;
    for (const [r, y] of [[r0, y0], [r1, y0], [r1, y1], [r0, y1]]) {
      positions.push(0, y, r);
      normals.push(facing, 0, 0); // d(azimuth) at azimuth 0 is +x
      uvs.push(r, y);
    }
    // (A, B, C) winds towards -azimuth.
    if (facing < 0) index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

function sectionMaterials(m) {
  const core = m.turned.clone();
  core.side = THREE.DoubleSide;
  const bobbin = m.bobbin.clone();
  bobbin.side = THREE.DoubleSide;
  // Cut through the winding: rows of copper wire in their enamel and varnish, orthocyclic packing.
  const winding = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const cell = uv().div(COIL.wireMm / 10);
  const row = cell.y.floor();
  const local = vec2(cell.x.add(row.mod(2).mul(0.5)), cell.y).fract().sub(0.5);
  const wireMask = smoothstep(0.47, 0.4, local.length());
  winding.colorNode = mix(color(0x2a1408), color(0xd27a43), wireMask);
  winding.metalnessNode = wireMask;
  winding.roughnessNode = mix(float(0.75), float(0.28), wireMask);
  return { core, bobbin, winding };
}

function buildCoil(m) {
  const group = new THREE.Group();
  const { coilTop } = LAYOUT;
  const flange = 0.6;
  const windingBottom = WINDING.y0;
  const windingTop = WINDING.y1;

  // Everything that the cutaway opens sits in a clipping group with two planes through the axis.
  const cut = new THREE.ClippingGroup();
  cut.clipIntersection = true;
  const planeFixed = new THREE.Plane(new THREE.Vector3(-Math.cos(CUT_START), 0, Math.sin(CUT_START)), 0);
  const planeMoving = new THREE.Plane(new THREE.Vector3(Math.cos(CUT_START), 0, -Math.sin(CUT_START)), 0);
  cut.clippingPlanes = [planeFixed, planeMoving];
  group.add(cut);

  // Soft iron core with a turned pole face, flush with the top flange.
  const core = mesh(ring(0, 2.7, coilTop, 0.12, 72), m.turned);
  cut.add(core);

  // Bobbin: two bevelled flanges and the tube between them.
  for (const y of [0, coilTop - flange]) {
    const disc = mesh(ring(2.72, 6.3, flange, 0.12, 128), m.bobbin);
    disc.position.y = y;
    cut.add(disc);
  }

  // Section faces. Closed, both sit inside the solid coil and cannot be seen.
  const sm = sectionMaterials(m);
  const sections = { core: [[0, 2.7, 0, coilTop]], bobbin: [[2.72, 6.3, 0, flange], [2.72, 6.3, coilTop - flange, coilTop], [2.72, WINDING.rIn, flange, coilTop - flange]], winding: [[WINDING.rIn, WINDING.rOut, windingBottom, windingTop]] };
  const faceFixed = new THREE.Group();
  const faceMoving = new THREE.Group();
  for (const [name, rects] of Object.entries(sections)) {
    faceFixed.add(mesh(sectionGeometry(rects, 1), sm[name], { cast: false }));
    faceMoving.add(mesh(sectionGeometry(rects, -1), sm[name], { cast: false }));
  }
  faceFixed.rotation.y = CUT_START;
  faceMoving.rotation.y = CUT_START;
  group.add(faceFixed, faceMoving);

  /** Open the wedge: 0 = closed coil, 1 = a quarter of it removed towards the camera. */
  function setCut(amount) {
    const angle = CUT_START + amount * CUT_OPEN;
    planeMoving.normal.set(Math.cos(angle), 0, -Math.sin(angle));
    faceMoving.rotation.y = angle;
  }

  // Inner layers, seen only between the turns of the outer layer.
  const body = mesh(new THREE.CylinderGeometry(5.5, 5.5, windingTop - windingBottom, 96, 1, true), m.innerCopper);
  body.position.y = (windingTop + windingBottom) / 2;
  cut.add(body);

  // Outer layer: one continuous helix of enamelled wire, pitch = wire diameter.
  const wire = COIL.wireMm / 10;
  // The fraction of a turn is chosen so the wire ends next to the terminal block.
  const turns = Math.floor((windingTop - windingBottom - wire) / wire) + 0.05;
  const phase = TERMINAL_ANGLE - 0.15;
  const helix = new Helix(5.5 + wire / 2, windingBottom + wire / 2, wire, turns, phase);
  cut.add(mesh(new THREE.TubeGeometry(helix, Math.round(turns * 56), wire / 2, 8, false), m.enamel));

  // Finish lead: out under the top flange, down the outside in a PTFE sleeve, into the terminal block.
  const end = helix.getPoint(1);
  const endAngle = phase + turns * Math.PI * 2;
  const blockRadius = 7.2;
  const lead = new THREE.CatmullRomCurve3([
    end,
    polar(6.1, endAngle, end.y),
    polar(6.55, endAngle - 0.02, end.y - 0.4),
    polar(6.6, TERMINAL_ANGLE + 0.12, 3.2),
    polar(6.65, TERMINAL_ANGLE + 0.1, 1.3),
    polar(blockRadius - 0.6, TERMINAL_ANGLE + 0.1, 0.75),
  ]);
  group.add(mesh(new THREE.TubeGeometry(lead, 90, 0.13, 10), m.ptfe));
  // Start lead leaves over the bottom flange.
  const start = helix.getPoint(0);
  const startLead = new THREE.CatmullRomCurve3([
    start,
    polar(6.0, phase, start.y),
    polar(6.5, TERMINAL_ANGLE - 0.1, 0.8),
    polar(blockRadius - 0.6, TERMINAL_ANGLE - 0.1, 0.75),
  ]);
  group.add(mesh(new THREE.TubeGeometry(startLead, 40, 0.13, 10), m.ptfe));

  // Printed label wrapped around the winding, facing the hero camera.
  const labelMaterial = new THREE.MeshPhysicalNodeMaterial({ map: coilLabel(), roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const labelArc = 1.25;
  const label = mesh(new THREE.CylinderGeometry(5.68, 5.68, 1.6, 64, 1, true, 0.4 - labelArc / 2, labelArc), labelMaterial);
  label.position.y = 3.6;
  cut.add(label);

  // Cap screws: six hold the top flange, four fix the bobbin to the plate.
  for (let i = 0; i < 6; i++) {
    const s = socketScrew(m);
    s.position.copy(polar(5.6, (i / 6) * Math.PI * 2 + 0.26, coilTop));
    cut.add(s);
  }
  for (let i = 0; i < 4; i++) {
    const s = socketScrew(m, 0.18);
    s.position.copy(polar(5.95, (i / 4) * Math.PI * 2 + Math.PI / 4, flange));
    cut.add(s);
  }

  // Terminal block with two brass screw terminals.
  const block = new THREE.Group();
  block.position.copy(polar(blockRadius, TERMINAL_ANGLE, 0));
  block.rotation.y = TERMINAL_ANGLE;
  const housing = mesh(new RoundedBoxGeometry(2.6, 1.1, 1.5, 3, 0.18), m.plastic);
  housing.position.y = 0.55;
  block.add(housing);
  const terminals = [];
  [-0.65, 0.65].forEach((x) => {
    const head = mesh(ring(0, 0.3, 0.22, 0.05, 32), m.brass);
    head.position.set(x, 1.1, 0.1);
    block.add(head);
    const slot = mesh(new THREE.BoxGeometry(0.46, 0.05, 0.07), m.rubber, { cast: false });
    slot.position.set(x, 1.33, 0.1);
    slot.rotation.y = 0.5;
    block.add(slot);
    // Tinned ring lug of the test lead under the screw head.
    const lug = mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 32), m.tin);
    lug.rotation.x = Math.PI / 2;
    lug.position.set(x, 1.12, 0.1);
    block.add(lug);
    const tongue = mesh(new THREE.BoxGeometry(0.28, 0.06, 0.6), m.tin);
    tongue.position.set(x, 1.12, 0.62);
    block.add(tongue);
    terminals.push(new THREE.Vector3(x, 1.12, 0.95));
  });
  group.add(block);
  block.updateMatrixWorld();
  return { group, setCut, terminals: terminals.map((t) => block.localToWorld(t)) };
}

function buildDish(m) {
  const group = new THREE.Group();
  const { dishRadius, coilTop, dishFloor, fluidLevel } = LAYOUT;
  const wall = 0.15;
  const height = 1.35;
  const glass = mesh(lathe([
    [dishRadius + wall, 0, 0.12], [dishRadius + wall, height, 0.07], [dishRadius, height, 0.07],
    [dishRadius, dishFloor - coilTop, 0.08], [0, dishFloor - coilTop, 0], [0, 0, 0],
  ], 128, 5), m.glass, { cast: false, receive: false });
  glass.position.y = coilTop;
  glass.renderOrder = 2;
  group.add(glass);
  // The side of the fluid layer, seen through the glass.
  const depth = fluidLevel - dishFloor;
  const body = mesh(new THREE.CylinderGeometry(dishRadius - 0.01, dishRadius - 0.01, depth, 128, 1, true), m.ink);
  body.position.y = dishFloor + depth / 2;
  group.add(body);
  return group;
}

function thumbScrew(m) {
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), m.steel);
  stem.rotation.z = Math.PI / 2;
  stem.position.x = 0.3;
  g.add(stem);
  const wing = mesh(new RoundedBoxGeometry(0.25, 1.1, 0.5, 2, 0.08), m.blackOxide);
  wing.position.x = 0.7;
  g.add(wing);
  return g;
}

function buildStand(m) {
  const group = new THREE.Group();
  const { rodX, rodZ, armY, armLength, holderHeight, magnetRodLength } = STAND;
  const { magnetRadius, magnetThickness } = LAYOUT;

  const foot = mesh(new RoundedBoxGeometry(10, 1.0, 7, 4, 0.35), m.hammertone);
  foot.position.set(rodX - 0.5, 0.5, rodZ - 1);
  group.add(foot);
  const nut = mesh(ring(0.4, 0.75, 0.35, 0.06, 6), m.steel);
  nut.position.set(rodX, 1.0, rodZ);
  group.add(nut);
  const rod = mesh(ring(0, 0.4, 27, 0.12, 32), m.steel);
  rod.position.set(rodX, 1.0, rodZ);
  group.add(rod);

  // Swivel arm: boss head on the rod, arm, sliding carriage.
  const arm = new THREE.Group();
  arm.position.set(rodX, armY, rodZ);
  const boss = mesh(new RoundedBoxGeometry(1.9, 1.9, 1.9, 3, 0.25), m.darkSteel);
  arm.add(boss);
  const bossScrew = thumbScrew(m);
  bossScrew.rotation.y = Math.PI / 2;
  bossScrew.position.z = 0.95;
  arm.add(bossScrew);
  const bar = mesh(new THREE.CapsuleGeometry(0.3, armLength - 0.3, 6, 24), m.steel);
  bar.rotation.z = Math.PI / 2;
  bar.position.x = (armLength - 0.3) / 2;
  arm.add(bar);
  const carriage = new THREE.Group();
  const cBody = mesh(new RoundedBoxGeometry(1.6, 1.6, 1.6, 3, 0.22), m.darkSteel);
  carriage.add(cBody);
  const cScrew = thumbScrew(m);
  cScrew.rotation.z = Math.PI / 2;
  cScrew.position.y = 0.8;
  carriage.add(cScrew);
  arm.add(carriage);
  group.add(arm);

  // The magnet: nickel-plated NdFeB puck in a brass cup, on a rod through the carriage.
  const magnet = new THREE.Group();
  magnet.add(mesh(ring(0, magnetRadius, magnetThickness, 0.08, 64), m.nickel));
  const cup = mesh(ring(magnetRadius - 0.01, magnetRadius + 0.14, 0.75, 0.05, 64), m.brass);
  cup.position.y = magnetThickness - 0.45;
  magnet.add(cup);
  const cap = mesh(ring(0, magnetRadius + 0.14, 0.3, 0.08, 64), m.brass);
  cap.position.y = magnetThickness + 0.3;
  magnet.add(cap);
  const mRod = mesh(ring(0, 0.3, magnetRodLength, 0.08, 24), m.steel);
  mRod.position.y = holderHeight;
  magnet.add(mRod);
  const knob = mesh(new THREE.SphereGeometry(0.5, 24, 16), m.blackOxide);
  knob.position.y = holderHeight + magnetRodLength + 0.3;
  magnet.add(knob);
  group.add(magnet);

  return { group, magnet, arm, carriage };
}

// Seven-segment style readout drawn on a canvas and used as an emissive map.
function createDisplay() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  let last = '';
  function draw(amps, volts) {
    const text = `${amps.toFixed(2)}|${volts.toFixed(1)}`;
    if (text === last) return;
    last = text;
    ctx.fillStyle = '#020403';
    ctx.fillRect(0, 0, 512, 192);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffa657';
    ctx.font = '700 104px "JetBrains Mono", monospace';
    ctx.fillText(amps.toFixed(2), 28, 84);
    ctx.font = '500 40px "JetBrains Mono", monospace';
    ctx.fillText('A', 330, 104);
    ctx.fillStyle = '#79c0ff';
    ctx.fillText(`${volts.toFixed(1).padStart(4, ' ')} V`, 28, 160);
    ctx.fillStyle = amps > 0.005 ? '#3fb950' : '#1c2a20';
    ctx.fillText('CC', 420, 44);
    map.needsUpdate = true;
  }
  return { map, draw };
}

// Knurled grip: a cylinder whose side vertices alternate in and out.
function knurledCylinder(radius, height, ridges) {
  const geometry = new THREE.CylinderGeometry(radius, radius * 1.04, height, ridges * 2, 1);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    if (Math.hypot(x, z) < radius * 0.9) continue; // cap centres
    const segment = Math.round(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * ridges * 2);
    const s = segment % 2 === 0 ? 1 : 0.95;
    p.setXYZ(i, x * s, p.getY(i), z * s);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Front panel layout, in panel coordinates (cm from the panel centre).
const PANEL = { width: 12, height: 7.5, knob: [3.2, -0.25], screen: [-2.6, 1.65], posts: [[-3.2, -2.3], [-1.4, -2.3]], power: [-5.0, -2.3] };

function panelTexture() {
  const s = 100; // px per cm
  const px = (x) => (x + PANEL.width / 2) * s;
  const py = (y) => (PANEL.height / 2 - y) * s;
  return canvasTexture(PANEL.width * s, PANEL.height * s, (ctx) => {
    ctx.fillStyle = '#20252d';
    ctx.fillRect(0, 0, PANEL.width * s, PANEL.height * s);
    ctx.fillStyle = '#e6edf3';
    ctx.textAlign = 'left';
    ctx.font = '700 30px "JetBrains Mono", monospace';
    ctx.fillText('PSU-3003', px(-5.5), py(3.2));
    ctx.fillStyle = '#8b949e';
    ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.fillText('DC POWER SUPPLY · 0–30 V · 0–3 A', px(-5.5), py(2.85));
    // Current scale around the knob.
    const [kx, ky] = PANEL.knob;
    ctx.textAlign = 'center';
    ctx.fillText('CURRENT', px(kx), py(ky + 2.95));
    ctx.strokeStyle = '#6e7681';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 30; i++) {
      const a = KNOB_START - (i / 30) * KNOB_SWEEP;
      const r0 = i % 5 === 0 ? 2.75 : 2.82;
      ctx.beginPath();
      ctx.moveTo(px(kx + Math.cos(a) * r0), py(ky + Math.sin(a) * r0));
      ctx.lineTo(px(kx + Math.cos(a) * 2.95), py(ky + Math.sin(a) * 2.95));
      ctx.stroke();
    }
    ctx.font = '600 18px "JetBrains Mono", monospace';
    [[0, '0'], [0.5, '1.5'], [1, '3 A']].forEach(([t, text]) => {
      const a = KNOB_START - t * KNOB_SWEEP;
      ctx.fillText(text, px(kx + Math.cos(a) * 3.2), py(ky + Math.sin(a) * 3.2) + 6);
    });
    // Output posts and power switch.
    ctx.fillStyle = '#8b949e';
    ctx.fillText('OUTPUT', px((PANEL.posts[0][0] + PANEL.posts[1][0]) / 2), py(PANEL.posts[0][1] + 0.95));
    ctx.fillText('POWER', px(PANEL.power[0]), py(PANEL.power[1] + 0.95));
    ctx.font = '700 26px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f85149';
    ctx.fillText('+', px(PANEL.posts[0][0]), py(PANEL.posts[0][1] - 0.85));
    ctx.fillStyle = '#e6edf3';
    ctx.fillText('−', px(PANEL.posts[1][0]), py(PANEL.posts[1][1] - 0.85));
    // Recess around the screen.
    const [sx, sy] = PANEL.screen;
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(px(sx - 3), py(sy + 1.25), 6 * s, 2.5 * s);
  });
}

function bindingPost(m, material) {
  const post = new THREE.Group();
  post.add(mesh(ring(0, 0.55, 0.22, 0.05, 6), m.brass)); // hex nut
  const body = mesh(ring(0, 0.42, 0.9, 0.1, 32), material);
  body.position.y = 0.22;
  post.add(body);
  return post;
}

function buildSupply(m) {
  const group = new THREE.Group();
  const lift = 0.4; // rubber feet
  const body = mesh(new RoundedBoxGeometry(13, 8.5, 10, 5, 0.6), m.powder);
  body.position.y = lift + 4.25;
  group.add(body);
  for (const x of [-5.5, 5.5]) for (const z of [-4, 4]) {
    const foot = mesh(ring(0, 0.6, lift, 0.12, 24), m.rubber);
    foot.position.set(x, 0, z);
    group.add(foot);
  }
  const bezel = mesh(new RoundedBoxGeometry(13.1, 8.6, 0.8, 4, 0.3), m.plastic);
  bezel.position.set(0, lift + 4.25, 4.8);
  group.add(bezel);

  // Panel coordinates → supply coordinates.
  const front = 5.21;
  const at = ([x, y], z = front) => new THREE.Vector3(x, lift + 4.25 + y, z);

  const panel = mesh(new THREE.PlaneGeometry(PANEL.width, PANEL.height), new THREE.MeshStandardNodeMaterial({ map: panelTexture(), roughness: 0.55, metalness: 0.3 }), { cast: false });
  panel.position.copy(at([0, 0]));
  group.add(panel);

  const display = createDisplay();
  const screenMaterial = new THREE.MeshPhysicalNodeMaterial({
    color: 0x000000, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03,
    emissive: 0xffffff, emissiveMap: display.map, emissiveIntensity: 1.5,
  });
  const screen = mesh(new THREE.PlaneGeometry(5.6, 2.1), screenMaterial, { cast: false });
  screen.position.copy(at(PANEL.screen, front + 0.01));
  group.add(screen);

  // Binding posts: red +, black −.
  const terminals = [];
  [m.red, m.black].forEach((material, i) => {
    const post = bindingPost(m, material);
    post.rotation.x = Math.PI / 2;
    post.position.copy(at(PANEL.posts[i]));
    group.add(post);
    terminals.push(at(PANEL.posts[i], front + 1.12));
  });

  // Rocker switch, lit when the output is on.
  const rocker = mesh(new RoundedBoxGeometry(1.0, 0.7, 0.35, 2, 0.1), m.glow, { cast: false });
  rocker.position.copy(at(PANEL.power, front + 0.15));
  rocker.rotation.x = -0.12;
  group.add(rocker);

  // The knob, the one physical gesture of the page.
  const knob = new THREE.Group();
  knob.position.copy(at(PANEL.knob, front - 0.05));
  const skirt = mesh(ring(0, 2.05, 0.35, 0.08, 72), m.darkSteel);
  skirt.rotation.x = Math.PI / 2;
  knob.add(skirt);
  const dial = new THREE.Group();
  const grip = mesh(knurledCylinder(1.55, 1.3, 40), m.rubber);
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.95;
  dial.add(grip);
  const face = mesh(ring(0, 1.32, 0.12, 0.04, 64), m.turned);
  face.rotation.x = Math.PI / 2;
  face.position.z = 1.58;
  dial.add(face);
  const pointer = mesh(new THREE.BoxGeometry(0.16, 0.9, 0.05), m.glow, { cast: false });
  pointer.position.set(0, 0.75, 1.72);
  dial.add(pointer);
  knob.add(dial);

  // Ring of LEDs around the knob, lit up to the current level.
  const ledCount = 31;
  const ledMaterial = new THREE.MeshBasicNodeMaterial(); // unlit: instance colours above 1 feed the bloom
  const leds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), ledMaterial, ledCount);
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  for (let i = 0; i < ledCount; i++) {
    const a = KNOB_START - (i / (ledCount - 1)) * KNOB_SWEEP;
    matrix.compose(new THREE.Vector3(Math.cos(a) * 2.45, Math.sin(a) * 2.45, 0.1), q, new THREE.Vector3(1, 1, 1));
    leds.setMatrixAt(i, matrix);
    leds.setColorAt(i, new THREE.Color(0x111111));
  }
  knob.add(leds);
  group.add(knob);

  const ledColor = new THREE.Color();
  const tint = new THREE.Color();
  function setLevel(level) {
    dial.rotation.z = -level * KNOB_SWEEP + KNOB_SWEEP / 2;
    const lit = level * (ledCount - 1);
    for (let i = 0; i < ledCount; i++) {
      const on = Math.min(Math.max(lit - i + 1, 0), 1);
      tint.copy(PALETTE.blue).lerp(PALETTE.orange, i / (ledCount - 1)).multiplyScalar(4);
      leds.setColorAt(i, ledColor.set(0x101216).lerp(tint, on));
    }
    leds.instanceColor.needsUpdate = true;
  }

  // Vent slots on the top and the sides.
  const slotGeometry = new RoundedBoxGeometry(8, 0.1, 0.34, 1, 0.04);
  for (let i = 0; i < 8; i++) {
    const vent = mesh(slotGeometry, m.rubber, { cast: false });
    vent.position.set(0, lift + 8.5, -3.2 + i * 0.85);
    group.add(vent);
  }
  const sideSlot = new RoundedBoxGeometry(0.1, 3.4, 0.3, 1, 0.04);
  for (const x of [-6.5, 6.5]) for (let i = 0; i < 6; i++) {
    const vent = mesh(sideSlot, m.rubber, { cast: false });
    vent.position.set(x, lift + 5, -3.4 + i * 0.8);
    group.add(vent);
  }
  const mainsOut = new THREE.Vector3(4, lift + 1.5, -5.05);

  group.position.copy(LAYOUT.supply);
  group.rotation.y = LAYOUT.supplyAngle;
  group.updateMatrixWorld();
  return {
    group, knob, display, setLevel,
    terminals: terminals.map((t) => group.localToWorld(t)),
    normal: new THREE.Vector3(Math.sin(LAYOUT.supplyAngle), 0, Math.cos(LAYOUT.supplyAngle)),
    mainsOut: group.localToWorld(mainsOut),
  };
}

// A cable through the given points that never sinks into what it rests on:
// the smooth curve is sampled and every sample is lifted to the surface under it.
function restingCurve(points, floorAt, samples = 200) {
  const rough = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const lifted = rough.getSpacedPoints(samples).map((p) => p.setY(Math.max(p.y, floorAt(p))));
  return new THREE.CatmullRomCurve3(lifted, false, 'centripetal');
}

function bananaPlug(m, material) {
  const plug = new THREE.Group();
  const shell = mesh(lathe([[0.32, 0, 0.1], [0.36, 1.6, 0.12], [0.2, 1.6, 0], [0.2, 0, 0]], 24), material);
  plug.add(shell);
  const pin = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12), m.tin);
  pin.position.y = -0.25;
  plug.add(pin);
  return plug;
}

// Test leads from the coil terminals, down onto the plate, into the supply posts.
// Cable radius 0.16: every resting point sits at y = 0.16 on the plate.
function buildCables(m, coil, supply) {
  const group = new THREE.Group();
  const r = 0.16;
  const y0 = r;
  const plugs = [];
  coil.terminals.forEach((start, i) => {
    const post = supply.terminals[i];
    const plugBack = post.clone().addScaledVector(supply.normal, 1.6);
    const out = post.clone().addScaledVector(supply.normal, 3.2);
    // Forward off the terminal, down to the plate, then along the front of the supply.
    const down = start.clone().add(new THREE.Vector3(0.6, 0, 3.6)).setY(y0);
    const points = [
      start,
      start.clone().add(new THREE.Vector3(0.2, -0.3, 0.8)),
      start.clone().add(new THREE.Vector3(0.4, 0, 2)).setY(y0 + 0.1),
      down,
      down.clone().lerp(out, 0.5).setY(y0).addScaledVector(supply.normal, 1.8 + i * 0.9),
      out.clone().setY(y0),
      plugBack.clone().addScaledVector(supply.normal, 0.7).setY(post.y - 0.6),
      plugBack,
    ];
    const curve = restingCurve(points, () => y0);
    group.add(mesh(new THREE.TubeGeometry(curve, 200, r, 10), i === 0 ? m.red : m.black));
    const plug = bananaPlug(m, i === 0 ? m.red : m.black);
    plug.position.copy(post);
    plug.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), supply.normal);
    group.add(plug);
    plugs.push(plug);
  });

  // Mains cord from the back of the supply, over the rear edge of the plate, onto the floor.
  const a = supply.mainsOut;
  const back = -14; // rear edge of the plate
  const cordRadius = 0.28;
  const onPlate = (p) => (p.z > back ? cordRadius : -1.6 + cordRadius);
  const cord = restingCurve([
    a,
    a.clone().add(new THREE.Vector3(-0.4, -0.6, -1.2)),
    new THREE.Vector3(a.x - 1, 0.28, a.z - 3.5),
    new THREE.Vector3(a.x - 1.5, 0.28, back + 0.6),
    new THREE.Vector3(a.x - 1.6, 0.05, back - 0.25),
    new THREE.Vector3(a.x - 1.7, -1.0, back - 0.45),
    new THREE.Vector3(a.x - 2.2, -1.32, back - 2),
    new THREE.Vector3(a.x - 5, -1.32, back - 26),
  ], onPlate, 240);
  group.add(mesh(new THREE.TubeGeometry(cord, 240, cordRadius, 10), m.rubber));
  // Strain relief where the cord leaves the supply.
  const relief = mesh(lathe([[0.45, 0, 0.06], [0.32, 1.1, 0.06], [0, 1.1, 0], [0, 0, 0]], 24), m.rubber);
  relief.position.copy(a);
  relief.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), supply.normal.clone().negate());
  group.add(relief);
  return group;
}

export function buildDiorama() {
  const m = materials();
  const root = new THREE.Group();
  const stand = buildStand(m);
  const supply = buildSupply(m);
  const coil = buildCoil(m);
  const dish = buildDish(m);
  const studio = buildStudio(m);
  const cables = buildCables(m, coil, supply);
  root.add(studio, coil.group, dish, stand.group, supply.group, cables);
  return {
    root, studio, coil: coil.group, setCut: coil.setCut, dish, stand: stand.group, supply, cables, power: m.power,
    magnet: stand.magnet, arm: stand.arm, carriage: stand.carriage,
  };
}

/** Scene used only to bake reflections: dark room, softboxes with hard edges, two accent strips. */
// A dark box room lit by emissive panels, for PMREMGenerator.fromScene (rendered from the origin).
function studioRoom(hex) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(100, 60, 100), new THREE.MeshBasicMaterial({ color: hex, side: THREE.BackSide })));
  const panel = (w, h, color, intensity, position, lookAt = [0, 0, 0]) => {
    const light = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    light.position.set(...position);
    light.lookAt(...lookAt);
    scene.add(light);
  };
  return { scene, panel };
}

/** The studio for the metals, plastics and glass: big soft boxes for broad, readable highlights. */
export function buildEnvironmentScene() {
  const { scene, panel } = studioRoom(0x07090d);
  panel(30, 18, 0xfff1e0, 3.2, [0, 28, 6]); // overhead softbox
  panel(26, 4, 0xfff4e8, 4, [-24, 20, -36]); // strip opposite the hero camera
  panel(8, 40, 0xffe2c4, 5, [-40, 8, 18]); // warm key strip
  panel(5, 36, 0x58a6ff, 4, [42, 6, -14]); // blue rim strip
  panel(30, 3, 0xffa657, 3, [0, 4, -48]); // low orange glow at the back
  panel(18, 10, 0xd8e4ff, 2.2, [20, 14, 44]); // soft fill behind the camera
  panel(3, 3, 0xffffff, 12, [8, 30, 22]); // small hard source
  return scene;
}

/**
 * The room the fluid reflects. The fluid is a black mirror. From the 3/4 hero view the flat surface
 * reflects only a thin band about 24 degrees above the horizon, so the whole disc takes the colour of
 * whatever sits there: this room is black below 40 degrees, and its lights are thin lines and one
 * small point higher up. The sloped spike faces pick them up as sharp lines and tip glints.
 * The ceiling is at y = 30, so every panel stays below it.
 */
export function buildFluidEnvironmentScene() {
  const { scene, panel } = studioRoom(0x040507);
  panel(30, 1.2, 0xfff1e0, 7, [0, 27, -13]); // 64 degrees: one sharp line across the top view
  panel(20, 1, 0xfff4e8, 7, [-20, 26, -24]); // 40 degrees, behind the dish: a line on the far spike faces
  panel(3, 3, 0xffffff, 14, [8, 28, 20]); // 52 degrees, behind the hero camera: a glint on each spike tip
  panel(1, 12, 0x58a6ff, 5, [30, 22, -12]); // 26 to 41 degrees, 100 degrees off the hero reflection: a thin blue rim
  return scene;
}
