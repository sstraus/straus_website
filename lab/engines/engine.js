// The petrol engine: a 2.0 litre inline four with double overhead cams, sectioned down the middle.
// Units: metres. Frame: origin on the crank axis, x along the crank (cylinder 1 and the timing belt
// at +x, towards the motor), y up, z to the front (exhaust side, facing the camera).
// The castings are cut by the plane z = 0 and their cut faces are painted red; every moving part is
// drawn whole. The exhaust half of the head is never visible, so it is not built.
import * as THREE from 'three/webgpu';
import { color, uniform, vec4, mrt, smoothstep, positionLocal, normalView, abs } from 'three/tsl';
import {
  ENGINE, TAU, pistonHeight, cylinderPhase, throwAngle, valveLift, camAngle, lobeAngle, burnGlow,
  gasTemperature, VALVE_TIMING,
} from './physics.js';
import {
  mesh, sectioned, extrude, circlePath, roundedRect, cylinderX, ringX, lathe, Helix, pickVolume,
} from './materials.js';

const DEG = Math.PI / 180;
const R = ENGINE.stroke / 2;
const CYL_X = [0.144, 0.048, -0.048, -0.144]; // cylinder 1 at the timing end
const MAIN_X = [0.192, 0.096, 0, -0.096, -0.192];
const HALF = 0.215; // half length of the block
const HALF_W = 0.1; // half width of the block
const DECK = 0.2175;
const HEAD = { gasket: 0.219, chamber: 0.232, top: 0.262, carrier: 0.345 };
const COMPRESSION_HEIGHT = 0.03; // piston pin to crown
const TILT = 11 * DEG; // valve axes lean out from the middle
const SEAT = { y: 0.225, z: 0.02 };
const CAM = { y: 0.3654, z: 0.0473, base: 0.016 };
const VALVE = {
  intake: { side: -1, x: 0.018, radius: 0.016 },
  exhaust: { side: 1, x: 0.016, radius: 0.0135 },
};
const STEM = { radius: 0.0035, length: 0.105, springSeat: 0.0377, retainer: 0.095 };
const TIMING_X = 0.245; // belt plane
const FLYWHEEL_X = -0.25;
const PULLEYS = [ // belt path, counter-clockwise in the (z, y) plane
  { name: 'crank', z: 0, y: 0, r: 0.0215 },
  { name: 'tensioner', z: 0.07, y: 0.18, r: 0.016 },
  { name: 'exhaust', z: CAM.z, y: CAM.y, r: 0.043 },
  { name: 'intake', z: -CAM.z, y: CAM.y, r: 0.043 },
  { name: 'pump', z: -0.07, y: 0.16, r: 0.02 },
];

export const ENGINE_LAYOUT = {
  position: new THREE.Vector3(-0.36, 0.29, 0), // crank axis above the plinth top
  cut: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), // removes z > 0
  bounds: { min: [-0.27, -0.17, -0.24], max: [0.26, 0.38, 0.1] },
};

// ---------- geometry helpers ----------

/** Extrude shapes drawn in the (x, z) plane (shape y = world z) between two heights. */
function slabY(shapes, y0, y1, curveSegments = 32) {
  const g = extrude(shapes, y1 - y0, { from: 0, curveSegments });
  g.rotateX(Math.PI / 2);
  g.translate(0, y1, 0);
  return g;
}

/** Extrude a shape drawn in the (−z, y) plane between two x positions. */
function slabX(shape, x0, x1, curveSegments = 32) {
  const g = extrude(shape, x1 - x0, { from: 0, curveSegments });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
}

function rect(x0, y0, x1, y1, r = 0) {
  return r ? roundedRect(new THREE.Shape(), x0, y0, x1, y1, r) : new THREE.Shape([
    new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1),
  ]);
}
function rectPath(x0, y0, x1, y1, r) {
  return roundedRect(new THREE.Path(), x0, y0, x1, y1, r);
}

function convexHull(points) {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list) => {
    const out = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half(p.reverse())];
}
const circlePoints = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * TAU;
  return new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
});

// ---------- castings (sectioned) ----------

function buildCastings(m, planes, parts) {
  const cut = (material) => sectioned(material, planes);
  const alu = cut(m.aluminium);
  const aluDark = cut(m.aluminiumDark);
  const iron = cut(m.castIron);
  const bore = cut(m.bore);
  const gasket = cut(m.gasket);
  const clip = new THREE.ClippingGroup();
  clip.clippingPlanes = planes;

  // Block: outer wall around an open-deck water jacket, and a siamesed bank of cast iron liners.
  const block = new THREE.Group();
  const wall = rect(-HALF, -HALF_W, HALF, HALF_W, 0.012);
  wall.holes.push(rectPath(-0.203, -0.059, 0.203, 0.059, 0.05));
  block.add(mesh(slabY([wall], 0.085, DECK), alu));
  const liners = rect(-0.193, -0.049, 0.193, 0.049, 0.048);
  for (const x of CYL_X) liners.holes.push(circlePath(x, 0, ENGINE.bore / 2, true));
  block.add(mesh(slabY([liners], 0.085, DECK, 48), [iron, bore]));
  // Crankcase skirt down to the pan rail, with five bulkheads that carry the main bearings.
  const skirt = rect(-HALF, -HALF_W, HALF, HALF_W, 0.012);
  skirt.holes.push(rectPath(-0.205, -0.09, 0.205, 0.09, 0.004));
  block.add(mesh(slabY([skirt], -0.07, 0.085), alu));
  const bulkhead = new THREE.Shape();
  bulkhead.moveTo(-0.09, -0.045);
  bulkhead.lineTo(-0.045, -0.045);
  bulkhead.lineTo(-0.045, 0);
  bulkhead.lineTo(-0.03, 0);
  bulkhead.absarc(0, 0, 0.03, Math.PI, 0, true);
  bulkhead.lineTo(0.045, 0);
  bulkhead.lineTo(0.045, -0.045);
  bulkhead.lineTo(0.09, -0.045);
  bulkhead.lineTo(0.09, 0.085);
  bulkhead.lineTo(-0.09, 0.085);
  for (const x of MAIN_X) block.add(mesh(slabX(bulkhead, x - 0.008, x + 0.008), alu));
  // Engine mount bosses on the back wall.
  for (const x of [-0.17, 0.17]) {
    const boss = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), alu);
    boss.position.set(x, 0.02, -HALF_W - 0.015);
    block.add(boss);
  }
  clip.add(block);

  // Main bearing caps, bolted up from below.
  const caps = new THREE.Group();
  const cap = new THREE.Shape();
  cap.moveTo(-0.045, 0);
  cap.lineTo(-0.03, 0);
  cap.absarc(0, 0, 0.03, Math.PI, TAU, false);
  cap.lineTo(0.045, 0);
  cap.lineTo(0.045, -0.045);
  cap.lineTo(-0.045, -0.045);
  const capGeometry = slabX(cap, -0.008, 0.008);
  for (const x of MAIN_X) {
    const c = mesh(capGeometry, iron);
    c.position.x = x;
    caps.add(c);
  }
  clip.add(caps);

  // Oil pan.
  const sump = new THREE.Group();
  const pan = rect(-0.21, -0.095, 0.21, 0.095, 0.02);
  pan.holes.push(rectPath(-0.204, -0.089, 0.204, 0.089, 0.016));
  sump.add(mesh(slabY([pan], -0.165, -0.075), aluDark));
  sump.add(mesh(slabY([rect(-0.21, -0.095, 0.21, 0.095, 0.02)], -0.17, -0.165), aluDark));
  const flange = rect(-HALF, -HALF_W, HALF, HALF_W, 0.012);
  flange.holes.push(rectPath(-0.204, -0.089, 0.204, 0.089, 0.016));
  sump.add(mesh(slabY([flange], -0.075, -0.07), aluDark));
  clip.add(sump);

  // Head: gasket, combustion chambers (a shallow round recess, not the real pent roof), valve throats, plug bores.
  const head = new THREE.Group();
  const gasketShape = rect(-HALF, -HALF_W, HALF, HALF_W, 0.012);
  for (const x of CYL_X) gasketShape.holes.push(circlePath(x, 0, ENGINE.bore / 2 + 0.001, true));
  head.add(mesh(slabY([gasketShape], DECK, HEAD.gasket), gasket));
  const chamber = rect(-HALF, -HALF_W, HALF, HALF_W, 0.012);
  for (const x of CYL_X) chamber.holes.push(circlePath(x, 0, 0.041, true));
  head.add(mesh(slabY([chamber], HEAD.gasket, HEAD.chamber, 48), alu));
  const ports = rect(-HALF, -HALF_W, HALF, HALF_W, 0.012);
  const throatZ = SEAT.z + Math.tan(TILT) * (0.247 - SEAT.y);
  for (const x of CYL_X) {
    for (const s of [-1, 1]) {
      ports.holes.push(circlePath(x + s * VALVE.intake.x, -throatZ, 0.013, true));
      ports.holes.push(circlePath(x + s * VALVE.exhaust.x, throatZ, 0.011, true));
    }
    ports.holes.push(circlePath(x, 0, 0.006, true));
  }
  head.add(mesh(slabY([ports], HEAD.chamber, HEAD.top), alu));
  // Middle ridge with the spark plug wells: cut through, so the plugs show in their wells.
  const ridge = rect(-HALF, -0.016, HALF, 0.016, 0.004);
  for (const x of CYL_X) ridge.holes.push(circlePath(x, 0, 0.0105, true));
  head.add(mesh(slabY([ridge], HEAD.top, 0.328), alu));
  clip.add(head);
  Object.assign(parts, { clip, block, caps, sump, head });
  return clip;
}

// ---------- intake side of the head: cam carrier, towers and caps (never cut) ----------

function buildCarrier(m) {
  const carrier = new THREE.Group();
  // Outer wall of the intake side, and the bucket bores leaning with the valves.
  const wall = mesh(new THREE.BoxGeometry(2 * HALF, HEAD.carrier - HEAD.top, 0.036), m.aluminium);
  wall.position.set(0, (HEAD.top + HEAD.carrier) / 2, -0.082);
  carrier.add(wall);
  const bossGeometry = new THREE.CylinderGeometry(0.0205, 0.0205, 0.032, 32, 1, true);
  const boreGeometry = new THREE.CylinderGeometry(0.0155, 0.0155, 0.032, 32, 1, true);
  const lipGeometry = new THREE.RingGeometry(0.0155, 0.0205, 32);
  lipGeometry.rotateX(-Math.PI / 2);
  const u = 0.107; // along the valve axis
  const boreInside = m.bore.clone();
  boreInside.side = THREE.BackSide;
  for (const x of CYL_X) {
    for (const dx of [-VALVE.intake.x, VALVE.intake.x]) {
      const boss = new THREE.Group();
      boss.position.set(x + dx, SEAT.y + u * Math.cos(TILT), -(SEAT.z + u * Math.sin(TILT)));
      boss.rotation.x = -TILT;
      boss.add(mesh(bossGeometry, m.aluminium));
      boss.add(mesh(boreGeometry, boreInside));
      const lip = mesh(lipGeometry, m.aluminium);
      lip.position.y = 0.016;
      boss.add(lip);
      carrier.add(boss);
    }
  }
  // Web joining the bosses to the wall, level with the bores so the springs below stay in view.
  const web = mesh(new THREE.BoxGeometry(2 * HALF, 0.024, 0.011), m.aluminium);
  web.position.set(0, 0.33, -0.0605);
  carrier.add(web);

  // Cam towers under each journal, and the bearing caps (lifted with the cams in the exploded view).
  const towers = new THREE.Group();
  const tower = new THREE.Shape();
  tower.moveTo(-0.017, HEAD.top);
  tower.lineTo(0.017, HEAD.top);
  tower.lineTo(0.017, CAM.y);
  tower.lineTo(0.0125, CAM.y);
  tower.absarc(0, CAM.y, 0.0125, 0, Math.PI, true);
  tower.lineTo(-0.017, CAM.y);
  const capShape = new THREE.Shape();
  capShape.moveTo(-0.017, CAM.y);
  capShape.lineTo(-0.0125, CAM.y);
  capShape.absarc(0, CAM.y, 0.0125, Math.PI, 0, true);
  capShape.lineTo(0.017, CAM.y);
  capShape.lineTo(0.017, CAM.y + 0.018);
  capShape.lineTo(-0.017, CAM.y + 0.018);
  const towerGeometry = slabX(tower, -0.007, 0.007);
  towerGeometry.translate(0, 0, -CAM.z);
  const capGeometry = slabX(capShape, -0.007, 0.007);
  capGeometry.translate(0, 0, -CAM.z);
  const caps = new THREE.Group();
  for (const x of MAIN_X) {
    const t = mesh(towerGeometry, m.aluminium);
    t.position.x = x;
    towers.add(t);
    const c = mesh(capGeometry, m.aluminium);
    c.position.x = x;
    caps.add(c);
    for (const dz of [-0.013, 0.013]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.005, 12), m.nickel);
      bolt.position.set(x, CAM.y + 0.0205, -CAM.z + dz);
      caps.add(bolt);
    }
  }
  carrier.add(towers);
  return { carrier, camCaps: caps };
}

// ---------- crankshaft, flywheel, rods, pistons ----------

function webShape() {
  const points = [];
  for (let a = -20; a <= 200; a += 10) points.push(new THREE.Vector2(0.03 * Math.cos(a * DEG), R + 0.03 * Math.sin(a * DEG)));
  for (let a = 205; a <= 335; a += 5) points.push(new THREE.Vector2(0.072 * Math.cos(a * DEG), 0.072 * Math.sin(a * DEG)));
  return new THREE.Shape(points);
}

function buildCrank(m) {
  const crank = new THREE.Group();
  const journal = cylinderX(0.028, 0.034, 40);
  for (const x of MAIN_X) {
    const j = mesh(journal, m.ground);
    j.position.x = x;
    crank.add(j);
  }
  const web = slabX(webShape(), -0.009, 0.009);
  const pin = cylinderX(0.024, 0.026, 40);
  for (let k = 1; k <= 4; k++) {
    const x = CYL_X[k - 1];
    const a = throwAngle(k);
    const p = mesh(pin, m.ground);
    p.position.set(x, R * Math.cos(a), R * Math.sin(a));
    crank.add(p);
    for (const dx of [-0.022, 0.022]) {
      const w = mesh(web, m.forged);
      w.position.x = x + dx;
      w.rotation.x = a;
      crank.add(w);
    }
  }
  // Nose to the timing pulley, flange to the flywheel.
  const nose = mesh(cylinderX(0.018, 0.06, 32), m.forged);
  nose.position.x = 0.225;
  crank.add(nose);
  const tail = mesh(cylinderX(0.03, 0.04, 40), m.forged);
  tail.position.x = -0.225;
  crank.add(tail);
  const pulley = toothedPulley(m, 0.0215, 0.022, 0);
  pulley.position.x = TIMING_X;
  crank.add(pulley);
  // A white timing mark on the pulley flange makes slow rotation easy to read.
  const mark = mesh(new THREE.BoxGeometry(0.002, 0.008, 0.003), m.ceramic);
  mark.position.set(TIMING_X + 0.0125, 0.02, 0);
  crank.add(mark);
  return { crank, pulley };
}

function buildFlywheel(m) {
  const flywheel = new THREE.Group();
  const disc = new THREE.Shape();
  disc.absarc(0, 0, 0.138, 0, TAU, false);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    disc.holes.push(circlePath(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.006, true));
  }
  flywheel.add(mesh(slabX(disc, -0.012, 0.012, 64), m.castIron));
  const face = mesh(ringX(0.07, 0.132, 0.002, 64), m.polished); // clutch face
  face.position.x = -0.013;
  flywheel.add(face);
  // Starter ring gear: 132 teeth.
  const ring = new THREE.Shape();
  const n = 132;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 0.5) / n) * TAU;
    const pts = [[0.139, a0], [0.146, a0 + 0.004], [0.146, a1 - 0.004], [0.139, a1]];
    for (const [r, a] of pts) {
      const x = -Math.sin(a) * r;
      const y = Math.cos(a) * r;
      if (i === 0 && r === 0.139 && a === a0) ring.moveTo(x, y);
      else ring.lineTo(x, y);
    }
  }
  ring.holes.push(circlePath(0, 0, 0.1375, true));
  const gear = mesh(slabX(ring, -0.006, 0.006, 8), m.forged);
  gear.position.x = 0.004;
  flywheel.add(gear);
  flywheel.position.x = FLYWHEEL_X;
  return flywheel;
}

function rodGeometry() {
  const hull = convexHull([...circlePoints(0, 0, 0.036, 48), ...circlePoints(0, ENGINE.rod, 0.016, 24)]);
  const shape = new THREE.Shape(hull);
  shape.holes.push(circlePath(0, 0, 0.0245, true), circlePath(0, ENGINE.rod, 0.0112, true));
  return slabX(shape, -0.011, 0.011, 40);
}

function pistonGeometry() {
  const H = COMPRESSION_HEIGHT;
  const r = ENGINE.bore / 2 - 0.0001;
  const g = 0.0405; // ring groove root
  const profile = [
    [0, 0.017], [0.034, 0.016], [0.0385, 0.012], [0.0385, -0.02], [r, -0.02],
    [r, 0.012], [g, 0.012], [g, 0.0155], [r, 0.0155],
    [r, 0.019], [g, 0.019], [g, 0.0205], [r, 0.0205],
    [r, 0.0235], [g, 0.0235], [g, 0.025], [r, 0.025],
    [r, H - 0.0015], [r - 0.0015, H], [0, H],
  ];
  return lathe(profile, 56);
}

function buildRunningGear(m) {
  const pistons = [];
  const rods = [];
  const rod = rodGeometry();
  const piston = pistonGeometry();
  const ringGeometries = [[0.0122, 0.0153], [0.0192, 0.0203], [0.0237, 0.0248]].map(([y0, y1]) =>
    lathe([[0.0404, y0], [ENGINE.bore / 2 - 0.0002, y0], [ENGINE.bore / 2 - 0.0002, y1], [0.0404, y1], [0.0404, y0]], 56));
  const gudgeon = cylinderX(0.0112, 0.066, 24);
  for (let k = 1; k <= 4; k++) {
    const p = new THREE.Group();
    p.add(mesh(piston, m.pistonAlloy));
    for (const g of ringGeometries) p.add(mesh(g, m.springSteel));
    p.add(mesh(gudgeon, m.polished));
    p.add(pickVolume(new THREE.CylinderGeometry(0.043, 0.043, 0.05, 16).translate(0, 0.005, 0), 'piston'));
    p.position.x = CYL_X[k - 1];
    pistons.push(p);
    const r = new THREE.Group();
    r.add(mesh(rod, m.forged));
    r.add(pickVolume(new THREE.BoxGeometry(0.024, ENGINE.rod + 0.06, 0.07).translate(0, ENGINE.rod / 2, 0), 'rod'));
    r.position.x = CYL_X[k - 1];
    rods.push(r);
  }
  return { pistons, rods };
}

// ---------- valve train ----------

function valveGeometry(radius) {
  return lathe([
    [0, -0.0015], [radius, -0.0015], [radius, 0.0005], [radius * 0.55, 0.004],
    [STEM.radius * 1.7, 0.01], [STEM.radius, 0.016], [STEM.radius, STEM.length - 0.001],
    [STEM.radius * 0.8, STEM.length], [0, STEM.length],
  ], 28);
}

function lobeGeometry() {
  const half = ((VALVE_TIMING.intake.close - VALVE_TIMING.intake.open) * DEG) / 4;
  const points = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * TAU;
    const off = Math.atan2(Math.sin(a), Math.cos(a));
    const u = (off + half) / (2 * half);
    const lift = u > 0 && u < 1 ? Math.sin(Math.PI * u) ** 2 : 0;
    const r = CAM.base + ENGINE.maxValveLift * lift;
    points.push(new THREE.Vector2(-Math.sin(a) * r, Math.cos(a) * r)); // nose along local +y
  }
  return slabX(new THREE.Shape(points), -0.007, 0.007);
}

/** A toothed pulley along x, radius r, width w, with a flange each side. */
function toothedPulley(m, r, w, spokes) {
  const group = new THREE.Group();
  const body = new THREE.Shape();
  body.absarc(0, 0, r, 0, TAU, false);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * TAU;
    body.holes.push(circlePath(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.2, true));
  }
  group.add(mesh(slabX(body, -w / 2, w / 2, 48), spokes ? m.aluminiumDark : m.forged));
  for (const s of [-1, 1]) {
    const f = mesh(cylinderX(r + 0.004, 0.0015, 48), m.polished);
    f.position.x = s * (w / 2 + 0.0008);
    group.add(f);
  }
  return group;
}

function buildValveTrain(m) {
  const exhaustHeat = uniform(0);
  const hotValve = m.polished.clone();
  // Only the head of the valve glows: the face that sits in the flame.
  hotValve.emissiveNode = color(0xff3a12).mul(exhaustHeat).mul(smoothstep(0.012, 0.0, positionLocal.y));
  const geometry = { intake: valveGeometry(VALVE.intake.radius), exhaust: valveGeometry(VALVE.exhaust.radius) };
  const spring = new THREE.TubeGeometry(new Helix(0.0112, STEM.retainer - STEM.springSeat, 7), 168, 0.0017, 6);
  const retainer = lathe([[0, 0], [0.011, 0], [0.011, 0.0015], [0.006, 0.004], [0, 0.004]], 24);
  const bucket = lathe([[0, 0.002], [0.0145, 0.002], [0.0145, 0], [0.015, 0], [0.015, 0.022], [0, 0.022]], 32);
  const valveList = [];
  const groups = { valves: new THREE.Group(), springs: new THREE.Group(), buckets: new THREE.Group() };
  for (let k = 1; k <= 4; k++) {
    for (const [kind, v] of Object.entries(VALVE)) {
      for (const dx of [-v.x, v.x]) {
        // One frame per valve: origin on the seat, +y up the stem.
        const frame = () => {
          const f = new THREE.Group();
          f.position.set(CYL_X[k - 1] + dx, SEAT.y, v.side * SEAT.z);
          f.rotation.x = v.side * TILT;
          return f;
        };
        const valveFrame = frame();
        const valve = mesh(geometry[kind], kind === 'exhaust' ? hotValve : m.polished);
        valveFrame.add(valve);
        const springFrame = frame();
        const coil = mesh(spring, m.springSteel);
        coil.position.y = STEM.springSeat;
        const cup = mesh(retainer, m.forged);
        springFrame.add(coil, cup);
        const bucketFrame = frame();
        const tappet = mesh(bucket, m.polished);
        bucketFrame.add(tappet);
        groups.valves.add(valveFrame);
        groups.springs.add(springFrame);
        groups.buckets.add(bucketFrame);
        valveList.push({ cylinder: k, kind, valve, coil, cup, tappet });
      }
    }
  }
  // Camshafts: turned at half crank speed by the belt; lobes in the order the firing asks for.
  const lobe = lobeGeometry();
  const shaft = cylinderX(0.012, 2 * HALF + 0.03, 32);
  const cams = {};
  const camPulleys = [];
  for (const [kind, v] of Object.entries(VALVE)) {
    const cam = new THREE.Group();
    cam.position.set(0, CAM.y, v.side * CAM.z);
    const turning = new THREE.Group(); // rotates about the cam axis
    turning.add(mesh(shaft, m.cam));
    for (let k = 1; k <= 4; k++) {
      for (const dx of [-v.x, v.x]) {
        const l = mesh(lobe, m.cam);
        l.position.x = CYL_X[k - 1] + dx;
        l.rotation.x = lobeAngle(k, kind);
        turning.add(l);
      }
    }
    const pulley = toothedPulley(m, 0.043, 0.022, 5);
    pulley.position.x = TIMING_X;
    turning.add(pulley);
    const stub = mesh(cylinderX(0.012, 0.03, 24), m.cam);
    stub.position.x = HALF + 0.015;
    turning.add(stub);
    cam.add(turning);
    cam.add(pickVolume(cylinderX(0.028, 2 * HALF + 0.06, 12), 'cam'));
    // The follower of this side leans with its valves: its frame is turned by the tilt.
    cams[kind] = { group: cam, turning, lean: v.side * TILT };
    camPulleys.push(pulley);
  }
  // Pick volumes over the valve springs of each side.
  for (const v of Object.values(VALVE)) {
    const box = pickVolume(new THREE.BoxGeometry(2 * HALF - 0.02, 0.11, 0.05), 'valve');
    box.position.set(0, 0.3, v.side * 0.036);
    box.rotation.x = v.side * TILT;
    groups.valves.add(box);
  }
  return { ...groups, valveList, cams, camPulleys, exhaustHeat };
}

// ---------- belt ----------

/** Closed path around the convex hull of the pulleys, sampled with outward normals and arc length. */
function beltPath(pulleys, step = 0.002) {
  const n = pulleys.length;
  const normals = pulleys.map((a, i) => {
    const b = pulleys[(i + 1) % n];
    const dz = b.z - a.z;
    const dy = b.y - a.y;
    const L = Math.hypot(dz, dy);
    const ez = dz / L;
    const ey = dy / L;
    const s = (a.r - b.r) / L;
    const c = Math.sqrt(1 - s * s);
    return { z: ey * c + ez * s, y: -ez * c + ey * s };
  });
  const points = [];
  const push = (z, y, nz, ny) => points.push({ z, y, nz, ny });
  for (let i = 0; i < n; i++) {
    const p = pulleys[i];
    const inN = normals[(i + n - 1) % n];
    const outN = normals[i];
    const a0 = Math.atan2(inN.y, inN.z);
    let a1 = Math.atan2(outN.y, outN.z);
    while (a1 < a0) a1 += TAU;
    const steps = Math.max(1, Math.ceil(((a1 - a0) * p.r) / step));
    for (let s = 0; s <= steps; s++) {
      const a = a0 + ((a1 - a0) * s) / steps;
      push(p.z + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, Math.cos(a), Math.sin(a));
    }
    const q = pulleys[(i + 1) % n];
    const from = { z: p.z + outN.z * p.r, y: p.y + outN.y * p.r };
    const to = { z: q.z + outN.z * q.r, y: q.y + outN.y * q.r };
    const len = Math.hypot(to.z - from.z, to.y - from.y);
    const straight = Math.ceil(len / (step * 6));
    for (let s = 1; s < straight; s++) {
      const t = s / straight;
      push(from.z + (to.z - from.z) * t, from.y + (to.y - from.y) * t, outN.z, outN.y);
    }
  }
  points.push({ ...points[0] });
  let length = 0;
  points.forEach((p, i) => {
    if (i) length += Math.hypot(p.z - points[i - 1].z, p.y - points[i - 1].y);
    p.s = length;
  });
  return points;
}

function beltGeometry(points, width, thickness) {
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  // Four strips: outer face, inner (toothed) face, and the two edges.
  const strips = [
    { off: [thickness, thickness], x: [-1, 1], n: (p) => [0, p.ny, p.nz] },
    { off: [0, 0], x: [1, -1], n: (p) => [0, -p.ny, -p.nz] },
    { off: [0, thickness], x: [1, 1], n: () => [1, 0, 0] },
    { off: [thickness, 0], x: [-1, -1], n: () => [-1, 0, 0] },
  ];
  for (const strip of strips) {
    const base = position.length / 3;
    for (const p of points) {
      for (let e = 0; e < 2; e++) {
        const o = strip.off[e];
        position.push((strip.x[e] * width) / 2, p.y + p.ny * o, p.z + p.nz * o);
        normal.push(...strip.n(p));
        uv.push(p.s, e);
      }
    }
    for (let i = 0; i < points.length - 1; i++) {
      const a = base + i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

function buildBelt(m) {
  const belt = new THREE.Group();
  const path = beltPath(PULLEYS);
  const strip = mesh(beltGeometry(path, 0.02, 0.004), m.belt);
  strip.material.side = THREE.DoubleSide;
  belt.add(strip);
  belt.position.x = TIMING_X;
  belt.add(pickVolume(new THREE.BoxGeometry(0.03, 0.46, 0.2).translate(0, 0.19, 0), 'belt'));
  // Idlers: the tensioner and the water pump pulley turn with the belt.
  const idlers = new THREE.Group();
  const spinners = [];
  for (const p of PULLEYS.filter((q) => q.name === 'tensioner' || q.name === 'pump')) {
    const hub = new THREE.Group();
    hub.position.set(TIMING_X, p.y, p.z);
    const wheel = toothedPulley(m, p.r, 0.022, p.name === 'pump' ? 4 : 0);
    hub.add(wheel);
    const post = mesh(cylinderX(0.008, TIMING_X - HALF, 16), m.forged);
    post.position.x = -(TIMING_X - HALF) / 2;
    hub.add(post);
    idlers.add(hub);
    spinners.push({ wheel, radius: p.r });
  }
  return { belt, idlers, spinners, length: path[path.length - 1].s };
}

// ---------- ignition, flame, intake ----------

function buildIgnition(m) {
  const group = new THREE.Group();
  const plug = lathe([
    [0, 0.001], [0.004, 0.001], [0.006, 0.003], [0.006, 0.02], [0.009, 0.02], [0.009, 0.03],
    [0.0055, 0.031], [0.005, 0.085], [0.003, 0.09], [0, 0.09],
  ], 24);
  const sparks = [];
  for (const x of CYL_X) {
    const p = mesh(plug, m.nickel);
    p.position.set(x, 0.225, 0);
    group.add(p);
    const insulator = mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.05, 20), m.ceramic);
    insulator.position.set(x, 0.285, 0);
    group.add(insulator);
    const coil = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.05), m.plastic);
    coil.position.set(x, 0.343, -0.004);
    group.add(coil);
    const plugTop = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 20), m.plastic);
    plugTop.position.set(x, 0.322, 0);
    group.add(plugTop);
    // The spark: a tiny emitter at the electrode.
    const intensity = uniform(0);
    const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const c = color(0x9fc8ff).mul(intensity.mul(12));
    material.colorNode = c;
    material.mrtNode = mrt({ emissive: vec4(c, 1) });
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 12, 8), material);
    spark.position.set(x, 0.223, 0);
    group.add(spark);
    sparks.push(intensity);
  }
  const rail = mesh(new THREE.BoxGeometry(0.34, 0.008, 0.012), m.plastic);
  rail.position.set(0, 0.362, -0.012);
  group.add(rail);
  group.add(pickVolume(new THREE.BoxGeometry(0.36, 0.16, 0.05).translate(0, 0.3, 0), 'spark'));
  return { group, sparks };
}

function buildFlames(parts) {
  const group = new THREE.Group();
  const flames = [];
  const geometry = new THREE.CylinderGeometry(0.0415, 0.0415, 1, 40, 1, true).translate(0, 0.5, 0);
  for (const x of CYL_X) {
    const glow = uniform(0);
    const hot = uniform(0);
    const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    // Brighter through the middle of the column, where the eye looks through more gas.
    const depth = abs(normalView.z).pow(1.5).mul(0.8).add(0.2);
    const flame = color(0xffa040).mul(glow.mul(glow).mul(5)).add(color(0xff5020).mul(glow.mul(2)));
    const gas = color(0xff3a10).mul(hot.mul(0.35));
    const c = flame.add(gas).mul(depth);
    material.colorNode = c;
    material.mrtNode = mrt({ emissive: vec4(c, 1) });
    const column = new THREE.Mesh(geometry, material);
    column.position.x = x;
    column.renderOrder = 2;
    group.add(column);
    // A real light in each chamber, so the flash lights the bore and the piston crown.
    const light = new THREE.PointLight(0xff9a4a, 0, 0.6, 2);
    light.position.set(x, 0.205, 0.035);
    group.add(light);
    flames.push({ column, glow, hot, light });
  }
  parts.flames = group;
  return flames;
}

function buildIntake(m) {
  const group = new THREE.Group();
  const runnerMaterial = m.plastic;
  for (const x of CYL_X) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0.247, -HALF_W + 0.004), new THREE.Vector3(x, 0.262, -0.14),
      new THREE.Vector3(x * 0.96, 0.24, -0.19), new THREE.Vector3(x * 0.9, 0.18, -0.205),
    ]);
    group.add(mesh(new THREE.TubeGeometry(curve, 32, 0.016, 16), runnerMaterial));
    const flange = mesh(new THREE.BoxGeometry(0.05, 0.036, 0.006), m.aluminiumDark);
    flange.position.set(x, 0.247, -HALF_W - 0.003);
    group.add(flange);
  }
  const plenum = mesh(new THREE.CapsuleGeometry(0.04, 0.3, 8, 24), runnerMaterial);
  plenum.rotation.z = Math.PI / 2;
  plenum.position.set(0, 0.155, -0.205);
  group.add(plenum);
  const throttle = mesh(cylinderX(0.028, 0.05, 32), m.aluminiumDark);
  throttle.position.set(0.23, 0.155, -0.205);
  group.add(throttle);
  const mouth = mesh(ringX(0.022, 0.028, 0.004, 32), m.polished);
  mouth.position.set(0.257, 0.155, -0.205);
  group.add(mouth);
  group.add(pickVolume(new THREE.BoxGeometry(0.48, 0.18, 0.14).translate(0.01, 0.19, -0.18), 'manifold'));
  return group;
}

function buildMounts(m) {
  // Two steel stands at the back take the engine by its mount bosses: the front stays open.
  const group = new THREE.Group();
  const y0 = -ENGINE_LAYOUT.position.y;
  for (const x of [-0.17, 0.17]) {
    const column = mesh(new THREE.BoxGeometry(0.04, 0.27, 0.04), m.powder);
    column.position.set(x, y0 + 0.135, -0.15);
    const foot = mesh(new THREE.BoxGeometry(0.1, 0.012, 0.1), m.powder);
    foot.position.set(x, y0 + 0.006, -0.15);
    const arm = mesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), m.powder);
    arm.position.set(x, 0.0, -0.13);
    group.add(column, foot, arm);
  }
  return group;
}

// ---------- assembly ----------

export function buildEngine(m) {
  const root = new THREE.Group();
  root.position.copy(ENGINE_LAYOUT.position);
  const planes = [ENGINE_LAYOUT.cut];
  const parts = {};
  const castings = buildCastings(m, planes, parts);
  const { carrier, camCaps } = buildCarrier(m);
  const { crank, pulley: crankPulley } = buildCrank(m);
  const flywheel = buildFlywheel(m);
  crank.add(flywheel);
  const { pistons, rods } = buildRunningGear(m);
  const train = buildValveTrain(m);
  const belt = buildBelt(m);
  const ignition = buildIgnition(m);
  const flames = buildFlames(parts);
  const intake = buildIntake(m);
  const mounts = buildMounts(m);

  const crankHolder = new THREE.Group(); // explode offset on the holder, rotation on the crank
  crankHolder.add(crank);
  crankHolder.add(pickVolume(cylinderX(0.075, 0.47, 16), 'crank'));
  const flywheelPick = pickVolume(cylinderX(0.147, 0.03, 24), 'flywheel');
  flywheelPick.position.x = FLYWHEEL_X;
  crankHolder.add(flywheelPick);
  const runningGear = new THREE.Group();
  runningGear.add(...pistons, ...rods);
  const camGroup = new THREE.Group();
  camGroup.add(train.cams.intake.group, train.cams.exhaust.group, camCaps);
  // One wrapper per intro stage: the intro drops the wrapper, the exploded view moves the parts inside.
  const stage = (...objects) => {
    const wrapper = new THREE.Group();
    wrapper.add(...objects);
    root.add(wrapper);
    return wrapper;
  };
  const stages = {
    block: stage(castings, mounts),
    crank: stage(crankHolder, runningGear, parts.flames),
    head: stage(carrier, train.valves, train.springs, train.buckets, camGroup, ignition.group),
    belt: stage(belt.belt, belt.idlers, intake),
  };

  // Pick volumes for the castings: the clipped front half is skipped by the picker.
  const blockPick = pickVolume(new THREE.BoxGeometry(2 * HALF, DECK + 0.07, 2 * HALF_W).translate(0, (DECK - 0.07) / 2, 0), 'block');
  blockPick.userData.clip = planes;
  parts.block.add(blockPick);
  const headPick = pickVolume(new THREE.BoxGeometry(2 * HALF, HEAD.carrier - DECK, 2 * HALF_W).translate(0, (HEAD.carrier + DECK) / 2, 0), 'head');
  headPick.userData.clip = planes;
  parts.head.add(headPick);
  const sumpPick = pickVolume(new THREE.BoxGeometry(0.42, 0.1, 0.19).translate(0, -0.12, 0), 'sump');
  sumpPick.userData.clip = planes;
  parts.sump.add(sumpPick);
  for (const object of [blockPick, headPick, sumpPick]) object.material.side = THREE.DoubleSide;

  // Exploded view: where each assembly goes, in the engine frame.
  const explodeList = [
    [parts.sump, [0, -0.16, 0]],
    [parts.caps, [0, -0.1, 0]],
    [crankHolder, [0, -0.06, 0]],
    [flywheel, [-0.1, 0, 0]],
    [parts.head, [0, 0.3, 0]],
    [carrier, [0, 0.3, 0]],
    [train.valves, [0, 0.26, 0]],
    [train.springs, [0, 0.36, 0]],
    [train.buckets, [0, 0.42, 0]],
    [camGroup, [0, 0.5, 0]],
    [ignition.group, [0, 0.44, 0]],
    [belt.belt, [0.16, 0, 0]],
    [belt.idlers, [0.1, 0, 0]],
    [intake, [0, 0.05, -0.16]],
  ].map(([object, offset]) => ({ object, base: object.position.clone(), offset: new THREE.Vector3(...offset) }));
  const pistonLift = 0.22;
  const rodLift = 0.08;

  const pickables = [];
  root.traverse((o) => { if (o.userData.part) pickables.push(o); });

  const state = { crank: 0, explode: 0 };
  const pin = new THREE.Vector3();

  function update(crankAngle, { running, load, explode }) {
    state.crank = crankAngle;
    state.explode = explode;
    for (const { object, base, offset } of explodeList) object.position.copy(base).addScaledVector(offset, explode);
    crank.rotation.x = crankAngle;
    const crankDrop = -0.06 * explode;
    for (let k = 1; k <= 4; k++) {
      const phase = cylinderPhase(k, crankAngle);
      const h = pistonHeight(phase);
      const a = crankAngle + throwAngle(k);
      pin.set(CYL_X[k - 1], R * Math.cos(a), R * Math.sin(a));
      const piston = pistons[k - 1];
      piston.position.y = h + pistonLift * explode;
      const rod = rods[k - 1];
      rod.position.set(pin.x, pin.y + crankDrop + rodLift * explode, pin.z);
      rod.rotation.x = Math.atan2(-pin.z, h - pin.y);
      // Flame: the burn lights the chamber; the burnt gas stays hot through the exhaust stroke.
      const f = flames[k - 1];
      const glow = running ? burnGlow(phase) * (0.35 + 0.65 * load) : 0;
      const hot = running ? Math.max(0, (gasTemperature(phase) - 900) / 1800) * load : 0;
      f.glow.value = glow;
      f.hot.value = explode > 0.01 ? 0 : hot;
      f.column.position.y = h + COMPRESSION_HEIGHT;
      f.column.scale.y = Math.max(0.0005, SEAT.y - f.column.position.y);
      // A few centimetres from the bore: a small intensity is already a bright flash.
      f.light.intensity = explode > 0.01 ? 0 : glow * 0.04 + hot * 0.004;
      const s = ((phase / DEG) % 720 + 720) % 720;
      ignition.sparks[k - 1].value = running && explode < 0.01 && s > 345 && s < 356 ? 1 : 0;
    }
    for (const v of train.valveList) {
      const lift = valveLift(cylinderPhase(v.cylinder, crankAngle), v.kind) * ENGINE.maxValveLift;
      v.valve.position.y = -lift;
      v.cup.position.y = STEM.retainer - lift;
      v.coil.scale.y = (STEM.retainer - lift - STEM.springSeat) / (STEM.retainer - STEM.springSeat);
      v.tappet.position.y = STEM.length - lift;
    }
    for (const cam of Object.values(train.cams)) cam.turning.rotation.x = camAngle(crankAngle) + cam.lean;
    // The belt moves as far as the crank pulley rim turns.
    const travel = crankAngle * PULLEYS[0].r;
    m.beltTravel.value = -travel / 0.0095;
    for (const s of belt.spinners) s.wheel.rotation.x = travel / s.radius;
    train.exhaustHeat.value = running ? load * 0.9 : 0;
  }

  return {
    root, pickables, update, stages,
  };
}

export const ENGINE_POINTS = {
  // Local points for the pinned chips, which sit above them in clear air: the firing chip over the
  // coil packs of its cylinder (k = null: over the middle), the engine chip over the flywheel.
  firing: (k) => new THREE.Vector3(k ? CYL_X[k - 1] : 0, 0.47, 0),
  label: new THREE.Vector3(FLYWHEEL_X - 0.04, 0.2, 0),
};
