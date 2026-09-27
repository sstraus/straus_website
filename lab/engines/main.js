// Pistons vs magnets: a 2.0 litre inline four and a PMSM on one plinth, driven at the same shaft speed.
// Main gesture: the speed slider. Slow motion, an exploded view, and a card for every part.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loader, precompile, warmUp, nextFrame } from '../lib/intro.js';
import { createMaterials } from './materials.js';
import { buildEngine, ENGINE_POINTS } from './engine.js';
import { buildMotor, MOTOR_POINTS } from './motor.js';
import { setupEnvironment, buildStudio, addLights, PLINTH } from './studio.js';
import { createPipeline } from './post.js';
import { bindGestures } from './interact.js';
import { bindControls, createChips, createTooltip, createCard, partInfo, readout, isEnginePart } from './ui.js';
import { TAU, MOTOR, engineRuns, engineTorque, shaftPower, firingCylinder, movingPartCount } from './physics.js';

const RAMP = 3000; // rpm per second: the slider sets a target, the shafts spin up to it
const TIME = { normal: 1 / 10, slow: 1 / 100 }; // shown time against real time
const BEAT_SECONDS = 4.5;
const EXPLODE_SECONDS = 1.1;
const START_RPM = 1500;
// The busiest firing chip the eye can follow; above it the chip names the order instead.
const FIRES_READABLE = 4; // per shown second
const ENGINE_PEAK_POWER = Math.max(...Array.from({ length: 131 }, (_, i) => shaftPower(i * 50, engineTorque(i * 50))));

// Machine views: dir points from the target to the camera; the frame is fitted to the measured bounds
// of the machines (see measureBounds and viewPose). `phone`: overrides for the bottom-sheet layout,
// where the band is narrow: from further right the pair foreshortens and the motor comes nearer.
const VIEWS = {
  both: { dir: [0.55, 0.42, 1], phone: { dir: [0.8, 0.55, 1] } },
  engine: { dir: [0.45, 0.4, 1] },
  motor: { dir: [0.5, 0.45, 1] },
};
// Part close-ups look from where the part shows best; the rest use the view of their machine.
const PART_DIRS = {
  flywheel: [-0.9, 0.35, 0.8],
  belt: [1, 0.35, 0.7],
  manifold: [0.35, 0.55, -1],
  inverter: [0.9, 0.8, 0.5],
  cables: [0.9, 0.8, 0.5],
};

// Where the orbit target may go when the user pans: over the plinth, from its top to above the exploded cams.
const TARGET_BOX = new THREE.Box3(new THREE.Vector3(PLINTH.x[0], 0, PLINTH.z[0]), new THREE.Vector3(PLINTH.x[1], 1.25, PLINTH.z[1])).expandByScalar(0.1);

const $ = (id) => document.getElementById(id);
const smooth = (x) => x * x * (3 - 2 * x);

// ---------- loader (lab/lib/intro.js) ----------
// Steps: the module download, 2 set-up steps, 8 compile groups, 2 warm-up frames, 7 assembly stages.
loader.expect(20);
async function loading(label) {
  loader.step(label);
  await nextFrame();
}

try {
  await start();
} catch (error) {
  loader.fail(error);
  throw error;
}

async function start() {
  await loading('Drawing the benches');
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: location.search.includes('webgl') });
  renderer.setPixelRatio(window.devicePixelRatio); // crisp, not light
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('stage').appendChild(renderer.domElement);
  await renderer.init();
  const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';

  await loading('Machining the parts');
  await document.fonts.load('500 10px "JetBrains Mono"'); // the torque chart draws its labels with it
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.02, 20);
  const environment = setupEnvironment(renderer, scene);
  const m = createMaterials(environment);
  const engine = buildEngine(m);
  const motor = buildMotor(m, environment);
  const studio = buildStudio(m);
  scene.add(studio, engine.root, motor.root);
  addLights(scene);

  // One labelled step per group; the bar moves as each part finishes.
  const post = createPipeline(renderer, scene, camera);
  await precompile(renderer, {
    scene,
    render: () => post.render(),
    groups: [
      ['Compiling the block', [engine.stages.block]],
      ['Compiling the crank and the pistons', [engine.stages.crank]],
      ['Compiling the head and the valves', [engine.stages.head]],
      ['Compiling the timing belt', [engine.stages.belt]],
      ['Compiling the stator', [motor.stages.stator]],
      ['Compiling the rotor', [motor.stages.rotor]],
      ['Compiling the inverter', [motor.stages.power]],
      ['Compiling the studio', [studio]],
    ],
  });

  // ---------- state ----------
  const state = {
    rpmTarget: START_RPM, rpm: START_RPM, slow: false, exploded: false, explodeT: 0,
    mode: 'both', view: 'both', beat: 0, beatTime: 0, crank: 0, rotor: 0,
  };
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  // Free pan: right-drag or ctrl/shift + left-drag on desktop (OrbitControls defaults), two fingers on a
  // phone. The target stays inside a box round the plinth (see frame), so the bench cannot be lost.
  controls.screenSpacePanning = true;
  controls.minDistance = 0.2;
  controls.maxDistance = 7; // the phone Both view needs 4.2 m
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const flight = createCameraFlight(camera, controls);

  const live = { readout: readout(state.rpm) };
  const tooltip = createTooltip();
  const card = createCard(live);
  const chips = createChips();
  const restartStory = () => { state.beat = 0; state.beatTime = 0; };

  function setView(name) {
    state.mode = name;
    state.view = name;
    restartStory();
    flight.fly(viewFor(name));
    ui.sync();
  }
  const ui = bindControls(state, {
    onView: setView,
    onExplode(on) {
      state.exploded = on;
      restartStory();
      card.close();
      flight.fly(viewFor(VIEWS[state.view] ? state.view : state.mode));
      if (!VIEWS[state.view]) state.view = state.mode;
      ui.sync();
    },
    onSlow(on) {
      state.slow = on;
      ui.sync();
    },
    onCloseCard: () => card.close(),
  });

  $('e-parts').textContent = String(movingPartCount('engine'));

  // Machine views frame the bounds of their machines, together or taken apart; a part close-up frames
  // the pick volume that was hit, wherever it is now, with some of its surroundings.
  const bounds = measureBounds(engine, motor);
  function viewFor(name, volume) {
    if (VIEWS[name]) return { ...VIEWS[name], box: bounds[state.exploded ? 'exploded' : 'assembled'][name] };
    const box = new THREE.Box3().setFromObject(volume);
    const size = box.getSize(new THREE.Vector3());
    box.expandByScalar(Math.max(0.03, Math.max(size.x, size.y, size.z) * 0.2));
    const dir = PART_DIRS[name] ?? (isEnginePart(name) ? VIEWS.engine.dir : VIEWS.motor.dir);
    return { dir, box };
  }
  function openPart(volume) {
    const name = volume.userData.part;
    if (card.current === name) return;
    card.open(name);
    tooltip.hide();
    chips.focus(null);
    state.view = name;
    flight.fly(viewFor(name, volume));
    ui.sync();
  }
  card.onClose = () => {
    if (VIEWS[state.view]) return;
    state.view = state.mode;
    flight.fly(viewFor(state.mode));
    ui.sync();
  };

  let lastTouchTap = null;
  bindGestures({
    canvas: renderer.domElement,
    camera,
    pickables: () => [...engine.pickables, ...motor.pickables],
    hover: (volume, e) => {
      if (!volume || card.current) { tooltip.hide(); chips.focus(null); return; }
      const part = volume.userData.part;
      tooltip.show(partInfo(part, live, 'mouse').tip, e.clientX, e.clientY);
      chips.focus(part); // one label per machine: the tooltip replaces its tag
    },
    tap: (volume, e) => {
      if (!volume) { tooltip.hide(); chips.focus(null); lastTouchTap = null; return; }
      if (e.pointerType === 'mouse') { openPart(volume); return; }
      // Touch: the first tap explains, the second tap on the same part opens its card.
      const part = volume.userData.part;
      const now = performance.now();
      if (lastTouchTap?.part === part && now - lastTouchTap.time < 3000) {
        openPart(volume);
        lastTouchTap = null;
      } else {
        tooltip.show(partInfo(part, live, 'touch').tip, e.clientX, e.clientY, 2800);
        chips.focus(part, 2800);
        lastTouchTap = { part, time: now };
      }
    },
    doubleTap: (volume) => {
      if (volume) openPart(volume);
      else { card.close(); setView(state.mode); }
    },
  });

  // ---------- framing: every view is fitted into the part of the screen that the HUD leaves free ----------
  // Bottom sheet (phone): between the tiles and the live sentence above the sheet.
  // Side panels (desktop): between the HUD column and the console.
  const band = { left: 0, right: 0, top: 0, bottom: 0, phone: true };
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 40 : 32;
    document.documentElement.style.setProperty('--sheet-h', `${$('console').offsetHeight}px`);
    const sheet = $('console').getBoundingClientRect();
    band.phone = sheet.width > w * 0.6;
    if (band.phone) {
      Object.assign(band, { left: 0, right: w, top: document.querySelector('.tiles').getBoundingClientRect().bottom, bottom: sheet.top - 70 });
    } else {
      Object.assign(band, { left: document.querySelector('.hud-left').getBoundingClientRect().right + 16, right: sheet.left - 16, top: 0, bottom: h });
    }
    // A landscape phone leaves almost no band: frame on the whole screen and let the HUD overlap.
    if (band.bottom - band.top < h * 0.25) Object.assign(band, { top: 0, bottom: h });
    if (band.right - band.left < w * 0.3) Object.assign(band, { left: 0, right: w });
    camera.setViewOffset(w, h, w / 2 - (band.left + band.right) / 2, h / 2 - (band.top + band.bottom) / 2, w, h);
    camera.updateProjectionMatrix();
  }
  // The nearest distance at which every corner of the box is inside the band: a corner at (x, y) across
  // the view and z towards the camera needs d - z >= x / tan(half width) and y / tan(half height).
  const corner = new THREE.Vector3();
  function viewPose(view) {
    const v = band.phone && view.phone ? { ...view, ...view.phone } : view;
    const target = v.box.getCenter(new THREE.Vector3());
    const back = new THREE.Vector3(...v.dir).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * ((band.bottom - band.top) / window.innerHeight);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * ((band.right - band.left) / window.innerWidth);
    const { min, max } = v.box;
    let distance = 0;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).sub(target);
      const z = corner.dot(back);
      distance = Math.max(distance, z + (Math.abs(corner.dot(right)) * 1.04) / tanH, z + (Math.abs(corner.dot(up)) * 1.04) / tanV);
    }
    return { position: target.clone().addScaledVector(back, distance), target };
  }
  flight.pose = viewPose;
  window.addEventListener('resize', () => {
    resize();
    if (VIEWS[state.view]) flight.fly(viewFor(state.view), 0.6);
  });
  resize();

  // ---------- warm-up: every pass and every part, while the loader is still opaque ----------
  // Flames, sparks and coil glow are lit in these frames, so their bloom path is built too.
  engine.update(TAU * 0.37, { running: true, load: 1, explode: 0 });
  motor.update(0.4, { torqueFraction: 1, explode: 0 });
  const shot = (name) => () => {
    flight.jump(viewFor(name));
    post.focus(camera, controls.target);
    post.render();
  };
  await warmUp(renderer, [['Warming up the lenses', shot('both')], ['Focusing on the engine', shot('engine')]]);

  const intro = createIntro(engine.stages, motor.stages, () => setView('both'));
  ui.sync();
  const perf = { frames: 0, since: performance.now(), fps: 0 };
  window.__engines = { backend, perf, state, camera, controls, engine, motor };
  const clock = new THREE.Timer();
  const points = { engine: new THREE.Vector3(), motor: new THREE.Vector3(), firing: new THREE.Vector3() };
  let cardRefresh = 0;
  const clamped = new THREE.Vector3();

  function frame() {
    clock.update();
    const dt = Math.min(clock.getDelta(), 1 / 30);
    if (!intro.done) intro.update(dt);

    // One shaft speed for both machines, ramping like a real drive.
    state.rpm += THREE.MathUtils.clamp(state.rpmTarget - state.rpm, -RAMP * dt, RAMP * dt);
    const r = readout(state.rpm);
    live.readout = r;
    const timeScale = state.slow ? TIME.slow : TIME.normal;
    state.explodeT = THREE.MathUtils.clamp(state.explodeT + (state.exploded ? dt : -dt) / EXPLODE_SECONDS, 0, 1);
    const explode = smooth(state.explodeT);
    // Taken apart, nothing turns. Below idle the engine stalls; the motor turns at any speed.
    const turn = (state.rpm / 60) * TAU * dt * timeScale * (state.explodeT > 0 ? 0 : 1);
    if (engineRuns(state.rpm)) state.crank += turn;
    state.rotor += turn;
    engine.update(state.crank, { running: engineRuns(state.rpm), load: r.pe / ENGINE_PEAK_POWER, explode });
    motor.update(state.rotor, { torqueFraction: r.tm / MOTOR.peakTorque, explode });

    state.beatTime += dt;
    if (state.beatTime > BEAT_SECONDS) { state.beat += 1; state.beatTime = 0; }
    ui.render(r);

    // The three pinned labels: the two machines, and the cylinder that fires now.
    points.engine.copy(ENGINE_POINTS.label);
    engine.root.localToWorld(points.engine);
    points.motor.copy(MOTOR_POINTS.label);
    motor.root.localToWorld(points.motor);
    let fire = null;
    if (engineRuns(state.rpm) && state.explodeT === 0 && state.mode !== 'motor') {
      const cylinder = firingCylinder(state.crank);
      const fast = (state.rpm / 60) * 2 * timeScale > FIRES_READABLE;
      points.firing.copy(ENGINE_POINTS.firing(fast ? null : cylinder));
      engine.root.localToWorld(points.firing);
      fire = { cylinder, fast };
    }
    chips.update(camera, band, points, fire);
    cardRefresh += dt;
    if (cardRefresh > 0.25) { card.refresh(); cardRefresh = 0; }

    controls.update();
    // Keep the target over the bench: move the camera with it, so the view turns no further.
    clamped.copy(controls.target).clamp(TARGET_BOX.min, TARGET_BOX.max);
    if (!clamped.equals(controls.target)) {
      camera.position.add(clamped.sub(controls.target));
      controls.target.add(clamped);
    }
    flight.update(dt);
    // Light DOF only while flying or in a part close-up; the bench at rest stays sharp.
    post.focus(camera, controls.target, flight.active || !VIEWS[state.view] ? 1 : 0, dt);
    post.render();

    perf.frames += 1;
    const now = performance.now();
    if (now - perf.since > 1000) {
      perf.fps = Math.round((perf.frames * 1000) / (now - perf.since));
      perf.frames = 0;
      perf.since = now;
      $('perf').textContent = `${backend} · ${perf.fps} fps`;
    }
  }

  // Pause when hidden: no rendering, no simulation, no dt jump on return.
  function run() {
    clock.reset();
    perf.since = performance.now();
    perf.frames = 0;
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
}

// The machines assemble over the fading drawing, one stage at a time; then the camera moves in.
function createIntro(engineStages, motorStages, onDone) {
  const STEP = 0.25;
  const DROP = 0.25; // m
  const stages = [
    ['Casting the block', engineStages.block],
    ['Fitting the crankshaft', engineStages.crank],
    ['Bolting on the head', engineStages.head],
    ['Fitting the timing belt', engineStages.belt],
    ['Winding the stator', motorStages.stator],
    ['Sliding in the rotor', motorStages.rotor],
    ['Wiring the inverter', motorStages.power],
  ];
  const positions = stages.map(([, part]) => part.position.y);
  for (const [, part] of stages) part.scale.setScalar(0.001);
  let elapsed = -0.25; // let the canvas fade in first
  let phase = -1;
  let done = false;
  return {
    get done() { return done; },
    update(dt) {
      elapsed += dt;
      if (elapsed < 0) return;
      const nextPhase = Math.min(stages.length - 1, Math.floor(elapsed / STEP));
      if (nextPhase !== phase) {
        phase = nextPhase;
        loader.step(stages[phase][0]);
      }
      for (let i = 0; i <= phase; i++) {
        const part = stages[i][1];
        const t = THREE.MathUtils.clamp((elapsed - i * STEP) / 0.3, 0, 1);
        const ease = 1 - (1 - t) ** 3;
        part.scale.setScalar(Math.max(0.001, ease));
        part.position.y = positions[i] + (1 - ease) * DROP;
      }
      if (elapsed >= stages.length * STEP + 0.1) {
        stages.forEach(([, part], i) => {
          part.scale.setScalar(1);
          part.position.y = positions[i];
        });
        done = true;
        loader.ready();
        onDone();
        document.body.classList.remove('loading');
      }
    },
  };
}

function createCameraFlight(camera, controls) {
  let from = null;
  let to = null;
  let t = 1;
  let seconds = 1.4;
  const flight = {
    pose: null, // set by start(): view → { position, target }
    jump(view) {
      const pose = flight.pose(view);
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
      controls.update();
    },
    fly(view, duration = 1.4) {
      from = { position: camera.position.clone(), target: controls.target.clone() };
      to = flight.pose(view);
      seconds = duration;
      t = 0;
    },
    get active() { return t < 1; },
    update(dt) {
      if (t >= 1) return;
      t = Math.min(1, t + dt / seconds);
      const e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      camera.position.lerpVectors(from.position, to.position, e);
      controls.target.lerpVectors(from.target, to.target, e);
    },
  };
  return flight;
}

// World bounds of each machine and of the pair, assembled and taken apart, measured on the built parts.
function measureBounds(engine, motor) {
  const measure = (explode) => {
    engine.update(0, { running: false, load: 0, explode });
    motor.update(0, { torqueFraction: 0, explode });
    engine.root.updateMatrixWorld(true);
    motor.root.updateMatrixWorld(true);
    const e = new THREE.Box3().setFromObject(engine.root, true);
    const m = new THREE.Box3().setFromObject(motor.root, true);
    return { engine: e, motor: m, both: e.clone().union(m) };
  };
  const bounds = { exploded: measure(1), assembled: measure(0) };
  return bounds;
}
