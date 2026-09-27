/**
 * The tennis racket effect, as a night-court diorama.
 * One gesture: pick the spin axis and throw. Everything else follows.
 */
import * as THREE from 'three/webgpu';
import { color, mix, screenUV, uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { racket as racketData } from '../lib/models/racket.js';
import { createRacket } from './racket-model.js';
import { buildCourt } from './court.js';
import { createTrail } from './trail.js';
import { createPipeline, glowOutput, unlit, BLOOM_STRENGTH } from './post.js';
import { createToss, AXES, THROWS } from './toss.js';
import { narrate } from './narrate.js';
import { loader, precompile, warmUp, nextFrame } from '../lib/intro.js';

const FOCUS = new THREE.Vector3(0, 1.55, 4.5);
/** World direction of the spin axis at release: oblique, so both the spin and the faces read. */
const SPIN_DIR = new THREE.Vector3(1, 0, 0.75).normalize();
const SLOW_MOTION = 0.2;
const ZERO_G_MOTION = 0.35;
const GHOST_STEP = { court: 0.055, zeroG: 0.022 };
const GHOST_LIFE_ZERO_G = 0.3;
const AUTO_THROW_AFTER = 1.1;
const RETHROW_AFTER = 3;

// Pan limits for the camera target: the throw zone and the near baseline. All preset targets are inside.
const PAN_BOX = new THREE.Box3(new THREE.Vector3(-3, 0.3, 2), new THREE.Vector3(3, 3.5, 7.5));

// Camera presets. `position` sets the direction from `target` and the closest distance; the view is
// then pulled back until the throw's fit box (THROWS) fits the free band of the screen (see resize).
const CAMERAS = [
  { position: [0.4, 1.45, 8.2], target: [0, 1.6, 4.5] },
  { position: [-2.9, 0.32, 7.6], target: [0, 1.75, 4.3] },
  { position: [4.6, 4.8, 9.2], target: [0, 1.25, 4.3] },
];

const $ = (id) => document.getElementById(id);
// ---- loader (lab/lib/intro.js) ----
// Steps: the module download, 2 set-up steps, 6 compile groups, 3 warm-up frames. Timings, with
// node builds, pipelines and programs per step, go to console.table and window.__lab.loadTimes.
loader.expect(12);
async function loading(label) {
  loader.step(label);
  await nextFrame();
}

/** Rejects if `promise` has not settled after `seconds`, so a stuck GPU call becomes a visible error. */
function guard(promise, seconds = 20) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`did not finish in ${seconds} s`)), seconds * 1000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Shows the error on the shared loader, with the phase it happened in. */
function fail(error) {
  const phase = loader.label;
  loader.fail(new Error(`${phase}: ${error?.message ?? error}`));
  console.error('[tennis-racket] stopped during', phase, error);
}

/** Quaternion [x, y, z, w] that puts body axis `axis` along SPIN_DIR, red face up where possible. */
function releaseOrientation(axis) {
  const up = new THREE.Vector3(0, 1, 0);
  const cols = [];
  cols[AXES[axis].index] = SPIN_DIR.clone();
  if (axis === 'face') {
    cols[2] = up;
    cols[1] = new THREE.Vector3().crossVectors(cols[2], cols[0]); // y = z × x
  } else {
    cols[0] = up; // red face (+x) up
    if (axis === 'middle') cols[2] = new THREE.Vector3().crossVectors(cols[0], cols[1]); // z = x × y
    else cols[1] = new THREE.Vector3().crossVectors(cols[2], cols[0]); // y = z × x
  }
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(...cols)).toArray();
}

async function start() {
  await loading('Starting the GPU');
  const forceWebGL = location.search.includes('webgl');
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
  renderer.setPixelRatio(window.devicePixelRatio); // crisp, not light: native, never capped
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('stage').appendChild(renderer.domElement);
  await guard(renderer.init());
  const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';

  await loading('Building the court');
  const scene = new THREE.Scene();
  scene.backgroundNode = mix(color(0x141d2c), color(0x05070b), screenUV.y.oneMinus().pow(0.7).oneMinus());
  scene.fog = new THREE.FogExp2(0x070a10, 0.01); // only the far towers and walls fade

  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.05, 120);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 1.5;
  controls.maxDistance = 16;
  controls.autoRotateSpeed = 0.6;
  // Pan: right-drag or ctrl/shift + left-drag on desktop, two fingers on a phone.
  controls.screenSpacePanning = true;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const court = new THREE.Group();
  const courtParts = buildCourt(court, FOCUS); // lights included, so every later compile sees the final light set
  scene.add(court);
  const { group: racket, glow } = createRacket();
  scene.add(racket);

  const effects = new THREE.Group();
  const trail = createTrail(40);
  effects.add(trail.group);

  // Halo around the angular momentum: fixed in space while the body tumbles.
  const haloMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const haloStrength = uniform(1);
  haloMaterial.colorNode = color(0x58a6ff).mul(haloStrength);
  haloMaterial.mrtNode = glowOutput();
  const halo = unlit(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.0012, 8, 160), haloMaterial));
  effects.add(halo);

  // Shock ring for the flip moment, always facing the camera. Always in the scene (black when
  // idle, so additive blending hides it): hiding it would skip its compile in the warm-up.
  const shockMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const shockStrength = uniform(0);
  shockMaterial.colorNode = color(0xd2a8ff).mul(shockStrength);
  shockMaterial.mrtNode = glowOutput(shockMaterial.colorNode);
  const shock = unlit(new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), shockMaterial));
  effects.add(shock);
  scene.add(effects);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const post = createPipeline(renderer, scene, camera);

  // ---- state ----
  const state = { axis: 'middle', zeroG: false, rev: 1, phase: 'hold', wait: 0, flash: 0, camera: 0 };
  let toss = null;
  let nextGhost = 0;

  // ---- framing: fit the arc into the part of the screen that the HUD leaves free ----
  // Phone (bottom sheet): between the live sentence and the sheet. Desktop: the whole screen,
  // the side panels sit over the empty sky.
  const band = { top: 0, bottom: 0, phone: false };
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Portrait screens: a wider lens keeps the whole arc in view.
    camera.fov = w < h ? 44 : 32;
    const sheet = document.querySelector('.console').getBoundingClientRect();
    document.documentElement.style.setProperty('--sheet-h', `${Math.round(h - sheet.top)}px`);
    const phone = sheet.width > w * 0.6;
    if (phone !== band.phone && toss) reset(); // the throw path changes with the layout
    band.phone = phone;
    Object.assign(band, phone ? { top: $('live').getBoundingClientRect().bottom, bottom: sheet.top } : { top: 0, bottom: h });
    // A landscape phone leaves almost no band: frame on the whole screen and let the HUD overlap.
    if (band.bottom - band.top < h * 0.25) Object.assign(band, { top: 0, bottom: h });
    camera.setViewOffset(w, h, 0, h / 2 - (band.top + band.bottom) / 2, w, h);
    camera.updateProjectionMatrix();
  }
  const throwPath = () => (band.phone ? THROWS.tall : THROWS.wide);

  function viewPose(index) {
    const preset = CAMERAS[index];
    const [fitW, fitH] = throwPath().fit;
    const target = new THREE.Vector3(...preset.target);
    const offset = new THREE.Vector3(...preset.position).sub(target);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const sy = (band.bottom - band.top) / window.innerHeight;
    const fit = Math.max(fitW / 2 / (tanV * camera.aspect), fitH / 2 / (tanV * sy));
    offset.setLength(Math.max(offset.length(), fit));
    return { position: target.clone().add(offset), target };
  }
  let flight = null;
  // The pan stops at the edge of this box, so the court area near the player cannot be lost.
  // The camera moves with the target, so a clamped pan does not turn into an orbit.
  const correction = new THREE.Vector3();
  function keepInPanBox() {
    correction.copy(controls.target).clamp(PAN_BOX.min, PAN_BOX.max).sub(controls.target);
    controls.target.add(correction);
    camera.position.add(correction);
  }

  function flyTo(index, seconds = 1.4) {
    const to = viewPose(index);
    flight = { from: camera.position.clone(), fromTarget: controls.target.clone(), to: to.position, toTarget: to.target, t: 0, seconds };
  }
  function jumpTo(index) {
    const pose = viewPose(index);
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.update();
  }

  function reset() {
    toss = null;
    trail.clear();
    state.phase = 'hold';
    state.wait = 0;
    state.flash = 0;
  }

  function throwRacket() {
    trail.clear();
    const path = throwPath();
    toss = createToss({
      inertia: racketData.inertia,
      axis: state.axis,
      revPerSecond: state.rev,
      orientation: releaseOrientation(state.axis),
      launch: state.zeroG ? FOCUS.toArray() : path.launch,
      velocity: path.velocity,
      zeroG: state.zeroG,
    });
    state.phase = 'flight';
    state.wait = 0;
    nextGhost = 0;
  }

  function place(position, q) {
    racket.position.fromArray(position);
    racket.quaternion.fromArray(q);
    racket.updateMatrixWorld(true);
  }

  window.addEventListener('resize', () => {
    resize();
    flyTo(state.camera, 0.6);
  });
  resize();
  jumpTo(0);

  // ---- UI ----
  const axisButtons = [...document.querySelectorAll('#axis button')];
  const worldButtons = [...document.querySelectorAll('#world button')];
  const spinInput = $('spin');
  const essay = $('essay');

  function setAxis(axis) {
    state.axis = axis;
    axisButtons.forEach((b) => b.classList.toggle('on', b.dataset.axis === axis));
    reset();
  }
  function setWorld(zeroG) {
    state.zeroG = zeroG;
    worldButtons.forEach((b) => b.classList.toggle('on', (b.dataset.world === 'zero-g') === zeroG));
    controls.autoRotate = zeroG;
    reset();
  }
  function setSpin(value) {
    state.rev = value;
    spinInput.value = value;
    $('spin-value').textContent = `${value.toFixed(1)} rev/s`;
    $('m-spin').textContent = `${value.toFixed(1)} rev/s`;
  }
  function cycleCamera() {
    state.camera = (state.camera + 1) % CAMERAS.length;
    flyTo(state.camera);
  }
  const toggleEssay = (open = essay.hidden) => (essay.hidden = !open);

  axisButtons.forEach((b) => b.addEventListener('click', () => setAxis(b.dataset.axis)));
  worldButtons.forEach((b) => b.addEventListener('click', () => setWorld(b.dataset.world === 'zero-g')));
  spinInput.addEventListener('input', () => setSpin(Number(spinInput.value)));
  $('throw').addEventListener('click', throwRacket);
  $('camera').addEventListener('click', cycleCamera);
  $('about').addEventListener('click', () => toggleEssay());
  $('essay-close').addEventListener('click', () => toggleEssay(false));
  // Silent desktop shortcuts: nothing on screen mentions them.
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
    const axis = { 1: 'handle', 2: 'middle', 3: 'face' }[e.key];
    if (axis) setAxis(axis);
    else if (e.key === ' ') {
      e.preventDefault();
      throwRacket();
    } else if (e.key === 'g' || e.key === 'G') setWorld(!state.zeroG);
    else if (e.key === 'c' || e.key === 'C') cycleCamera();
    else if (e.key === '?' || e.key === 'h') toggleEssay();
    else if (e.key === 'Escape') toggleEssay(false);
  });
  setSpin(state.rev);

  const liveEl = $('live');
  const twistEl = $('m-twist');
  const flipsEl = $('m-flips');
  const statsEl = $('stats');
  const shown = {};
  const show = (el, key, value, prop = 'textContent') => {
    if (shown[key] !== value) el[prop] = shown[key] = value;
  };

  // ---- warm-up: compile every group, then real frames, while the canvas is still hidden ----
  // precompile builds every group through the real post.render(); warmUp then renders each camera
  // preset so the frames the user sees first are already built.
  place(throwPath().launch, releaseOrientation(state.axis));
  for (let i = 0; i < 3; i++) {
    racket.position.x += 0.3;
    racket.updateMatrixWorld(true);
    trail.capture(racket.matrixWorld, i, i === 1); // ghosts must exist to be compiled
  }
  trail.update(3, Infinity);
  await guard(precompile(renderer, {
    scene,
    render: () => post.render(),
    groups: [
      ['Painting the court lines', [courtParts.surface]],
      ['Hanging the net', [courtParts.fixtures]],
      ['Raising the floodlights', [courtParts.towers]],
      ['Stirring the dust', [courtParts.air]],
      ['Stringing the racket', [racket]],
      ['Setting up the strobe', [effects]],
    ],
  }), 60);
  const shot = (index) => () => {
    jumpTo(index);
    post.render();
  };
  await guard(warmUp(renderer, [
    ['Warming up the lenses', shot(0)],
    ['Checking the low angle', shot(1)],
    ['Checking the high angle', shot(2)],
  ]));
  jumpTo(0);
  trail.clear();
  place(throwPath().launch, releaseOrientation(state.axis));

  // ---- frame loop ----
  const timer = new THREE.Timer();
  const stats = { fps: 60, backend };
  window.labStats = stats;
  const L = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);

  function frame() {
    timer.update();
    const now = performance.now();
    const raw = timer.getDelta();
    const dt = Math.min(raw, 0.05);
    if (raw > 0) stats.fps += (1 / raw - stats.fps) * 0.03;

    if (state.phase === 'hold') {
      state.wait += dt;
      const bob = Math.sin(now / 700) * 0.012;
      const at = state.zeroG ? FOCUS.toArray() : throwPath().launch;
      place([at[0], at[1] + bob, at[2]], releaseOrientation(state.axis));
      L.copy(SPIN_DIR);
      if (state.wait > AUTO_THROW_AFTER) throwRacket();
    } else {
      if (state.phase === 'flight') {
        const dip = toss.stable ? 0 : Math.exp(-(((toss.twist - 90) / 32) ** 2));
        const scale = (state.zeroG ? ZERO_G_MOTION : SLOW_MOTION) * (1 - 0.75 * dip);
        const flipped = toss.advance(dt * scale);
        place(toss.position, toss.body.q);
        const step = state.zeroG ? GHOST_STEP.zeroG : GHOST_STEP.court;
        if (flipped) {
          state.flash = 1;
          trail.capture(racket.matrixWorld, toss.time, true);
          nextGhost = toss.time + step;
        } else if (toss.time >= nextGhost) {
          trail.capture(racket.matrixWorld, toss.time);
          nextGhost += step;
        }
        if (toss.landed) state.phase = 'caught';
      } else {
        state.wait += dt;
        if (state.wait > RETHROW_AFTER) throwRacket();
      }
      L.fromArray(toss.body.L).applyQuaternion(racket.quaternion).normalize();
    }
    trail.update(toss ? toss.time : 0, state.zeroG ? GHOST_LIFE_ZERO_G : Infinity);

    // Flip flash: bloom surge, glowing trim and a racket-sized ring, all inside the scene.
    state.flash *= Math.exp(-dt * 2.2);
    const f = state.flash;
    post.bloom.strength.value = BLOOM_STRENGTH + 1.4 * f;
    glow.value = 1 + 5 * f;
    shockStrength.value = f > 0.02 ? 1.6 * f * f : 0;
    shock.position.copy(racket.position);
    shock.quaternion.copy(camera.quaternion);
    shock.scale.setScalar(0.2 + 0.3 * (1 - f)); // grows to 0.5 m: just past the racket's reach

    halo.position.copy(racket.position);
    halo.quaternion.setFromUnitVectors(zAxis, L);
    haloStrength.value = state.phase === 'hold' ? 1.2 + Math.sin(now / 260) * 0.5 : 0.25;

    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.seconds);
      const k = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - (-2 * flight.t + 2) ** 3 / 2;
      camera.position.lerpVectors(flight.from, flight.to, k);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      if (flight.t === 1) flight = null;
    }
    controls.update();
    keepInPanBox();
    post.render();

    const twist = toss ? toss.twist : 0;
    const flips = toss ? toss.flips : 0;
    show(twistEl, 'twist', `${Math.round(twist)}°`);
    twistEl.classList.toggle('hot', twist > 60);
    show(flipsEl, 'flips', String(flips));
    const stable = toss ? toss.stable : state.axis !== 'middle';
    show(liveEl, 'live', narrate({ phase: state.phase, axis: state.axis, twist, flips, rate: toss?.rate ?? 0, stable, zeroG: state.zeroG, flash: f }), 'innerHTML');
    show(statsEl, 'stats', `${Math.round(stats.fps)} fps · ${backend}`);
  }

  // Pause when hidden: no rendering, no simulation, and no dt jump on return.
  let loaded = false;
  function run() {
    timer.reset();
    frame(); // the first visible frame is a real one, from the start camera
    document.body.classList.add('scene-ready');
    if (!loaded) {
      loaded = true;
      loader.ready(); // no parts assemble after the hand-off: the drawing fades straight out
    }
    renderer.setAnimationLoop(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else run();
  });
  if (!document.hidden) run();
}

start().catch(fail);
