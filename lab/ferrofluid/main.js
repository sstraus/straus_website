// Magnetic Hedgehog: a ferrofluid dish on an electromagnet.
// Main gestures: turn the current (knob or slider) and drag the magnet. Tap the fluid for a ripple.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildDiorama, buildEnvironmentScene, buildFluidEnvironmentScene, LAYOUT, COIL, WINDING } from './diorama.js';
import { createFluid } from './fluid.js';
import { createFieldLines } from './inside.js';
import { createPipeline } from './post.js';
import { loader, precompile, warmUp, nextFrame } from '../lib/intro.js';
import { armPose } from './rig.js';
import { bindGestures } from './interact.js';
import { bindControls, createChips, createTooltip, createCard, describe, partInfo } from './ui.js';
import { SurfaceModel, criticalField, criticalWavelength, magnetFieldAt, magnetAxialField } from './physics.js';

const MAX_CURRENT = 3; // A
const COIL_GAIN = 0.025 / MAX_CURRENT; // T per A at the dish (uniform field approximation)
const SLEW = 1.2; // A/s, the supply ramps like a real one
const AC_HZ = 0.8;
const RINGS = 96;
// NdFeB N42, in SI for the physics.
const MAGNET = { radius: LAYOUT.magnetRadius / 100, thickness: LAYOUT.magnetThickness / 100, remanence: 1.3 };

const PRESETS = {
  off: { current: 0, magnet: false },
  onset: { current: 1.58, magnet: false },
  forest: { current: 2.6, magnet: false },
  magnet: { current: 1.2, magnet: true },
};

// dir: from the target to the camera. fitW/fitH: world size that must fit in the free band of the
// screen (see resize). `phone`: overrides for a bottom-sheet layout, where the band is short.
const VIEWS = {
  hero: {
    dir: [20.5, 18, 36], target: [4.5, 10, 1], fitW: 36, fitH: 27, // stand, coil, magnet and supply
    phone: { target: [1.5, 9.5, 0.5], fitW: 20, fitH: 21 }, // coil, dish and parked magnet
  },
  top: { dir: [0.5, 22, 9.6], target: [0, 8, 0.4], fitW: 11, fitH: 13.8, phone: { fitH: 11 } },
  low: { dir: [-11.5, 3.1, 14], target: [0.5, 8.4, 0], fitW: 11, fitH: 10.5 },
  inside: { dir: [5.9, 7, 19], target: [0, 5.5, 0], fitW: 19, fitH: 17 }, // faces the open wedge of the coil
};
const CUT_SECONDS = 0.9;

const $ = (id) => document.getElementById(id);
const lambda = criticalWavelength();
const bc = criticalField();

// Pan limits: the target stays in a box around the bench (stand, coil, supply), so it cannot be lost.
const PAN_BOX = new THREE.Box3(new THREE.Vector3(-14, 0, -12), new THREE.Vector3(22, 22, 14));
const panShift = new THREE.Vector3();
function keepOnBench(camera, target) {
  panShift.copy(target);
  target.clamp(PAN_BOX.min, PAN_BOX.max);
  camera.position.add(panShift.subVectors(target, panShift)); // move with the target: no orbit jump
}

// Watchdog for the resize hang: resize start and end, and the last 60 frame times, kept on
// window.__lab.watch and copied to localStorage ('lab-watch'), so it survives a reload of a hung tab.
const watch = (() => {
  const log = { resizes: [], frames: [] };
  let last = performance.now();
  let count = 0;
  const save = () => {
    try { localStorage.setItem('lab-watch', JSON.stringify(log)); } catch { /* private mode: memory only */ }
  };
  window.__lab = { ...window.__lab, watch: log };
  return {
    resize(phase, w, h) {
      const canvas = document.querySelector('#stage canvas');
      log.resizes.push({ phase, t: Math.round(performance.now()), w, h, dpr: window.devicePixelRatio, buffer: canvas && `${canvas.width}x${canvas.height}` });
      if (log.resizes.length > 20) log.resizes.shift();
      save();
    },
    frame() {
      const now = performance.now();
      log.frames.push({ t: Math.round(now), ms: Math.round(now - last) });
      if (log.frames.length > 60) log.frames.shift();
      last = now;
      if (++count % 10 === 0) save();
    },
  };
})();

// ---------- loader (lab/lib/intro.js) ----------
// Steps: the module download, 3 set-up steps, 7 compile groups, 2 warm-up frames, 6 assembly stages.
loader.expect(19);
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
  await loading('Drawing the bench');
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: location.search.includes('webgl') });
  renderer.setPixelRatio(window.devicePixelRatio); // crisp, not light
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('stage').appendChild(renderer.domElement);
  await renderer.init();
  const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';

  await loading('Machining the parts');
  // Labels and the supply display are canvas textures: the font must be there first.
  await Promise.all([
    document.fonts.load('700 40px "JetBrains Mono"'),
    document.fonts.load('500 40px "JetBrains Mono"'),
  ]);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.Fog(0x0d1117, 110, 260); // only the far floor and cyclorama fade
  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.5, 400);

  const diorama = buildDiorama();
  scene.add(diorama.root);
  const fluid = createFluid({ radius: LAYOUT.dishRadius, wavelength: lambda * 100, rings: RINGS });
  fluid.mesh.position.y = LAYOUT.fluidLevel;
  scene.add(fluid.mesh);
  const model = new SurfaceModel({ rings: RINGS, radius: LAYOUT.dishRadius / 100 });
  const fieldLines = createFieldLines(WINDING); // always in the scene, dark until the coil is cut open
  scene.add(fieldLines.mesh);
  addLights(scene);

  await loading('Setting up the studio lights');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(buildEnvironmentScene(), 0.02).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.75;
  // The fluid has its own room: black walls, lights only high up. A flat mirror seen at a grazing
  // angle reflects a thin band just above the horizon, so any softbox there turns it grey.
  fluid.setEnvironment(pmrem.fromScene(buildFluidEnvironmentScene(), 0.02).texture, 1.2);

  // One labelled step per group, through the real frame; the bar moves as each part compiles.
  const post = createPipeline(renderer, scene, camera);
  await precompile(renderer, {
    scene,
    render: () => post.render(),
    groups: [
      ['Compiling the studio', [diorama.studio]],
      ['Compiling the coil', [diorama.coil]],
      ['Compiling the glass and the fluid', [diorama.dish, fluid.mesh]],
      ['Compiling the supply', [diorama.supply.group]],
      ['Compiling the stand', [diorama.stand]],
      ['Compiling the leads', [diorama.cables]],
      ['Compiling the field lines', [fieldLines.mesh]],
    ],
  });

  // ---------- state ----------
  const state = {
    target: 0, current: 0, ac: false, driveTime: 0, preset: 'off', view: 'hero',
    magnetDown: false, magnetT: 0, magnetX: 0, magnetZ: 0, magnetBottom: LAYOUT.magnetRest,
    bCoil: 0, readout: null, cutT: 0,
  };
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.screenSpacePanning = true; // right-drag, ctrl/shift + left-drag, two fingers
  controls.minDistance = 5;
  controls.maxDistance = 140;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const flight = createCameraFlight(camera, controls);

  const live = {
    lambda, bc, maxCurrent: MAX_CURRENT, coilGain: COIL_GAIN, acHz: AC_HZ, coil: COIL, state,
    volts: () => state.current * COIL.ohms,
    magnetGap: () => (state.magnetBottom - LAYOUT.fluidLevel) / 100,
    magnetField: () => magnetAxialField(live.magnetGap(), MAGNET.radius, MAGNET.thickness, MAGNET.remanence),
  };

  const tooltip = createTooltip();
  const card = createCard(live);
  const chips = createChips(live);
  function setView(name) {
    state.view = name;
    flight.fly(viewFor(name));
    ui.markView(name);
  }
  const ui = bindControls(state, {
    maxCurrent: MAX_CURRENT,
    onPreset: (name) => {
      applyPreset(name);
      if (VIEWS[state.view]) setView(state.view); // also brings a panned bench back
    },
    onView: setView,
    onDrive: (ac) => { state.ac = ac; state.driveTime = 0; },
    onCloseCard: () => card.close(),
  });
  $('e-lambda').textContent = `${(lambda * 1000).toFixed(1)} mm`;
  $('e-bc').textContent = `${(bc * 1000).toFixed(1)} mT`;
  $('e-gain').textContent = `${(COIL_GAIN * 1000).toFixed(1)} mT/A`;
  $('e-turns').textContent = String(COIL.turns);

  function applyPreset(name) {
    const preset = PRESETS[name];
    state.preset = name;
    state.target = preset.current;
    state.magnetDown = preset.magnet;
    ui.sync();
  }

  // Part views for the spec card. The magnet view follows the magnet.
  function viewFor(name) {
    if (VIEWS[name]) return VIEWS[name];
    if (name === 'magnet') {
      return { dir: [8, 5, 12], target: [state.magnetX, LAYOUT.fluidLevel + 2.6, state.magnetZ], fitW: 9, fitH: 10 };
    }
    if (name === 'fluid') return VIEWS.top;
    if (name === 'coil') return { dir: [10, 4, 16], target: [0, 4.2, 0], fitW: 16, fitH: 12 };
    const knob = diorama.supply.knob.getWorldPosition(new THREE.Vector3());
    const n = diorama.supply.normal;
    return { dir: [n.x * 20 - 4, 7, n.z * 20], target: knob.toArray(), fitW: 15, fitH: 11 };
  }
  function openPart(part) {
    const name = part === 'knob' ? 'supply' : part;
    if (card.current === name) return;
    card.open(name);
    tooltip.hide();
    chips.focus(null);
    state.view = name;
    flight.fly(viewFor(name));
    ui.markView(null);
  }

  let lastTouchTap = null;
  const partOf = (object) => {
    for (let o = object; o; o = o.parent) if (o.userData.part) return o.userData.part;
    return null;
  };
  diorama.supply.knob.userData.part = 'knob';
  diorama.supply.group.userData.part = 'supply';
  diorama.magnet.userData.part = 'magnet';
  diorama.arm.userData.part = 'magnet';
  diorama.coil.userData.part = 'coil';
  const pickables = [diorama.supply.group, diorama.stand, diorama.coil];
  const fluidPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAYOUT.fluidLevel);

  bindGestures({
    canvas: renderer.domElement,
    camera,
    controls,
    pickables,
    partOf,
    fluidHit: (ray) => {
      const point = ray.intersectPlane(fluidPlane, new THREE.Vector3());
      if (!point || Math.hypot(point.x, point.z) >= LAYOUT.dishRadius) return null;
      return { point, distance: ray.origin.distanceTo(point) };
    },
    knob: diorama.supply.knob,
    magnetHeight: () => state.magnetBottom + LAYOUT.magnetThickness / 2,
    magnetLimit: LAYOUT.magnetLimit,
    turnKnob: (turns) => ui.setTarget(state.target - turns * MAX_CURRENT),
    // Grabbing lowers the magnet and leaves the coil current alone.
    grabMagnet: () => {
      if (state.magnetDown) return;
      state.magnetDown = true;
      state.preset = null;
      ui.sync();
    },
    moveMagnet: (x, z) => { state.magnetX = x; state.magnetZ = z; },
    hover: (part, e) => {
      if (!part || card.current) { tooltip.hide(); chips.focus(null); return; }
      tooltip.show(partInfo(part, live, 'mouse').tip, e.clientX, e.clientY);
      chips.focus(part); // one label per part: the tooltip replaces its tag
    },
    tap: (part, point, e) => {
      if (part === 'fluid') {
        const p = fluid.mesh.worldToLocal(point.clone());
        model.knock(p.x / 100, p.z / 100);
      }
      if (!part) { tooltip.hide(); chips.focus(null); lastTouchTap = null; return; }
      if (e.pointerType === 'mouse') { openPart(part); return; }
      // Touch: the first tap explains, the second tap on the same part opens its card.
      const now = performance.now();
      if (lastTouchTap?.part === part && now - lastTouchTap.time < 3000) {
        openPart(part);
        lastTouchTap = null;
      } else {
        tooltip.show(partInfo(part, live, 'touch').tip, e.clientX, e.clientY, 2800);
        chips.focus(part, 2800);
        lastTouchTap = { part, time: now };
      }
    },
    doubleTap: (part) => {
      if (part) openPart(part);
      else { card.close(); setView('hero'); }
    },
  });
  card.onClose = () => { if (!VIEWS[state.view]) setView('hero'); };

  // ---------- framing: every view is fitted into the part of the screen that the HUD leaves free ----------
  // Bottom sheet (phone): between the tiles and the live sentence above the sheet.
  // Side panels (desktop): between the HUD column and the console. The lower half of the HUD column
  // is empty, so the band starts at 60% of its width.
  const band = { left: 0, right: 0, top: 0, bottom: 0, phone: true };
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    watch.resize('start', w, h);
    // The ratio can change after load (another monitor, device emulation): read it again, or a
    // phone-sized load at 3x keeps 3x on a desktop window, 4320x2700 with every pass behind it.
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 40 : 32;
    document.documentElement.style.setProperty('--sheet-h', `${$('console').offsetHeight}px`);
    const sheet = $('console').getBoundingClientRect();
    band.phone = sheet.width > w * 0.6;
    if (band.phone) {
      Object.assign(band, { left: 0, right: w, top: document.querySelector('.tiles').getBoundingClientRect().bottom, bottom: sheet.top - 70 });
    } else {
      Object.assign(band, { left: document.querySelector('.hud-left').getBoundingClientRect().right * 0.6, right: sheet.left, top: 0, bottom: h });
    }
    // A landscape phone leaves almost no band: frame on the whole screen and let the HUD overlap.
    if (band.bottom - band.top < h * 0.25) Object.assign(band, { top: 0, bottom: h });
    if (band.right - band.left < w * 0.3) Object.assign(band, { left: 0, right: w });
    camera.setViewOffset(w, h, w / 2 - (band.left + band.right) / 2, h / 2 - (band.top + band.bottom) / 2, w, h);
    camera.updateProjectionMatrix();
    watch.resize('end', w, h);
  }
  function viewPose(view) {
    const v = band.phone && view.phone ? { ...view, ...view.phone } : view;
    const target = new THREE.Vector3(...v.target);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const w = window.innerWidth;
    const h = window.innerHeight;
    const sx = (band.right - band.left) / w;
    const sy = (band.bottom - band.top) / h;
    const distance = Math.max(v.fitW / 2 / (tanV * camera.aspect * sx), v.fitH / 2 / (tanV * sy));
    const position = new THREE.Vector3(...v.dir).setLength(distance).add(target);
    return { position, target };
  }
  flight.pose = viewPose;
  window.addEventListener('resize', () => {
    resize();
    flight.fly(viewFor(state.view), 0.6);
  });
  resize();

  // ---------- warm-up: every pass and every part, while the loader is still opaque ----------
  // The first render compiles the post passes (AO, bloom, DOF) and the shadow maps.
  diorama.magnet.position.y = LAYOUT.magnetRest;
  updateStand();
  fluid.update(model);
  const shot = (name) => () => {
    flight.jump(viewFor(name));
    post.focus(camera, controls.target);
    post.render();
  };
  await warmUp(renderer, [['Warming up the lenses', shot('hero')], ['Framing the dish', shot('top')]]);

  const intro = createIntro(diorama, fluid, () => setView('hero'));
  applyPreset('off');
  const perf = { frames: 0, since: performance.now(), fps: 0 };
  window.__ferrofluid = { backend, perf, state, model, camera, controls };
  const clock = new THREE.Timer();
  let cardRefresh = 0;

  function updateStand() {
    const { yaw, reach } = armPose(state.magnetX, state.magnetZ);
    diorama.arm.rotation.y = yaw;
    diorama.carriage.position.x = reach;
    diorama.magnet.position.set(state.magnetX, state.magnetBottom, state.magnetZ);
  }

  function frame() {
    watch.frame();
    clock.update();
    const dt = Math.min(clock.getDelta(), 1 / 30);
    if (!intro.done) intro.update(dt);

    // Supply ramps towards the set current; the magnet eases down towards the fluid.
    state.current += THREE.MathUtils.clamp(state.target - state.current, -SLEW * dt, SLEW * dt);
    state.magnetT = THREE.MathUtils.clamp(state.magnetT + (state.magnetDown ? dt : -dt) * 0.45, 0, 1);
    const ease = state.magnetT * state.magnetT * (3 - 2 * state.magnetT);
    state.magnetBottom = THREE.MathUtils.lerp(LAYOUT.magnetRest, LAYOUT.fluidLevel + LAYOUT.magnetGap, ease);
    updateStand();

    // The coil opens for the cutaway and for its own spec card.
    const cutaway = state.view === 'inside' || state.view === 'coil';
    state.cutT = THREE.MathUtils.clamp(state.cutT + (cutaway ? dt : -dt) / CUT_SECONDS, 0, 1);
    const cut = state.cutT * state.cutT * (3 - 2 * state.cutT);
    diorama.setCut(cut);

    // Physics: uniform coil field plus the magnet's vertical component at each surface cell.
    const gap = live.magnetGap();
    state.driveTime += dt;
    const drive = state.ac ? Math.sin(state.driveTime * 2 * Math.PI * AC_HZ) : 1;
    state.bCoil = COIL_GAIN * state.current * drive;
    const mx = state.magnetX / 100;
    const mz = state.magnetZ / 100;
    model.step(dt, (x, z) => state.bCoil + magnetFieldAt(x, z, mx, mz, gap, MAGNET.radius, MAGNET.thickness, MAGNET.remanence));
    fluid.update(model);

    const level = state.current / MAX_CURRENT;
    diorama.power.value = level;
    diorama.supply.setLevel(level);
    diorama.supply.display.draw(state.current, live.volts());
    // Field lines: brightness follows |B| (square root, so a weak field still shows), pulses run along B.
    const coilLevel = state.bCoil / (COIL_GAIN * MAX_CURRENT);
    fieldLines.strength.value = cut * Math.sqrt(Math.abs(coilLevel));
    fieldLines.flow.value += dt * 1.4 * coilLevel;

    state.readout = describe(model, state, live, fluid.spikeHeight * 10);
    ui.render(state.readout);
    chips.update(camera, diorama, band);
    cardRefresh += dt;
    if (cardRefresh > 0.25) { card.refresh(); cardRefresh = 0; }

    controls.update();
    flight.update(dt);
    keepOnBench(camera, controls.target);
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

// The parts drop into place one by one over the fading drawing; then the camera moves in.
function createIntro(diorama, fluid, onDone) {
  const STEP = 0.25;
  const stages = [
    ['Placing the coil', diorama.coil],
    ['Setting the glass dish', diorama.dish],
    ['Pouring the ferrofluid', fluid.mesh],
    ['Bringing the supply', diorama.supply.group],
    ['Mounting the magnet', diorama.stand],
    ['Connecting the leads', diorama.cables],
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
        part.position.y = positions[i] + (1 - ease) * 2.5;
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

function addLights(scene) {
  const key = new THREE.SpotLight(0xffe0bd, 5.5, 0, 0.42, 0.75, 0);
  key.position.set(-20, 40, 20);
  key.target.position.set(2, 5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 20;
  key.shadow.camera.far = 90;
  scene.add(key, key.target);

  const rim = new THREE.SpotLight(0x79c0ff, 3.5, 0, 0.5, 0.9, 0);
  rim.position.set(24, 20, -30);
  rim.target.position.set(0, 6, 0);
  scene.add(rim, rim.target);

  scene.add(new THREE.HemisphereLight(0x9fb4d0, 0x0d1117, 0.35));
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
