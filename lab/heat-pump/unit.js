/**
 * The R290 monoblock: an L-shaped finned coil behind a fan, and a machine
 * compartment with the compressor, the reversing valve, the expansion valve,
 * the plate heat exchanger, the circulation pump and the inverter.
 * Three panels lift away in the open view.
 */
import * as THREE from 'three/webgpu';
import { UNIT, REFRIGERANT, ROUTES, sampleRoute } from './layout.js';
import { Kit, block, rod, tube, turned } from './geometry.js';
import { refrigerantRun, valvePort } from './materials.js';

const FAN = { x: 2.36, y: 0.8, z: -0.7, radius: 0.25, hole: 0.285 };
export const EXPLODE = { top: [0, 0.55, 0], service: [0, 0, 0.55], front: [0.5, 0, 0] };
/** Four-way valve: body axis along x. The slider sits under the top ports; its centre x per season. */
export const VALVE = { y: 0.84, z: -0.22, slider: { winter: 2.35, summer: 2.31 } };
/** The valve port each run ends in: three on top, the compressor discharge below. */
const PORTS = { 'hot gas': [2.29, 0.855, 0.866], return: [2.33, 0.855, 0.866], suction: [2.37, 0.855, 0.866], discharge: [2.33, 0.814, 0.825] };
const [X0, Y0, Z0] = UNIT.min;
const [X1, Y1, Z1] = UNIT.max;
const BASE = Y0 + 0.03;

/** Maps a flat panel drawn in (u = −z, v = y) with thickness along w = +x to world space at `x`. */
function frontPanel() {
  const shape = new THREE.Shape();
  shape.moveTo(-Z1, BASE).lineTo(-Z0, BASE).lineTo(-Z0, Y1 - 0.015).lineTo(-Z1, Y1 - 0.015).lineTo(-Z1, BASE);
  const hole = new THREE.Path();
  hole.absarc(-FAN.z, FAN.y, FAN.hole, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 64 });
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)));
  geometry.translate(X1 - 0.015, 0, 0);
  return geometry;
}

/** One swept fan blade as a thin twisted surface, both sides drawn by the material. */
function blade(angle) {
  const radial = 10;
  const chord = 8;
  const positions = [];
  const index = [];
  for (let i = 0; i <= radial; i++) {
    const r = 0.06 + (FAN.radius - 0.06) * (i / radial);
    const span = 0.55 + 0.45 * (i / radial);
    for (let j = 0; j <= chord; j++) {
      const s = j / chord - 0.5;
      const a = angle + s * span + (i / radial) * 0.35;
      const pitch = s * 0.07 * (1 - 0.4 * (i / radial));
      positions.push(FAN.x + pitch, FAN.y + r * Math.sin(a), FAN.z + r * Math.cos(a));
    }
  }
  for (let i = 0; i < radial; i++) {
    for (let j = 0; j < chord; j++) {
      const a = i * (chord + 1) + j;
      const b = a + chord + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

function torusAround(center, radius, tubeRadius, axis, tubular = 64) {
  const geometry = new THREE.TorusGeometry(radius, tubeRadius, 8, tubular);
  geometry.lookAt(new THREE.Vector3(...axis));
  geometry.translate(...center);
  return geometry;
}

/** Aluminium fins on copper hairpins: back section facing the house, side section facing the garden edge. */
function buildCoil(kit, m) {
  const y0 = 0.36;
  const y1 = 1.22;
  for (let z = -1.03; z < -0.37; z += 0.007) kit.add(m.fin, new THREE.BoxGeometry(0.05, y1 - y0, 0.0006).translate(2.04, (y0 + y1) / 2, z));
  for (let x = 2.07; x < 2.39; x += 0.007) kit.add(m.fin, new THREE.BoxGeometry(0.0006, y1 - y0, 0.05).translate(x, (y0 + y1) / 2, -1.01));
  // Galvanised tube sheets and the extra tube rows between the refrigerant passes.
  kit.add(m.steel, block([2.012, y0 - 0.01, -1.045], [2.068, y1 + 0.01, -1.035], 0.002), block([2.012, y0 - 0.01, -0.37], [2.068, y1 + 0.01, -0.36], 0.002));
  kit.add(m.steel, block([2.39, y0 - 0.01, -1.035], [2.4, y1 + 0.01, -0.985], 0.002));
  for (let y = 0.5; y < 1.2; y += 0.2) kit.add(m.copperCold, rod([2.04, y, -0.97], [2.04, y, -0.43], 0.0065, 10));
  for (let y = 0.4; y < 1.22; y += 0.1) {
    kit.add(m.copperCold, rod([2.068, y, -1.01], [2.41, y, -1.01], 0.0065, 10));
    kit.add(m.copperCold, torusAround([2.41, y + 0.05, -1.01], 0.05, 0.0065, [0, 0, 1], 20));
  }
}

/** Casing: base pan, feet, back and side guards, partition. The panels that open are returned separately. */
function buildCasing(kit, m) {
  kit.add(m.casingDark, block([X0, Y0, Z0], [X1, BASE, Z1], 0.006));
  // Anti-vibration feet on the kerbs.
  for (const [a, b] of [[2.0, 2.07], [2.38, 2.45]]) {
    for (const z of [-0.95, -0.08]) {
      kit.add(m.rubber, block([a, 0.15, z - 0.05], [b, 0.2, z + 0.05], 0.006));
      kit.add(m.casingDark, block([a, 0.2, z - 0.05], [b, Y0, z + 0.05], 0.004));
    }
  }
  // Wire guards over the coil on the house side and on the far side.
  for (let z = -1.03; z < -0.37; z += 0.03) kit.add(m.grille, rod([X0 + 0.004, BASE, z], [X0 + 0.004, Y1 - 0.02, z], 0.0018, 6));
  for (let x = 2.02; x < 2.43; x += 0.03) kit.add(m.grille, rod([x, BASE, Z0 + 0.004], [x, Y1 - 0.02, Z0 + 0.004], 0.0018, 6));
  // Corner posts, the closed back of the machine compartment, the partition.
  for (const [x, z] of [[X0, Z0], [X1 - 0.02, Z0], [X0, Z1 - 0.02]]) kit.add(m.casing, block([x, BASE, z], [x + 0.02, Y1 - 0.015, z + 0.02], 0.004));
  kit.add(m.casing, block([X0, BASE, -0.35], [X0 + 0.012, Y1 - 0.015, Z1 - 0.02], 0.004));
  kit.add(m.steel, block([X0 + 0.012, BASE, -0.36], [X1 - 0.02, Y1 - 0.015, -0.35], 0.002));
  // Fan motor on a bracket from the base to the top rail.
  kit.add(m.steel, block([2.26, BASE, FAN.z - 0.012], [2.272, Y1 - 0.015, FAN.z + 0.012], 0.002));
  kit.add(m.casingDark, rod([2.272, FAN.y, FAN.z], [2.33, FAN.y, FAN.z], 0.055, 32));
  kit.add(m.steel, turned([[0.29, 0], [0.292, 0.01], [0.288, 0.06], [0.3, 0.07]], [X1 - 0.085, FAN.y, FAN.z], [1, 0, 0], 96));
}

/** Compressor, accumulator, valves, plate exchanger, pump, expansion vessel and inverter, as a real unit lays them out. */
function buildMachine(kit, m) {
  // Rotary compressor on three rubber grommets.
  kit.add(m.steel, block([2.25, BASE, -0.3], [2.41, BASE + 0.006, -0.14], 0.002));
  for (const a of [0, 2.1, 4.2]) kit.add(m.rubber, rod([2.33 + 0.07 * Math.cos(a), BASE + 0.006, -0.22 + 0.07 * Math.sin(a)], [2.33 + 0.07 * Math.cos(a), 0.37, -0.22 + 0.07 * Math.sin(a)], 0.012, 12));
  kit.add(m.compressor, turned([[0, 0.36], [0.055, 0.362], [0.075, 0.39], [0.075, 0.65], [0.06, 0.675], [0.02, 0.687], [0, 0.689]], [2.33, 0, -0.22], [0, 1, 0], 48));
  kit.add(m.casingDark, block([2.395, 0.52, -0.25], [2.415, 0.6, -0.19], 0.004));
  kit.add(m.cable, rod([2.41, 0.6, -0.22], [2.41, 1.04, -0.22], 0.005, 8));
  kit.add(m.label, block([2.3, 0.5, -0.1455], [2.36, 0.55, -0.1445], 0.0005));

  // Suction accumulator on a bracket, held by a strap.
  kit.add(m.compressor, turned([[0, 0.45], [0.03, 0.452], [0.04, 0.47], [0.04, 0.63], [0.03, 0.648], [0, 0.65]], [2.16, 0, -0.25], [0, 1, 0], 32));
  kit.add(m.steel, block([2.15, BASE, -0.26], [2.17, 0.45, -0.24], 0.002));
  kit.add(m.steel, torusAround([2.16, 0.56, -0.25], 0.042, 0.004, [0, 1, 0]));

  // The pilot solenoid's cable; the valve itself is built in buildValve().
  kit.add(m.cable, rod([2.33, 0.865, -0.18], [2.33, 1.04, -0.18], 0.004, 8));

  // Electronic expansion valve: brass body and stepper motor.
  kit.add(m.brass, turned([[0.016, -0.02], [0.016, 0.02], [0, 0.022]], [2.08, 0.4, -0.28], [0, 1, 0], 24));
  kit.add(m.casingDark, rod([2.08, 0.422, -0.28], [2.08, 0.48, -0.28], 0.021, 24));
  kit.add(m.cable, rod([2.08, 0.48, -0.28], [2.08, 1.04, -0.28], 0.004, 8));

  // Brazed plate heat exchanger: pressed plates between two end plates, four tie studs, four ports.
  kit.add(m.plate, block([2.05, 0.46, -0.12], [2.25, 0.76, -0.06], 0.008));
  kit.add(m.steel, block([2.05, 0.46, -0.13], [2.25, 0.76, -0.12], 0.004), block([2.05, 0.46, -0.06], [2.25, 0.76, -0.05], 0.004));
  for (const [x, y] of [[2.08, 0.72], [2.08, 0.5], [2.22, 0.72], [2.22, 0.5]]) kit.add(m.brass, rod([x, y, -0.05], [x, y, -0.036], 0.015, 6));
  for (const [x, y] of [[2.06, 0.47], [2.24, 0.47], [2.06, 0.75], [2.24, 0.75]]) kit.add(m.screw, rod([x, y, -0.135], [x, y, -0.045], 0.004, 8));
  kit.add(m.label, block([2.12, 0.58, -0.0499], [2.18, 0.64, -0.0495], 0.0005));

  // Circulation pump on the return: volute around the pipe, motor pointing into the compartment.
  const ret = ROUTES.return.points.at(-2);
  kit.add(m.pump, rod([ret[0], 0.34, 0], [ret[0], 0.44, 0], 0.03, 24));
  kit.add(m.pump, rod([ret[0] - 0.02, 0.39, 0], [2.13, 0.39, 0], 0.035, 24));
  kit.add(m.casingDark, block([2.14, 0.39, -0.025], [2.19, 0.43, 0.025], 0.005));

  // Expansion vessel on the return, with its line to the pump inlet.
  kit.add(m.vessel, turned([[0, 0.345], [0.03, 0.35], [0.045, 0.37], [0.045, 0.53], [0.03, 0.548], [0, 0.55]], [2.38, 0, -0.05], [0, 1, 0], 32));
  kit.add(m.copper, tube(ROUTES.vessel, ROUTES.vessel.radius, 10));

  // Inverter: a box under the top panel with its board, capacitors and PFC choke.
  kit.add(m.casingDark, block([X0 + 0.012, 1.04, -0.35], [2.4, 1.22, -0.02], 0.004));
  kit.add(m.pcb, block([2.03, 1.06, -0.02], [2.38, 1.2, -0.016], 0.001));
  for (let i = 0; i < 3; i++) kit.add(m.capacitor, rod([2.07 + i * 0.045, 1.14, -0.016], [2.07 + i * 0.045, 1.14, 0.02], 0.016, 20));
  kit.add(m.choke, torusAround([2.3, 1.13, -0.005], 0.024, 0.01, [0, 0, 1]));
  kit.add(m.grille, block([2.25, 1.075, -0.016], [2.37, 1.09, -0.006], 0.002));
  // Mains cable from the duct at the base up to the inverter.
  const duct = ROUTES.power.points.at(-1);
  kit.add(m.cable, rod([duct[0], BASE, -0.01], [duct[0], 1.04, -0.01], 0.006, 8));
  kit.add(m.rubber, turned([[0.024, 0], [0.024, 0.02], [0.018, 0.028]], [duct[0], Y0, 0], [0, 1, 0], 6));
}

/**
 * Four-way valve: a brass body that can be cut open, the slider inside it,
 * the pilot solenoid that slides up off its stem while the body is open, and
 * four ports that glow in the colour of the gas through them.
 */
function buildValve(stage, m, runs) {
  const body = new Kit().add(m.valveBody, rod([2.28, VALVE.y, VALVE.z], [2.38, VALVE.y, VALVE.z], 0.022, 32)).build();
  // The slider: a cup pressed against the seat under the top ports; it joins the middle port with one outer port.
  const slider = new Kit().add(m.slider, block([-0.028, VALVE.y + 0.002, VALVE.z - 0.015], [0.028, VALVE.y + 0.019, VALVE.z + 0.015], 0.005)).build();
  slider.position.x = VALVE.slider.winter;
  const solenoid = new Kit().add(m.casingDark, block([2.31, 0.82, -0.198], [2.35, 0.865, -0.165], 0.004)).build();
  const ports = new Kit();
  for (const [name, [x, y0, y1]] of Object.entries(PORTS)) ports.add(runs[name].port, rod([x, y0, VALVE.z], [x, y1, VALVE.z], 0.013, 12));
  stage.add(body, slider, solenoid, ports.build());
  return { slider, solenoid };
}

/** Length of a route in metres, for the spacing of the refrigerant points. */
function routeLength(route) {
  const points = sampleRoute(route, 0.005);
  return points.slice(1).reduce((sum, p, i) => sum + Math.hypot(...p.map((n, k) => n - points[i][k])), 0);
}

export function buildUnit(stage, m) {
  const kit = new Kit();
  buildCasing(kit, m);
  buildCoil(kit, m);
  buildMachine(kit, m);
  // One material per run, so each can carry its own state, speed and direction.
  const runs = {};
  for (const route of REFRIGERANT) {
    const run = refrigerantRun(routeLength(route));
    run.port = PORTS[route.name] && valvePort(run.live.temperature);
    runs[route.name] = run;
    kit.add(run.material, tube(route, route.radius, 12));
  }
  kit.build(stage);
  const valve = buildValve(stage, m, runs);

  // Fan: hub and three swept blades, turning about +x.
  const fan = new THREE.Group();
  fan.position.set(0, FAN.y, FAN.z);
  const fanKit = new Kit();
  fanKit.add(m.blade, blade(0), blade((Math.PI * 2) / 3), blade((Math.PI * 4) / 3));
  fanKit.add(m.casingDark, turned([[0, -0.03], [0.055, -0.03], [0.06, 0.02], [0.03, 0.04], [0, 0.045]], [FAN.x, FAN.y, FAN.z], [1, 0, 0], 32));
  const fanMeshes = fanKit.build();
  fanMeshes.position.set(0, -FAN.y, -FAN.z);
  fan.add(fanMeshes);
  stage.add(fan);

  // Panels that lift away.
  const top = new Kit().add(m.casing, block([X0 - 0.01, Y1 - 0.015, Z0 - 0.01], [X1 + 0.01, Y1, Z1 + 0.01], 0.006)).build();
  const service = new Kit()
    .add(m.casing, block([X0 + 0.012, BASE, Z1 - 0.015], [X1 - 0.02, Y1 - 0.015, Z1], 0.004))
    .add(m.casingDark, ...Array.from({ length: 6 }, (_, i) => block([2.07, 0.4 + i * 0.03, Z1], [2.38, 0.41 + i * 0.03, Z1 + 0.003], 0.001)))
    .add(m.label, block([2.25, 1.02, Z1], [2.38, 1.12, Z1 + 0.0015], 0.0005))
    .add(m.casingDark, block([2.1, 0.95, Z1], [2.2, 0.975, Z1 + 0.018], 0.006))
    .build();
  const front = new Kit().add(m.casing, frontPanel());
  for (const r of [0.07, 0.13, 0.19, 0.25, 0.3]) front.add(m.grille, torusAround([X1 + 0.01, FAN.y, FAN.z], r, 0.0022, [1, 0, 0]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    front.add(m.grille, rod([X1 + 0.01, FAN.y + 0.04 * Math.sin(a), FAN.z + 0.04 * Math.cos(a)], [X1 + 0.01, FAN.y + 0.3 * Math.sin(a), FAN.z + 0.3 * Math.cos(a)], 0.0022, 6));
  }
  front.add(m.label, block([X1, 0.4, -0.3], [X1 + 0.0015, 0.44, -0.12], 0.0005));
  const frontGroup = front.build();
  const panels = { top, service, front: frontGroup };
  stage.add(top, service, frontGroup);

  const centres = Object.fromEntries(Object.entries(panels).map(([key, group]) => {
    const box = new THREE.Box3();
    for (const mesh of group.children) {
      mesh.geometry.computeBoundingBox();
      box.union(mesh.geometry.boundingBox);
    }
    return [key, box.getCenter(new THREE.Vector3())];
  }));

  /** 0 closed, 1 open. The panels lift away, then vanish about their centres: a panel left in mid-air hides the machine. */
  function open(k) {
    const t = Math.min(1, Math.max(0, (k - 0.45) / 0.55));
    const s = Math.max(1e-4, 1 - t * t * (3 - 2 * t));
    for (const [key, group] of Object.entries(panels)) {
      group.scale.setScalar(s);
      group.position.fromArray(EXPLODE[key]).multiplyScalar(k).addScaledVector(centres[key], 1 - s);
    }
  }
  return { fan, open, valve, runs };
}
