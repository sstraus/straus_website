// Headless smoke build of the 3D scene (lab/proto/README.md, "Headless smoke build"): it builds the
// world, the rover and the dust in node against the three r186 package, drives a run through them
// and checks that nothing is NaN and that the rover stands on the sand. It compiles no shader: only
// a browser can do that.
//
// The package lives outside the repository, so these tests skip themselves when it is missing:
//   mkdir -p /tmp/tp && cd /tmp/tp && npm pack three@0.186.0 && tar xzf three-0.186.0.tgz
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';

const THREE_PACKAGE = '/tmp/tp/package';
const available = existsSync(`${THREE_PACKAGE}/build/three.webgpu.js`);
if (available) {
  registerHooks({
    resolve(specifier, context, next) {
      const url = (path) => ({ url: `file://${THREE_PACKAGE}/${path}`, shortCircuit: true });
      if (specifier === 'three' || specifier === 'three/webgpu') return url('build/three.webgpu.js');
      if (specifier === 'three/tsl') return url('build/three.tsl.js');
      if (specifier.startsWith('three/addons/')) return url(`examples/jsm/${specifier.slice(13)}`);
      return next(specifier, context);
    },
  });
}
const options = { skip: available ? false : 'three r186 package not unpacked in /tmp/tp' };

// main.js runs `await start()` at the top level, and start() draws the first frames itself, so every
// top-level const or let below that await is still in its dead zone while those frames run.
test('main.js declares nothing below its top-level await (catches a dead-zone crash on load)', () => {
  const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  const at = source.indexOf('await start()');
  assert.ok(at > 0, 'main.js no longer starts with a top-level await: update this check');
  const below = source.slice(at).split('\n').filter((line) => /^(const|let|var) /.test(line));
  assert.deepEqual(below, []);
});

async function build() {
  const THREE = await import('three/webgpu');
  const { createWorld } = await import('./world.js');
  const { buildRover, roverMaterials } = await import('./rover-model.js');
  const { createDust } = await import('./dust.js');
  const { createGame, update, sky } = await import('./game.js');
  const { pose } = await import('./physics.js');
  const scene = new THREE.Scene();
  const game = createGame(3);
  const world = createWorld(scene, game.terrain);
  const rover = buildRover(roverMaterials(null));
  const dust = createDust();
  scene.add(world.root, rover.root, dust.mesh);
  const camera = new THREE.PerspectiveCamera(40, 0.46, 0.2, 3000);
  return { THREE, scene, game, world, rover, dust, camera, update, sky, pose };
}
const s = available ? await build() : null;

test('a whole run drives through the scene with no NaN (catches a renderer that misreads the physics)', options, () => {
  const { game, world, rover, dust, camera, update, sky, pose } = s;
  let travel = 0;
  for (let i = 0; i < 60 * 90 && !game.over; i++) {
    update(game, 1 / 60, { jumpPressed: i % 170 === 0 });
    travel += Math.hypot(game.rover.vx, game.rover.vy) / 60;
    const p = pose(game.rover);
    rover.update(p, travel, i / 60);
    camera.position.set(game.rover.x + 4, game.rover.y + 3, 22);
    world.update(camera, game.rover.x, sky(game.distance));
    dust.trail(p, 10, 1 / 60);
    dust.update(camera, 1 / 60);
  }
  const bad = [];
  s.scene.traverse((o) => {
    if (!o.position.toArray().every(Number.isFinite) || !o.scale.toArray().every(Number.isFinite)) bad.push(o.name || o.type);
  });
  assert.deepEqual(bad, []);
  assert.ok(game.distance > 150, `the run went only ${game.distance.toFixed(0)} m`);
});

test('the ground under the rover is the ground the physics drives on (catches a mesh off the track)', options, () => {
  const { THREE, world, game } = s;
  const x = game.rover.x;
  const chunk = world.chunks.find((c) => c.index === Math.floor(x / 64));
  assert.ok(chunk, 'no ground chunk under the rover');
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 500, 0), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(chunk.mesh)[0];
  assert.ok(hit, 'no ground under the rover');
  assert.ok(Math.abs(hit.point.y - game.terrain.height(x)) < 0.05, `mesh at ${hit.point.y}, physics at ${game.terrain.height(x)}`);
});

test('the wheels stand on the sand (catches a model offset from its own physics)', options, () => {
  const { game, rover, pose } = s;
  const p = pose(game.rover);
  if (!game.rover.grounded) return; // mid-jump at the end of the run: nothing to check
  p.wheels.forEach((w, i) => {
    if (!w.contact) return;
    const bottom = rover.sides[0].wheels[i].position.y - 0.2625;
    assert.ok(Math.abs(bottom - game.terrain.height(w.x)) < 0.08, `wheel ${i} floats ${(bottom - game.terrain.height(w.x)).toFixed(3)} m`);
  });
});

test('the scene stays inside its budgets and says so (catches a mesh left at debug detail)', options, () => {
  let vertices = 0;
  const materials = new Set();
  s.scene.traverse((o) => {
    const position = o.geometry?.attributes?.position;
    if (!position) return;
    vertices += position.count * (o.isInstancedMesh ? o.instanceMatrix.count : 1);
    for (const m of [].concat(o.material)) materials.add(m.uuid);
  });
  console.log(`scene: ${vertices.toLocaleString('en')} vertices, ${materials.size} materials`);
  assert.ok(vertices < 900000, `${vertices} vertices`);
  assert.ok(materials.size < 20, `${materials.size} materials`);
});
