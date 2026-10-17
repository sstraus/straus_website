// Mars Rover: a one-button game on the dunes of Mars. The rover drives itself; the player's only
// move is the jump. Everything that decides a run lives in the pure modules (terrain, physics, game,
// story); this file draws it and feeds it the one input.
import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loader, precompile, warmUp, nextFrame } from '../lib/intro.js';
import { createGame, update as play, sky as solAt } from './game.js';
import { pose } from './physics.js';
import { sentence } from './story.js';
import { createWorld } from './world.js';
import { buildRover, roverMaterials } from './rover-model.js';
import { createDust } from './dust.js';
import { createPipeline } from './post.js';
import { bindInput, createHud } from './ui.js';

const BEAT_SECONDS = 6;

// ---------- loader (lab/lib/intro.js) ----------
// Steps: the module download, 2 set-up steps, 5 compile groups, 2 warm-up frames.
loader.expect(10);

// The run and the page share one small state; everything below the await reads it, so it is
// declared up here (a const below a top-level await is in its dead zone while the frames run).
const target = new THREE.Vector3();
const eye = new THREE.Vector3();
const view = {
  phase: 'ready', game: null, jumpQueued: false, beat: 0, beatTime: 0, wheelTravel: 0, spin: 0,
  shake: 0, lastLanding: null, time: 0, seed: 1 + Math.floor(Math.random() * 1e6),
};

try {
  await start();
} catch (error) {
  loader.fail(error);
  throw error;
}

async function start() {
  loader.step('Landing on Mars');
  await nextFrame();
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: location.search.includes('webgl') });
  renderer.setPixelRatio(window.devicePixelRatio); // crisp, not light
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.getElementById('stage').appendChild(renderer.domElement);
  await renderer.init();
  const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';

  loader.step('Piling up the dunes');
  await nextFrame();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.2, 3000);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.3;

  view.game = createGame(view.seed);
  const world = createWorld(scene, view.game.terrain);
  const rover = buildRover(roverMaterials(environment));
  const dust = createDust();
  scene.add(world.root, rover.root, dust.mesh);
  const post = createPipeline(renderer, scene, camera);

  // Every part is drawn once behind the loader, so nothing compiles in the middle of a run.
  const firstPose = pose(view.game.rover);
  rover.update(firstPose, 0, 0);
  dust.burst(firstPose.x, firstPose.y, 4); // a few live puffs, so the dust shader is built too
  dust.update(camera, 0.016);
  placeCamera(camera, view.game.rover, 1, true);
  world.update(camera, view.game.rover.x, solAt(0));
  await precompile(renderer, {
    scene,
    render: () => post.render(),
    groups: [
      ['Raising the sky', [world.sky, ...world.moons]],
      ['Laying the sand', world.chunks.map((c) => c.group)],
      ['Standing up the mesas', world.mesas],
      ['Building the rover', [rover.root]],
      ['Kicking up the dust', [dust.mesh]],
    ],
  });
  await warmUp(renderer, [
    ['Warming up the cameras', () => post.render()],
    ['Checking the wheels', () => post.render()],
  ]);

  // ---------- the run ----------
  const hud = createHud();
  function begin() {
    if (view.phase === 'run') return;
    if (view.phase === 'over') {
      view.seed += 1;
      view.game = createGame(view.seed);
      world.reset(view.game.terrain);
      view.wheelTravel = 0;
    }
    view.phase = 'run';
    view.lastLanding = null;
    hud.phase('run', view.game);
  }
  bindInput({
    jump: () => { view.jumpQueued = true; },
    start: begin,
    phase: () => view.phase,
  });
  hud.phase('ready', view.game);

  const clock = new THREE.Timer();
  const perf = { frames: 0, since: performance.now(), fps: 0 };
  window.__rover = { backend, perf, view, camera, world, rover };

  function frame() {
    clock.update();
    const dt = Math.min(clock.getDelta(), 1 / 30);
    view.time += dt;
    const game = view.game;

    if (view.phase === 'run') {
      play(game, dt, { jumpPressed: view.jumpQueued });
      view.jumpQueued = false;
      for (const e of game.events) {
        if (e.type === 'landing') {
          view.lastLanding = { grade: e.grade, damage: e.damage, at: view.time };
          hud.landing(e, game.streak);
          const hit = game.rover.landing?.vn ?? 2;
          dust.burst(game.rover.x, game.rover.y, hit);
          if (e.grade === 'hard') view.shake = Math.min(1, 0.35 + e.damage / 40);
        }
        if (e.type === 'over') {
          view.phase = 'over';
          hud.phase('over', game);
        }
      }
    }

    // The wheels roll with the ground under them, and keep spinning a little in the air.
    const r = game.rover;
    const speed = Math.hypot(r.vx, r.vy);
    if (r.grounded) view.spin = speed;
    else view.spin *= 1 - 0.4 * dt;
    view.wheelTravel += view.spin * dt;
    const p = pose(r);
    rover.update(p, view.wheelTravel, view.time);
    if (view.phase === 'run') dust.trail(p, speed, dt);

    const sol = solAt(game.distance);
    placeCamera(camera, r, dt, false);
    world.update(camera, r.x, sol);
    dust.light.value = 0.3 + 0.7 * Math.max(0, Math.min(1, sol.sun / 0.35 + 0.2)) * (1 - 0.7 * sol.night);
    dust.update(camera, dt);

    // The coach.
    view.beatTime += dt;
    if (view.beatTime > BEAT_SECONDS) { view.beat += 1; view.beatTime = 0; }
    const last = view.lastLanding ? { ...view.lastLanding, age: view.time - view.lastLanding.at } : null;
    hud.render(game, sentence({
      phase: view.phase, distance: game.distance, speed, air: r.air, hull: game.hull,
      streak: game.streak, last, sky: sol, beat: view.beat,
    }));

    post.render();
    perf.frames += 1;
    const now = performance.now();
    if (now - perf.since > 1000) {
      perf.fps = Math.round((perf.frames * 1000) / (now - perf.since));
      perf.frames = 0;
      perf.since = now;
    }
  }

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    placeCamera(camera, view.game.rover, 1, true);
  });

  // Pause when hidden: no rendering, no simulation, no jump in dt on return.
  function run() {
    clock.reset();
    frame();
    document.body.classList.add('scene-ready');
    loader.handoff();
    renderer.setAnimationLoop(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else run();
  });
  if (!document.hidden) run();
  loader.ready();
  document.body.classList.remove('loading');
}

/**
 * The camera watches from the side, like every side-scroller, a little above the sand. It looks ahead
 * of the rover in proportion to its speed, eases after it, and shakes for a moment on a hard hit.
 * On a phone held upright the view is narrow, so it stands further back and the rover sits in the
 * lower half of the screen, under the tiles.
 */
function placeCamera(camera, r, dt, snap) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const portrait = w < h;
  camera.aspect = w / h;
  camera.fov = portrait ? 46 : 34;
  const lead = THREE.MathUtils.clamp(r.vx * 0.55, 3, 8) * (portrait ? 0.55 : 1);
  const distance = (portrait ? 23 : 19) + Math.min(6, Math.max(0, r.vx - 9) * 0.8);
  target.set(r.x + lead, r.y + 0.8, 0);
  eye.set(target.x, target.y + (portrait ? 3.2 : 2.6), distance);
  if (snap) {
    camera.position.copy(eye);
  } else {
    const kx = 1 - Math.exp(-dt * 5);
    const ky = 1 - Math.exp(-dt * 2.2);
    camera.position.x += (eye.x - camera.position.x) * kx;
    camera.position.y += (eye.y - camera.position.y) * ky;
    camera.position.z += (eye.z - camera.position.z) * ky;
  }
  // A short shake on a hard landing.
  view.shake = Math.max(0, view.shake - dt * 2.5);
  const s = view.shake * view.shake * 0.35;
  const look = target.clone();
  look.y = camera.position.y - (portrait ? 3.2 : 2.6);
  look.x = camera.position.x;
  camera.position.x += (Math.random() - 0.5) * s;
  camera.position.y += (Math.random() - 0.5) * s;
  camera.lookAt(look);
  // Phone: shift the picture down, so the rover is framed below the tiles and the coach.
  if (portrait) camera.setViewOffset(w, h, 0, -h * 0.1, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
