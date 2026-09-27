/**
 * Everything that connects the unit to the house: the pre-insulated twin
 * pipe in its trench, the power duct, the wall sleeve, the carriers up to the
 * manifold, and the two emitters' pipework (underfloor loop or radiator).
 */
import * as THREE from 'three/webgpu';
import { ROUTES, INSULATION, CLIPS, ISOLATOR, TRENCH, LEVEL, WALL_INNER, UFH_LAYOUT, FLOOR_STEPS } from './layout.js';
import { Kit, block, rod, tube, turned } from './geometry.js';

const CUT = { x0: 0.55, x1: 1.75 }; // where the twin pipe's jacket is cut open

/** A half disc facing ±x at `x`, filling the jacket on the front side of the section. */
function halfDisc(x, radius, y, facing) {
  const geometry = new THREE.CircleGeometry(radius, 32, facing > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI);
  geometry.rotateY(facing > 0 ? Math.PI / 2 : -Math.PI / 2);
  geometry.translate(x, y, 0);
  return geometry;
}

function buildJacket(kit, m) {
  const jacket = ROUTES.jacket;
  const [start] = jacket.points;
  const y = start[1];
  const r = jacket.radius;
  kit.add(m.jacket, tube(jacket, r, 32));
  // Inside the cut: PUR foam around the carriers, seen on the section plane and at both ends of the cut.
  kit.add(m.jacketFoam, new THREE.PlaneGeometry(CUT.x1 - CUT.x0, 2 * r - 0.006).translate((CUT.x0 + CUT.x1) / 2, y, 0.002));
  kit.add(m.jacketFoam, halfDisc(CUT.x0, r - 0.003, y, 1), halfDisc(CUT.x1, r - 0.003, y, -1));
  // End cap where the pipe stops inside the foundation, and the boot where it comes up at grade.
  kit.add(m.epdm, turned([[0, 0], [r + 0.004, 0], [r + 0.004, 0.02], [0.03, 0.03], [0, 0.03]], [start[0] + 0.02, y, 0], [-1, 0, 0], 32));
  const top = jacket.points.at(-1);
  kit.add(m.epdm, turned([[r + 0.004, -0.04], [r + 0.004, 0], [0.03, 0.02], [0.022, 0.03]], top, [0, 1, 0], 32));
}

/** The flow and return carriers, their foam sleeves above ground, and the sleeve through the stem wall. */
function buildCarriers(kit, m) {
  kit.add(m.flowPipe, tube(ROUTES.flow, ROUTES.flow.radius, 16));
  kit.add(m.returnPipe, tube(ROUTES.return, ROUTES.return.radius, 16));
  for (const sleeve of INSULATION) kit.add(m.foam, tube(sleeve, sleeve.radius, 20));

  // Sleeve through the stem wall and perimeter insulation, sealed with an EPDM ring on the outside.
  const y = ROUTES.jacket.points[0][1];
  kit.add(m.duct, rod([WALL_INNER, y, 0], [0.02, y, 0], 0.11, 40));
  kit.add(m.epdm, turned([[0.088, 0], [0.12, 0], [0.12, 0.02], [0.088, 0.02]], [0.0, y, 0], [1, 0, 0], 40));
}

/** Power: consumer unit → wall → isolator → duct down the wall, along the trench, up into the unit base. */
function buildPower(kit, m) {
  kit.add(m.powerDuct, tube(ROUTES.power, ROUTES.power.radius, 16));
  kit.add(m.isolator, block(ISOLATOR.min, ISOLATOR.max, 0.01));
  const [x0, y0, z0] = ISOLATOR.min;
  const [x1, y1, z1] = ISOLATOR.max;
  const mid = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  kit.add(m.isolatorKnob, block([x1, mid[1] - 0.05, mid[2] - 0.012], [x1 + 0.02, mid[1] + 0.05, mid[2] + 0.012], 0.006));
  kit.add(m.isolatorKnob, turned([[0, 0], [0.03, 0], [0.03, 0.01], [0, 0.012]], [x1, mid[1], mid[2]], [1, 0, 0], 32));
  // Cable gland where the duct enters the isolator.
  const [gx, , gz] = ROUTES.power.points[0];
  kit.add(m.rubber, turned([[0.022, 0], [0.022, 0.02], [0.018, 0.03]], [gx, y0 - 0.03, gz], [0, 1, 0], 6));
  // Saddle clips screwed to the render.
  for (const [x, y, z] of CLIPS) {
    kit.add(m.duct, block([0.0, y - 0.012, z - 0.034], [x + 0.024, y + 0.012, z + 0.034], 0.006));
    for (const dz of [-0.026, 0.026]) kit.add(m.screw, turned([[0.005, 0], [0.005, 0.003], [0, 0.004]], [x + 0.024, y, z + dz], [1, 0, 0], 12));
  }
  // Warning tape 30 cm above the services, as the regulations ask.
  kit.add(m.tape, block([TRENCH.x0 + 0.02, -0.281, -0.12], [TRENCH.x1 - 0.02, -0.279, 0.003], 0.0005));
}

/** Underfloor loop on the tacker board, with its staples where the screed is cut back. */
function buildFloorLoop(kit, m) {
  kit.add(m.loopPipe, tube(ROUTES.ufh, ROUTES.ufh.radius, 12));
  const y = LEVEL.insulationTop;
  for (let k = 0; k < UFH_LAYOUT.rows; k++) {
    const z = UFH_LAYOUT.first - k * UFH_LAYOUT.pitch;
    if (z < FLOOR_STEPS.screedFront) break;
    for (let x = UFH_LAYOUT.left + 0.25; x < UFH_LAYOUT.right - 0.1; x += 0.45) {
      kit.add(m.screw, block([x - 0.004, y, z - 0.013], [x + 0.004, y + 0.019, z - 0.009], 0.001), block([x - 0.004, y, z + 0.009], [x + 0.004, y + 0.019, z + 0.013], 0.001), block([x - 0.004, y + 0.017, z - 0.013], [x + 0.004, y + 0.019, z + 0.013], 0.0008));
    }
  }
}

export function buildServices(stages, m) {
  const kit = new Kit();
  buildJacket(kit, m);
  buildCarriers(kit, m);
  buildPower(kit, m);
  kit.build(stages.services);

  const floorLoop = new THREE.Group();
  const loopKit = new Kit();
  buildFloorLoop(loopKit, m);
  loopKit.build(floorLoop);

  const radiatorPipes = new THREE.Group();
  new Kit()
    .add(m.flowPipe, tube(ROUTES.radiatorFlow, ROUTES.radiatorFlow.radius, 12))
    .add(m.returnPipe, tube(ROUTES.radiatorReturn, ROUTES.radiatorReturn.radius, 12))
    .build(radiatorPipes);

  stages.services.add(floorLoop, radiatorPipes);
  return { floorLoop, radiatorPipes };
}
