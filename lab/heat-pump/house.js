/**
 * The house side of the diorama: ground, foundation, floor build-up and the
 * layered walls from layout.js, then the window, the furniture, the radiator
 * and the manifold cabinet.
 */
import * as THREE from 'three/webgpu';
import { SOLIDS, WINDOW, BACK_INNER, WALL_INNER, LEVEL, MANIFOLD, RADIATOR, CABINET, CONSUMER, ROUTES } from './layout.js';
import { Kit, block, rod, turned, place } from './geometry.js';
import { createPlumeMaterial } from './materials.js';

const SOIL = new Set(['topsoil', 'subsoil', 'sand', 'backfill', 'fill', 'gravel']);

/** The layered solids, one kit per construction stage. */
function buildSolids(stages, m) {
  const kits = {};
  for (const s of SOLIDS) {
    const bevel = s.material === 'base' ? 0.02 : SOIL.has(s.material) ? 0.01 : 0.004;
    (kits[s.stage] ??= new Kit()).add(m[s.material], block(s.min, s.max, bevel));
  }
  for (const [stage, kit] of Object.entries(kits)) kit.build(stages[stage]);
}

/** Triple-glazed window set in the insulation plane, with inner and outer sills. */
function buildWindow(kit, m) {
  const { x0, x1, y0, y1 } = WINDOW;
  const z0 = -3.49;
  const z1 = -3.41;
  const bar = 0.07;
  const mid = (x0 + x1) / 2;
  kit.add(m.frame,
    block([x0, y0, z0], [x1, y0 + bar, z1]),
    block([x0, y1 - bar, z0], [x1, y1, z1]),
    block([x0, y0 + bar, z0], [x0 + bar, y1 - bar, z1]),
    block([x1 - bar, y0 + bar, z0], [x1, y1 - bar, z1]),
    block([mid - bar / 2, y0 + bar, z0], [mid + bar / 2, y1 - bar, z1]),
  );
  // Sashes: a slimmer frame inside each half, holding the glass.
  const sash = 0.045;
  for (const [a, b] of [[x0 + bar, mid - bar / 2], [mid + bar / 2, x1 - bar]]) {
    kit.add(m.frame,
      block([a, y0 + bar, z0 + 0.01], [b, y0 + bar + sash, z1 + 0.012]),
      block([a, y1 - bar - sash, z0 + 0.01], [b, y1 - bar, z1 + 0.012]),
      block([a, y0 + bar + sash, z0 + 0.01], [a + sash, y1 - bar - sash, z1 + 0.012]),
      block([b - sash, y0 + bar + sash, z0 + 0.01], [b, y1 - bar - sash, z1 + 0.012]),
    );
    for (const z of [-3.465, -3.45, -3.435]) kit.add(m.glass, block([a + sash, y0 + bar + sash, z - 0.002], [b - sash, y1 - bar - sash, z + 0.002], 0.001));
    // Handle on the inner face of the sash.
    kit.add(m.chrome, block([b - 0.03, (y0 + y1) / 2 - 0.01, z1 + 0.012], [b - 0.018, (y0 + y1) / 2 + 0.11, z1 + 0.03], 0.004));
  }
  kit.add(m.sill, block([x0, y0 - 0.0, z1], [x1, y0 + 0.025, BACK_INNER + 0.02], 0.005));
  kit.add(m.frame, block([x0, y0, -3.65], [x1, y0 + 0.02, z0], 0.004));
}

/** Sofa, rug, coffee table, floor lamp and a plant: for scale, and to make it a room. */
function buildFurniture(kit, m) {
  const f = LEVEL.floor;
  // Sofa along the cut side of the room, facing the window wall.
  const sx0 = -3.95, sx1 = -3.1, sz0 = -3.05, sz1 = -1.65;
  for (const [x, z] of [[sx0 + 0.05, sz0 + 0.05], [sx1 - 0.05, sz0 + 0.05], [sx0 + 0.05, sz1 - 0.05], [sx1 - 0.05, sz1 - 0.05]]) {
    kit.add(m.walnut, rod([x, f, z], [x, f + 0.1, z], 0.018, 12, 0.014));
  }
  kit.add(m.fabric,
    block([sx0, f + 0.1, sz0], [sx1, f + 0.28, sz1], 0.04),
    block([sx0, f + 0.28, sz0], [sx0 + 0.2, f + 0.75, sz1], 0.06),
    block([sx0 + 0.2, f + 0.28, sz0], [sx1, f + 0.5, sz0 + 0.16], 0.06),
    block([sx0 + 0.2, f + 0.28, sz1 - 0.16], [sx1, f + 0.5, sz1], 0.06),
  );
  const seatZ = [sz0 + 0.16, (sz0 + sz1) / 2, sz1 - 0.16];
  for (let i = 0; i < 2; i++) kit.add(m.fabric, block([sx0 + 0.2, f + 0.28, seatZ[i] + 0.005], [sx1 - 0.02, f + 0.4, seatZ[i + 1] - 0.005], 0.05));
  for (let i = 0; i < 2; i++) kit.add(m.fabric, block([sx0 + 0.2, f + 0.4, seatZ[i] + 0.01], [sx0 + 0.36, f + 0.72, seatZ[i + 1] - 0.01], 0.06));
  kit.add(m.cushion, place(block([-0.07, -0.2, -0.2], [0.07, 0.2, 0.2], 0.06), [sx0 + 0.36, f + 0.58, sz0 + 0.42], [0, 0, -0.35]));

  // Rug and coffee table.
  kit.add(m.rug, block([-3.0, f, -2.95], [-1.65, f + 0.008, -1.75], 0.003));
  kit.add(m.walnut, block([-2.7, f + 0.4, -2.65], [-2.0, f + 0.43, -2.05], 0.008));
  for (const x of [-2.66, -2.04]) for (const z of [-2.61, -2.09]) kit.add(m.blackSteel, rod([x, f + 0.008, z], [x, f + 0.4, z], 0.012));
  kit.add(m.blackSteel, block([-2.66, f + 0.12, -2.61], [-2.04, f + 0.135, -2.09], 0.004));

  // Floor lamp beside the sofa.
  const lamp = [-3.0, f, -3.0];
  kit.add(m.blackSteel, turned([[0, 0], [0.13, 0], [0.14, 0.008], [0.13, 0.022], [0.02, 0.03], [0, 0.03]], lamp, [0, 1, 0], 40));
  kit.add(m.blackSteel, rod([lamp[0], f + 0.03, lamp[2]], [lamp[0], f + 1.4, lamp[2]], 0.011));
  kit.add(m.shade, turned([[0.16, 0], [0.12, 0.26]], [lamp[0], f + 1.32, lamp[2]], [0, 1, 0], 48));

  // Plant in the corner by the manifold.
  const pot = [-0.9, f, -2.85];
  kit.add(m.pot, turned([[0, 0], [0.12, 0], [0.155, 0.34], [0.16, 0.35], [0.145, 0.35], [0.14, 0.32], [0, 0.32]], pot, [0, 1, 0], 40));
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4;
    const tilt = 0.35 + (i % 3) * 0.2;
    const leaf = new THREE.SphereGeometry(1, 12, 8);
    leaf.scale(0.05, 0.3, 0.012);
    leaf.translate(0, 0.28, 0);
    kit.add(m.leaf, place(leaf, [pot[0], f + 0.32, pot[2]], [tilt * Math.cos(a), a, tilt * Math.sin(a)]));
  }
}

/** Type 22 steel panel radiator on two wall brackets, TRV on the flow end, lockshield on the return, bleed at the top. */
function buildRadiator(kit, m) {
  const { min, max } = RADIATOR;
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const panel = 0.022;
  // Two water panels with the pressed vertical channels (in the material), convector fins between them.
  kit.add(m.radiator, block([x0, y0 + 0.01, z0], [x1, y1 - 0.02, z0 + panel], 0.006));
  kit.add(m.radiator, block([x0, y0 + 0.01, z1 - panel], [x1, y1 - 0.02, z1], 0.006));
  for (let x = x0 + 0.02; x < x1 - 0.01; x += 0.033) {
    kit.add(m.radiator, block([x, y0 + 0.04, z0 + panel], [x + 0.0012, y1 - 0.04, z1 - panel], 0.0004));
  }
  // Top grille and side covers.
  kit.add(m.radiator, block([x0, y1 - 0.02, z0], [x1, y1, z1], 0.004));
  for (const x of [x0 - 0.003, x1]) kit.add(m.radiator, block([x, y0 + 0.01, z0], [x + 0.003, y1, z1], 0.001));
  // Wall brackets: a flat bar screwed to the plaster, hooked over the back panel.
  for (const x of [x0 + 0.2, x1 - 0.2]) {
    for (const y of [y0 + 0.12, y1 - 0.08]) {
      kit.add(m.blackSteel, block([x - 0.02, y - 0.04, BACK_INNER], [x + 0.02, y + 0.04, z0 + 0.004], 0.002));
      kit.add(m.screw, rod([x, y, BACK_INNER], [x, y, BACK_INNER + 0.012], 0.006, 12));
    }
  }
  // Valves: body on top of each riser, a tail into the radiator side.
  const valveY = ROUTES.radiatorFlow.points.at(-1)[1];
  const zc = ROUTES.radiatorFlow.points.at(-1)[2];
  for (const [x, side] of [[ROUTES.radiatorFlow.points.at(-1)[0], x0], [ROUTES.radiatorReturn.points[0][0], x1]]) {
    kit.add(m.chrome, rod([x, valveY - 0.01, zc], [x, valveY + 0.065, zc], 0.016));
    kit.add(m.chrome, rod([x, valveY + 0.035, zc], [side, valveY + 0.035, zc], 0.011));
    kit.add(m.chrome, turned([[0.019, 0], [0.019, 0.012], [0, 0.012]], [side + (x < side ? -0.014 : 0.002), valveY + 0.035, zc], [1, 0, 0], 6));
  }
  const trv = ROUTES.radiatorFlow.points.at(-1)[0];
  // TRV head: a ribbed white cylinder with a numbered dial.
  kit.add(m.trvHead, turned([[0, 0], [0.024, 0], [0.027, 0.01], [0.027, 0.085], [0.022, 0.095], [0, 0.097]], [trv, valveY + 0.065, zc], [0, 1, 0], 24));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    kit.add(m.trvHead, block([-0.002, 0, -0.002], [0.002, 0.06, 0.002], 0.001).translate(trv + 0.027 * Math.cos(a), valveY + 0.085, zc + 0.027 * Math.sin(a)));
  }
  // Lockshield: a plain chrome cap.
  const lock = ROUTES.radiatorReturn.points[0][0];
  kit.add(m.chrome, turned([[0, 0], [0.017, 0], [0.017, 0.028], [0.012, 0.034], [0, 0.034]], [lock, valveY + 0.065, zc], [0, 1, 0], 6));
  // Bleed valve: a square spindle in a small chrome plug at the top of the return end.
  kit.add(m.chrome, turned([[0.009, 0], [0.009, 0.01], [0.005, 0.01], [0.005, 0.016], [0, 0.016]], [x1 + 0.003, y1 - 0.035, zc], [1, 0, 0], 12));
}

/** Plume of warm air over the radiator. */
function buildPlume() {
  const { min, max } = RADIATOR;
  const geometry = new THREE.PlaneGeometry(max[0] - min[0] + 0.1, 0.95, 1, 1);
  const mesh = new THREE.Mesh(geometry, createPlumeMaterial());
  mesh.position.set((min[0] + max[0]) / 2, max[1] + 0.47, (min[2] + max[2]) / 2 + 0.03);
  mesh.rotation.x = -0.12;
  mesh.renderOrder = 2;
  return mesh;
}

/** Manifold cabinet on the inner face of the outside wall, open where the section cuts it. */
function buildManifold(kit, m) {
  const { min, max } = CABINET;
  const t = 0.012;
  // A galvanised box with a white door on the room side; the section cuts its front away.
  kit.add(m.galvanized,
    block([max[0] - t, min[1], min[2]], [max[0], max[1], max[2]], 0.003),
    block([min[0], min[1], min[2]], [max[0] - t, min[1] + t, max[2]], 0.003),
    block([min[0], max[1] - t, min[2]], [max[0] - t, max[1], max[2]], 0.003),
    block([min[0], min[1] + t, min[2]], [max[0] - t, max[1] - t, min[2] + t], 0.003),
  );
  kit.add(m.cabinet, block([min[0], min[1] + t, min[2] + t], [min[0] + t, max[1] - t, max[2]], 0.003));
  // Louvres in the door.
  for (let y = min[1] + 0.08; y < max[1] - 0.06; y += 0.04) kit.add(m.cabinet, block([min[0] - 0.006, y, min[2] + 0.05], [min[0], y + 0.012, max[2] - 0.05], 0.002));

  for (const [key, bar] of Object.entries(MANIFOLD)) {
    kit.add(m.manifoldBrass, rod([bar.x, bar.y, bar.z0], [bar.x, bar.y, bar.z1], bar.radius, 20).rotateX(0).translate(0, 0, 0));
    // Hex end caps and the ball valve lever where the supply pipe comes in.
    kit.add(m.manifoldBrass, turned([[0.022, 0], [0.022, 0.012], [0, 0.012]], [bar.x, bar.y, bar.z0 - 0.012], [0, 0, 1], 6));
    kit.add(m.isolatorKnob, block([bar.x - 0.006, bar.y + bar.radius, bar.z1 - 0.03], [bar.x + 0.006, bar.y + bar.radius + 0.012, bar.z1 - 0.012], 0.002));
    kit.add(m.isolatorKnob, block([bar.x - 0.006, bar.y + bar.radius + 0.006, bar.z1 - 0.03], [bar.x + 0.07 * (key === 'flow' ? 1 : -1) + 0.006, bar.y + bar.radius + 0.012, bar.z1 - 0.018], 0.002));
    // Outlets: one per circuit, capped where no circuit is shown.
    for (const z of [-0.12, -0.22, -0.32, -0.4]) {
      const y = bar.y - bar.radius;
      kit.add(m.manifoldBrass, rod([bar.x, y + 0.004, z], [bar.x, y - 0.025, z], 0.011, 6));
      if (key === 'flow') {
        // Flow meter on top: a clear sight tube with a red float.
        kit.add(m.glass, rod([bar.x, bar.y + bar.radius, z], [bar.x, bar.y + bar.radius + 0.07, z], 0.009, 16));
        kit.add(m.isolatorKnob, rod([bar.x, bar.y + bar.radius + 0.03, z], [bar.x, bar.y + bar.radius + 0.042, z], 0.006, 12));
        kit.add(m.manifoldBrass, rod([bar.x, bar.y + bar.radius + 0.07, z], [bar.x, bar.y + bar.radius + 0.078, z], 0.01, 6));
      } else {
        // Thermostatic insert with its white cap.
        kit.add(m.trvHead, rod([bar.x, bar.y + bar.radius, z], [bar.x, bar.y + bar.radius + 0.03, z], 0.011, 16));
      }
    }
    // Brackets to the back panel.
    for (const z of [-0.45, -0.08]) kit.add(m.blackSteel, block([bar.x - 0.01, bar.y - 0.01, z - 0.01], [WALL_INNER - t, bar.y + 0.01, z + 0.01], 0.002));
  }
  // Caps on the unused outlets.
  const drops = { flow: [-0.22, -0.32, -0.4], return: [-0.12, -0.22, -0.32] };
  for (const [key, list] of Object.entries(drops)) {
    const bar = MANIFOLD[key];
    for (const z of list) kit.add(m.manifoldBrass, turned([[0, 0], [0.013, 0], [0.013, 0.012], [0, 0.012]], [bar.x, bar.y - bar.radius - 0.037, z], [0, 1, 0], 6));
  }
}

/** Consumer unit with the heat pump breaker and the cable into the wall towards the outdoor isolator. */
function buildConsumer(kit, m) {
  const { min, max } = CONSUMER;
  kit.add(m.consumer, block(min, max, 0.008));
  kit.add(m.breaker, block([min[0] - 0.004, 1.52, min[2] + 0.04], [min[0], 1.62, max[2] - 0.04], 0.002));
  for (let z = min[2] + 0.05; z < max[2] - 0.06; z += 0.018) {
    kit.add(m.consumer, block([min[0] - 0.012, 1.56, z], [min[0] - 0.004, 1.585, z + 0.012], 0.002));
  }
  kit.add(m.cable, rod([WALL_INNER, 1.4, -0.12], [0, 1.4, -0.12], 0.006, 8));
}

export function buildHouse(stages, m) {
  buildSolids(stages, m);

  const walls = new Kit();
  buildWindow(walls, m);
  walls.build(stages.walls);

  const interior = new Kit();
  buildFurniture(interior, m);
  buildManifold(interior, m);
  buildConsumer(interior, m);
  interior.build(stages.interior);

  // The lamp lights the room; bloom picks up its shade. The caller adds the light to the scene, not to a stage:
  // a light inside a hidden stage is missing while the shaders compile, and every program would be built again when it shows.
  const lampLight = new THREE.PointLight(0xffc58a, 2.2, 5, 2);
  lampLight.position.set(-3.0, LEVEL.floor + 1.42, -3.0);

  const radiator = new THREE.Group();
  const radiatorKit = new Kit();
  buildRadiator(radiatorKit, m);
  radiatorKit.build(radiator);
  const plume = buildPlume();
  radiator.add(plume);
  stages.interior.add(radiator);

  return { radiator, plume, lampLight };
}
