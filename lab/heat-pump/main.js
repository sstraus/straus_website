/**
 * An air-to-water heat pump and the house it heats, as a section-cut diorama.
 * One gesture: drag the outside temperature. Everything else follows from
 * physics.js (the cycle) and thermal.js (the surfaces). The season toggle
 * plays the changeover (changeover.js) and runs the circuit backwards (cycle.js).
 */
import * as THREE from 'three/webgpu';
import { loader, precompile, warmUp, nextFrame } from '../lib/intro.js';
import { screenUV } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { heatPump, coolingPump, dewPoint, model } from './physics.js';
import { wallProfile, floorSurface, floorSurfaceCooling, windowSurface, groundTemperature } from './thermal.js';
import { circuit, REVERSIBLE } from './cycle.js';
import { createChangeover, steady, sentence, STAGES as SHOW, FLIGHT } from './changeover.js';
import { SOLIDS, LEVEL, PIPE_DEPTH } from './layout.js';
import { U, IRONBOW, createMaterials, backdrop } from './materials.js';
import { buildHouse } from './house.js';
import { buildServices } from './services.js';
import { buildUnit, VALVE } from './unit.js';
import { createAir } from './flows.js';
import { createPipeline } from './post.js';
import { PARTS, TAGS } from './parts.js';
import { narrate } from './narrate.js';

const STAGES = ['ground', 'foundation', 'floor', 'walls', 'interior', 'services', 'unit'];
const LABELS = ['Digging the garden', 'Casting the foundation', 'Laying the floor', 'Building the walls', 'Furnishing the room', 'Laying the pipes', 'Setting the unit'];
// The build show lasts under 2 s: the stages overlap, and the flight to the overview starts as the unit drops in.
const BUILD = { start: 0.1, step: 0.16, grow: 0.5, flight: 0.75 };
const FLIGHT_AT = BUILD.start + BUILD.step * STAGES.length;
const MODES = { floor: 35, radiator: 55 };
const SUMMER_FLOW = 18; // °C chilled water to the floor, above the dew point of the room
const SUPERHEAT = 5; // K the vapour warms above evaporating before the compressor
const SEASONS = {
  winter: { presets: [7, -7, -20], min: -20, max: 15 },
  summer: { presets: [25, 30, 35], min: 20, max: 38 },
};
const GAS = { liquid: 0, mix: 0.5, gas: 1 };
// position: a point on the line of sight (only its direction from the target counts).
// fitW/fitH: world size, in metres, that must fit in the free part of the screen.
const VIEWS = {
  overview: { name: 'Overview', position: [4.2, 3.4, 8.4], target: [-0.4, 0.35, -1.3], fitW: 8.4, fitH: 6.8 },
  unit: { name: 'Unit', position: [4.6, 1.9, 2.9], target: [2.2, 0.75, -0.5], fitW: 2.6, fitH: 2.64 },
  machine: { name: 'Machine', position: [3.3, 1.3, 1.9], target: [2.2, 0.7, -0.2], fitW: 1.5, fitH: 1.5 },
  underground: { name: 'Trench', position: [1.3, 0.35, 3.6], target: [0.9, -0.45, -0.2], fitW: 2.8, fitH: 2.39 },
  room: { name: 'Room', position: [-0.6, 2.1, 3.9], target: [-2.0, 0.8, -1.8], fitW: 4.0, fitH: 3.67 },
  // Close-ups for the changeover, through the open service side. The lines of sight clear the plate and the pump.
  valve: { name: 'Valve', position: [2.83, 0.89, 0.63], target: [2.33, 0.84, -0.22], fitW: 0.22, fitH: 0.18 },
  eev: { name: 'Expansion valve', position: [1.98, 0.49, 0.72], target: [2.08, 0.44, -0.28], fitW: 0.45, fitH: 0.36 },
};
const CYCLE = ['overview', 'unit', 'underground', 'room'];
const INTRO = { position: [9.5, 7.5, 12], target: [-0.4, 0, -1.3], fitW: 12, fitH: 11.1 };

const $ = (id) => document.getElementById(id);

// Pan limits: the target stays in a box around the house and the unit, so the diorama cannot be lost.
const PAN_BOX = new THREE.Box3(new THREE.Vector3(-3.2, -1.2, -3.6), new THREE.Vector3(3.2, 2.4, 0.8));
const panShift = new THREE.Vector3();
function keepOnDiorama(camera, target) {
  panShift.copy(target);
  target.clamp(PAN_BOX.min, PAN_BOX.max);
  camera.position.add(panShift.subVectors(target, panShift)); // move with the target: no orbit jump
}
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// Steps: the module download, 4 set-up steps, 8 compile groups, 1 warm-up frame, 7 build stages.
loader.expect(21);
async function loading(label) {
  loader.step(label);
  await nextFrame();
}

async function start() {
  await loading('Starting the renderer');
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: location.search.includes('webgl') });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('stage').appendChild(renderer.domElement);
  await renderer.init();
  const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';

  const scene = new THREE.Scene();
  scene.backgroundNode = backdrop(screenUV);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enabled = false;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.minDistance = 0.35;
  controls.maxDistance = 30; // the phone overview needs about 25 m to fit the diorama across a portrait screen
  controls.screenSpacePanning = true; // right-drag, ctrl/shift + left-drag, two fingers
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // ---------- The diorama, one pivot per construction stage ----------
  await loading('Cutting the section');
  const m = createMaterials();
  const stages = {};
  const bottoms = {};
  for (const name of STAGES) {
    stages[name] = new THREE.Group();
    scene.add(stages[name]);
    const own = SOLIDS.filter((s) => s.stage === name);
    bottoms[name] = own.length ? Math.min(...own.map((s) => s.min[1])) : LEVEL.floor;
  }
  bottoms.services = LEVEL.trenchBottom;
  const house = buildHouse(stages, m);
  scene.add(house.lampLight);
  await loading('Laying the pipes');
  const services = buildServices(stages, m);
  await loading('Assembling the unit');
  const unit = buildUnit(stages.unit, m);
  const air = createAir();
  scene.add(air.group);

  // ---------- Light: the studio baseline, with the key over the garden ----------
  scene.add(new THREE.HemisphereLight(0x2a3d5c, 0x07090d, 0.5));
  const key = new THREE.SpotLight(0xffe2bf, 520, 40, 0.42, 0.6, 2);
  key.position.set(5, 9, 9);
  key.target.position.set(-0.6, 0, -1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xd6e4ff, 320, 40, 0.45, 0.7, 2);
  rim.position.set(-7, 6, -9);
  rim.target.position.set(0, 0.5, -1.5);
  scene.add(rim, rim.target);
  const fill = new THREE.SpotLight(0xbcd4ff, 90, 40, 0.6, 1, 2);
  fill.position.set(2, 4, 14);
  fill.target.position.set(-0.5, 0.3, -1.3);
  scene.add(fill, fill.target);

  const post = createPipeline(renderer, scene, camera);

  // ---------- Camera ----------
  let view = 'overview';
  let flight = null;
  let band = 1; // share of the screen height that is free of the hero and the sheet
  function pose(v) {
    const target = new THREE.Vector3(...v.target);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(controls.minDistance, v.fitW / 2 / (tanV * camera.aspect), v.fitH / 2 / (tanV * band));
    return { position: new THREE.Vector3(...v.position).sub(target).setLength(distance).add(target), target };
  }
  function flyTo(name, seconds = 1.5) {
    view = name;
    $('view-name').textContent = VIEWS[name].name;
    flight = { from: { position: camera.position.clone(), target: controls.target.clone() }, to: pose(VIEWS[name]), t: 0, seconds };
  }
  function flyToPoint(point) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(0.55);
    flight = { from: { position: camera.position.clone(), target: controls.target.clone() }, to: { position: point.clone().add(offset), target: point.clone() }, t: 0, seconds: 1.1 };
  }
  /** On a phone the scene lives in the band between the hero and the control sheet. */
  const phone = matchMedia('(max-width: 759px)');
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 40 : 34;
    if (phone.matches) {
      const top = document.querySelector('.hero').getBoundingClientRect().bottom;
      const bottom = document.querySelector('.console').getBoundingClientRect().top;
      band = Math.max(0.3, (bottom - top) / h);
      camera.setViewOffset(w, h, 0, h / 2 - (top + bottom) / 2, w, h);
    } else {
      band = 1;
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }
  resize();
  {
    const p = pose(INTRO);
    camera.position.copy(p.position);
    controls.target.copy(p.target);
    controls.update();
  }
  window.addEventListener('resize', () => {
    resize();
    if (introDone) flyTo(view, 0.6);
  });

  // ---------- State ----------
  let now = 0; // build show clock: starts when the scene is on screen
  let introDone = false;
  let flying = false;
  let stepShown = -1;
  // `mode` is the winter emitter; summer always cools through the floor.
  const state = { season: 'winter', outside: -7, mode: 'floor', thermal: false, open: false };
  const outsideBySeason = { winter: -7, summer: 30 };
  const anim = { thermal: 0, open: 0, cut: 0 };
  let live = null;

  // ---------- The season changeover ----------
  const changeover = createChangeover(state.season, heatPump({ outside: state.outside, flow: MODES.floor }).frequency);
  let target = null; // what the shaders should show at rest for the current state, per blend group
  let shown = null; // what they show now
  let from = null; // what they showed when the changeover started or reversed
  let showFrom = null; // the changeover state at that moment
  let savedView = null; // the view to return to after the show
  let showStage = -1;
  let showing = false; // the changeover was running in the last frame
  let hz = 0;

  /**
   * Every value the shaders read, for one season at rest, in three blend groups:
   * the surroundings follow the whole show, the water its water stage, and the
   * refrigerant (exchangers and runs) its reverse stage.
   */
  function seasonValues(season, outside, mode) {
    const summer = season === 'summer';
    const flow = summer ? SUMMER_FLOW : MODES[mode];
    const inside = summer ? model.summerIndoor : model.indoor;
    const p = summer ? coolingPump({ outside, flow }) : heatPump({ outside, flow });
    const wall = wallProfile(outside, inside);
    const floor = summer ? floorSurfaceCooling(p.load, inside) : mode === 'floor' ? floorSurface(p.load) : inside + 0.5;
    const glass = windowSurface(outside, inside);
    const cycle = { discharge: p.discharge, condensing: p.condensing, evaporating: p.evaporating, suction: p.evaporating + SUPERHEAT };
    const refrigerant = { coil: summer ? p.condensing : p.evaporating, plate: summer ? p.evaporating : p.condensing, ...cycle };
    for (const run of circuit(season)) {
      refrigerant[`${run.name}.temperature`] = cycle[run.temperature];
      refrigerant[`${run.name}.gas`] = GAS[run.phase];
    }
    const env = {
      outside, inside, window: glass,
      ...Object.fromEntries(wall.temps.map((t, i) => [`wall${i}`, t])),
      lo: summer ? flow - 3 : outside - 3,
      hi: summer ? outside + 8 : flow + 8,
      snow: summer ? 0 : clamp01(-outside / 4),
      frost: !summer && outside < 6 ? clamp01((6 - outside) / 10) * 0.8 : 0,
      plume: mode === 'radiator' && !summer ? 0.5 + p.load / 12 : 0,
      power: 0.4 + p.electricity / 3,
    };
    const water = { flow, ret: p.returnWater, floor, waterSpeed: 0.15 + p.load / 30 };
    return { p, flow, inside, wall, floor, glass, values: { env, water, refrigerant } };
  }

  /** Share of the way each blend group has come from `from` to `target`. */
  function progressOf(c) {
    if (!c.running || !from) return { env: 1, water: 1, refrigerant: 1 };
    const goal = steady(c.target, 0);
    const rel = (key) => {
      const d = goal[key] - showFrom[key];
      return Math.abs(d) < 1e-6 ? 1 : clamp01((c[key] - showFrom[key]) / d);
    };
    return { env: smooth(c.progress), water: rel('water'), refrigerant: rel('roles') };
  }

  function applyValues(c) {
    const k = progressOf(c);
    for (const group of Object.keys(target)) {
      for (const [key, value] of Object.entries(target[group])) {
        const start = from?.[group][key] ?? value;
        shown[group][key] = start + (value - start) * k[group];
      }
    }
    const { env, water, refrigerant } = shown;
    for (const key of ['outside', 'inside', 'window', 'lo', 'hi', 'snow', 'frost', 'plume', 'power']) U[key].value = env[key];
    U.wall.forEach((u, i) => (u.value = env[`wall${i}`]));
    for (const key of ['flow', 'ret', 'floor', 'waterSpeed']) U[key].value = water[key];
    for (const key of ['coil', 'plate', 'discharge', 'condensing', 'evaporating', 'suction']) U[key].value = refrigerant[key];
    // The points of light fade while the two exchangers trade temperatures.
    const swapping = c.running && k.refrigerant > 0 && k.refrigerant < 1 ? Math.sin(Math.PI * k.refrigerant) : 0;
    for (const [name, run] of Object.entries(unit.runs)) {
      run.live.temperature.value = refrigerant[`${name}.temperature`];
      run.live.gas.value = refrigerant[`${name}.gas`];
      run.live.shown.value = 1 - 0.85 * swapping;
    }
    U.fanWarm.value = c.fan;
    unit.valve.slider.position.x = VALVE.slider.winter + (VALVE.slider.summer - VALVE.slider.winter) * c.valve;
  }

  function update() {
    const summer = state.season === 'summer';
    const mode = summer ? 'floor' : state.mode;
    const now = seasonValues(state.season, state.outside, mode);
    const { p, flow, wall, floor, glass } = now;
    target = now.values;
    shown ??= structuredClone(target);
    changeover.setHz(p.frequency);
    const radiator = 1.6 * ((flow - 2.5 - model.indoor) / 50) ** 1.3;
    const c = changeover.current();
    live = {
      p, season: state.season, outside: state.outside, inside: now.inside, flow, mode, open: state.open, thermal: state.thermal,
      wall, floor, window: glass, radiator, soil: groundTemperature(PIPE_DEPTH, state.outside),
      dew: dewPoint(model.summerIndoor, model.summerHumidity), valve: c.valve, hz: c.hz,
    };
    U.ripple.value = mode === 'floor' ? 1 : 0;
    applyValues(c);

    const show = (group, on) => group.scale.setScalar(on ? 1 : 1e-4);
    show(house.radiator, mode === 'radiator');
    show(services.radiatorPipes, mode === 'radiator');
    show(services.floorLoop, mode === 'floor');

    const range = SEASONS[state.season];
    const slider = $('slider');
    slider.min = range.min;
    slider.max = range.max;
    slider.value = state.outside;
    const signed = (v) => `${v > 0 ? '+' : ''}${v}`;
    $('outside-value').textContent = `${signed(state.outside)} °C`;
    $('m-outside').textContent = `${state.outside} °C`;
    $('m-eff-label').textContent = summer ? 'EER' : 'COP';
    $('m-eff').textContent = p.efficiency.toFixed(2);
    $('m-eff').classList.toggle('good', p.efficiency >= 3.5);
    if (!c.running) $('sentence').innerHTML = narrate(live);
    document.querySelectorAll('[data-preset]').forEach((b) => {
      const v = range.presets[Number(b.dataset.preset)];
      b.dataset.outside = v;
      b.textContent = `${signed(v)}°`;
      b.classList.toggle('on', v === state.outside);
    });
    document.querySelectorAll('[data-season]').forEach((b) => b.classList.toggle('on', b.dataset.season === state.season));
    document.querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === mode);
      b.disabled = summer && b.dataset.mode === 'radiator';
    });
    $('mode-floor').textContent = `Floor ${flow}°`;
    $('thermal').setAttribute('aria-pressed', String(state.thermal));
    $('open').setAttribute('aria-pressed', String(state.open));
    $('legend').hidden = !state.thermal;
    $('legend-lo').textContent = `${Math.round(target.env.lo)} °C`;
    $('legend-hi').textContent = `${Math.round(target.env.hi)} °C`;
    if (cardPart) fillCard(cardPart);
  }

  /**
   * Switch the season. The first tap plays the changeover; a tap on the season
   * under way skips to its end; a tap on the other one reverses from where the
   * show is.
   */
  function setSeason(season) {
    if (!introDone || (season === state.season && !changeover.running)) return;
    if (season !== state.season) {
      if (!changeover.running) savedView = view;
      from = structuredClone(shown);
      showFrom = changeover.current();
      outsideBySeason[state.season] = state.outside;
      state.season = season;
      state.outside = outsideBySeason[season];
    }
    changeover.start(season);
    closeCard();
    hideTip();
    update();
  }

  /** One frame of the changeover: stage flights, labels, the sentence and the moving parts. */
  function stepChangeover(dt) {
    const c = changeover.update(dt);
    if (showing || c.running) {
      live.valve = c.valve;
      applyValues(c);
    }
    if (c.running && c.index !== showStage) {
      showStage = c.index;
      const stage = SHOW[c.index];
      if (view !== stage.view) flyTo(stage.view, FLIGHT);
      $('sentence').innerHTML = sentence(stage.name, c.target, live.p.frequency);
    }
    if (showing && !c.running) {
      // The show is over, played or skipped: back to the view the user had and the steady sentence.
      showStage = -1;
      from = null;
      flyTo(savedView ?? 'overview', 1.1);
      $('sentence').innerHTML = narrate(live);
    }
    showing = c.running;
    hz = c.hz;
    live.hz = hz;
    // The body opens while the valve moves and the flow restarts; the solenoid slides off its stem meanwhile.
    const cutting = c.running && c.index >= 1 && c.index <= 2;
    anim.cut += ((cutting ? 1 : 0) - anim.cut) * Math.min(1, dt * 6);
    U.cut.value = anim.cut;
    U.ports.value = anim.cut;
    unit.valve.solenoid.position.y = 0.1 * smooth(anim.cut);
    // Refrigerant points: speed follows the compressor, vapour runs faster than liquid; the four reversible runs follow the valve.
    for (const [name, run] of Object.entries(unit.runs)) {
      const direction = REVERSIBLE.has(name) ? c.direction : 1;
      run.live.travel.value += dt * 0.004 * hz * (1 + 2 * run.live.gas.value) * direction;
    }
  }
  $('legend-bar').style.background = `linear-gradient(90deg, ${IRONBOW.join(', ')})`;

  // ---------- Controls ----------
  const setOutside = (v) => { state.outside = v; update(); };
  $('slider').addEventListener('input', (e) => setOutside(Number(e.target.value)));
  document.querySelectorAll('[data-season]').forEach((b) => b.addEventListener('click', () => setSeason(b.dataset.season)));
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => setOutside(Number(b.dataset.outside))));
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (state.season === 'summer') return;
    state.mode = b.dataset.mode;
    update();
  }));
  const toggleThermal = () => { state.thermal = !state.thermal; update(); };
  const toggleOpen = () => {
    state.open = !state.open;
    update();
    if (state.open) flyTo('machine');
  };
  const cycleView = () => flyTo(CYCLE[(CYCLE.indexOf(view) + 1) % CYCLE.length]);
  const essay = $('essay');
  const toggleEssay = (open = !essay.classList.contains('open')) => {
    essay.classList.toggle('open', open);
    essay.setAttribute('aria-hidden', String(!open));
  };
  $('thermal').addEventListener('click', toggleThermal);
  $('open').addEventListener('click', toggleOpen);
  $('view').addEventListener('click', cycleView);
  $('info').addEventListener('click', () => toggleEssay());
  $('essay-close').addEventListener('click', () => toggleEssay(false));
  // Silent desktop shortcuts: nothing on screen mentions them.
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || !introDone) return;
    const k = e.key.toLowerCase();
    if (k === 't') toggleThermal();
    else if (k === 'o') toggleOpen();
    else if (k === 'c') cycleView();
    else if (k === '?') toggleEssay();
    else if (k === 'escape') { toggleEssay(false); closeCard(); }
  });

  // ---------- Pointing at parts: tooltip, then a card and a flight ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const targets = Object.entries(PARTS).map(([name, part]) => {
    const hit = new THREE.Mesh(new THREE.SphereGeometry(part.radius, 12, 8));
    hit.position.set(...part.position);
    hit.layers.set(1);
    hit.updateMatrixWorld();
    return { name, part, hit };
  });
  const available = (part) => {
    if (part.when === 'show') return changeover.running;
    if (part.when === 'always') return true;
    if (part.when === 'open') return state.open || changeover.running;
    if (part.when === 'closed') return !state.open && !changeover.running;
    return part.when === live.mode;
  };
  const tip = $('object-tip');
  const card = $('card');
  let cardPart = null;
  let tipPart = null;

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  function pick(event) {
    setPointer(event);
    raycaster.layers.set(1);
    const hits = raycaster.intersectObjects(targets.filter((t) => available(t.part)).map((t) => t.hit), false);
    return targets.find((t) => t.hit === hits[0]?.object);
  }
  function showTip(target, event, touch) {
    tipPart = target.name;
    tip.hidden = false;
    tip.classList.toggle('touch', touch);
    $('tip-text').textContent = target.part.tip(live);
    tip.style.left = `${Math.max(8, Math.min(event.clientX + 14, innerWidth - 250))}px`;
    tip.style.top = `${Math.max(8, Math.min(event.clientY + (touch ? -70 : 16), innerHeight - 60))}px`;
  }
  const hideTip = () => { tip.hidden = true; tipPart = null; };
  function fillCard(name) {
    const part = PARTS[name];
    $('card-title').textContent = part.title;
    $('card-text').textContent = part.text;
    $('card-rows').innerHTML = part.rows(live).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  }
  function openCard(name) {
    if (!introDone) return;
    cardPart = name;
    fillCard(name);
    card.hidden = false;
    hideTip();
    const part = PARTS[name];
    if (part.view === 'machine' && !state.open) toggleOpen();
    flyTo(part.view);
  }
  function closeCard() {
    cardPart = null;
    card.hidden = true;
  }
  $('card-close').addEventListener('click', closeCard);
  $('tip-open').addEventListener('click', () => tipPart && openCard(tipPart));

  const canvas = renderer.domElement;
  let pointerStart = null;
  let pointerCount = 0;
  let dragged = false;
  let pointerType = 'mouse';
  let lastTap = { time: 0, x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (event) => {
    if (pointerCount === 0) {
      pointerStart = { x: event.clientX, y: event.clientY };
      dragged = false;
    }
    pointerCount++;
    if (pointerCount > 1) dragged = true;
    pointerType = event.pointerType;
    if (introDone) flight = null;
  });
  const moved = (event) => pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 9;
  canvas.addEventListener('pointerup', (event) => {
    if (moved(event)) dragged = true;
    pointerCount = Math.max(0, pointerCount - 1);
  });
  canvas.addEventListener('pointercancel', () => { pointerCount = 0; dragged = true; });
  canvas.addEventListener('pointermove', (event) => {
    if (moved(event)) dragged = true;
    if (event.pointerType === 'touch' || !introDone || pointerCount > 0) return;
    const target = pick(event);
    canvas.style.cursor = target ? 'pointer' : '';
    if (target) showTip(target, event, false);
    else hideTip();
  });
  canvas.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch') hideTip(); });

  /** Double tap or double click: fly the orbit centre to the surface under the finger. */
  function focusAt(event) {
    setPointer(event);
    raycaster.layers.set(0);
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object.isMesh && !h.object.material.transparent);
    if (hit) flyToPoint(hit.point);
  }
  canvas.addEventListener('click', (event) => {
    if (dragged || !introDone) return;
    const now = performance.now();
    const double = now - lastTap.time < 320 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30;
    lastTap = { time: double ? 0 : now, x: event.clientX, y: event.clientY };
    if (double) {
      hideTip();
      focusAt(event);
      return;
    }
    const target = pick(event);
    if (!target) {
      hideTip();
      return;
    }
    if (pointerType === 'touch' && tipPart !== target.name) {
      showTip(target, event, true);
      return;
    }
    openCard(target.name);
  });

  // ---------- Labels: at most three on screen, the tooltip included, never overlapping ----------
  const tagEls = [0, 1, 2].map((i) => $(`tag-${i}`));
  const projected = new THREE.Vector3();
  function tagNames() {
    if (changeover.running) return SHOW[showStage]?.tags ?? [];
    return (state.open ? TAGS.open : TAGS.closed).map((n) => (n === 'emitter' ? live.mode : n));
  }
  const overlaps = (a, b) => a.left < b.right + 6 && b.left < a.right + 6 && a.top < b.bottom + 6 && b.top < a.bottom + 6;
  const hero = document.querySelector('.hero');
  const sheet = document.querySelector('.console');
  /** Tags in priority order; one that would collide with the hero, the sheet, the card, the tooltip or a higher tag stays hidden. */
  function placeTags() {
    const taken = [hero, sheet, card, tip].filter((el) => !el.hidden).map((el) => el.getBoundingClientRect());
    let room = 3 - (tip.hidden ? 0 : 1);
    tagNames().forEach((name, i) => {
      const el = tagEls[i];
      const part = PARTS[name];
      projected.set(...part.position).project(camera);
      const onScreen = introDone && room > 0 && name !== tipPart && projected.z < 1 && Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95;
      el.hidden = !onScreen;
      if (!onScreen) return;
      const text = part.tip(live);
      if (el.textContent !== text) el.textContent = text;
      // A tag near the right edge slides left to stay on screen; its leader line keeps pointing at the part.
      const x = ((projected.x + 1) / 2) * innerWidth;
      const shift = Math.max(0, x - 8 + el.offsetWidth - (innerWidth - 8));
      el.style.transform = `translate(${x - shift}px, ${((1 - projected.y) / 2) * innerHeight}px)`;
      el.style.setProperty('--lead', `${7 + shift}px`);
      const rect = el.getBoundingClientRect();
      if (taken.some((r) => overlaps(r, rect))) {
        el.hidden = true;
        return;
      }
      taken.push(rect);
      room--;
    });
  }

  // ---------- Build show ----------
  function setStage(name, k) {
    const group = stages[name];
    if (name === 'unit') {
      group.scale.setScalar(k > 0 ? 1 : 1e-4);
      group.position.y = (1 - smooth(k)) * 1.6;
      return;
    }
    const s = Math.max(1e-4, smooth(k));
    group.scale.set(1, s, 1);
    group.position.y = bottoms[name] * (1 - s);
  }
  function animateBuild() {
    STAGES.forEach((name, i) => {
      const at = BUILD.start + i * BUILD.step;
      setStage(name, clamp01((now - at) / BUILD.grow));
      if (now >= at && stepShown < i) {
        stepShown = i;
        loader.step(LABELS[i]);
      }
    });
    if (!flying && now >= FLIGHT_AT) {
      flying = true;
      flyTo('overview', BUILD.flight);
    }
    if (now >= FLIGHT_AT + BUILD.flight) {
      introDone = true;
      controls.enabled = true;
      for (const name of STAGES) setStage(name, 1);
      // The page always opens on the overview, with nothing selected.
      closeCard();
      hideTip();
      loader.ready();
      document.body.classList.remove('loading');
    }
  }

  // ---------- Frame ----------
  const clock = new THREE.Timer();
  let fps = 60;
  let lastUi = 0;
  const lens = { value: 8 };
  function frame(timestamp) {
    clock.update(timestamp);
    const dt = Math.min(clock.getDelta(), 0.1);
    now += dt;
    if (!introDone) animateBuild();
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

    anim.thermal += ((state.thermal ? 1 : 0) - anim.thermal) * Math.min(1, dt * 4);
    // The changeover opens the unit for its close-ups and closes it again afterwards if it was closed.
    anim.open += ((state.open || changeover.running ? 1 : 0) - anim.open) * Math.min(1, dt * 3.5);
    U.thermal.value = anim.thermal;
    unit.open(smooth(clamp01(anim.open)));
    if (introDone) stepChangeover(dt);
    else hz = live.p.frequency;
    // The inverter sets the pace: fan, air streaks and refrigerant all follow the compressor frequency.
    unit.fan.rotation.x -= dt * 0.15 * hz;
    air.setRate(hz);
    U.air.value = 1 - 0.7 * anim.thermal;
    key.intensity = 520 * (1 - 0.6 * anim.thermal);
    house.lampLight.intensity = 2.2 * (1 - anim.thermal) * Math.min(1, stages.interior.scale.y);

    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.seconds);
      const k = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - (-2 * flight.t + 2) ** 3 / 2;
      camera.position.lerpVectors(flight.from.position, flight.to.position, k);
      controls.target.lerpVectors(flight.from.target, flight.to.target, k);
      if (flight.t === 1) flight = null;
    }
    controls.update();
    keepOnDiorama(camera, controls.target);
    lens.value += (camera.position.distanceTo(controls.target) - lens.value) * Math.min(1, dt * 5);
    post.focus.value = lens.value;
    // A light depth of field only while the camera flies; at rest the image is sharp.
    post.blur.value = flight ? 1.5 * Math.sin(Math.PI * flight.t) : 0;
    // In the thermal view every surface is emissive, so bloom would wash out the whole image.
    post.bloom.strength.value = 0.6 * (1 - anim.thermal);
    post.render();

    placeTags();
    const hzText = `${Math.round(hz)} Hz`;
    if ($('m-hz').textContent !== hzText) $('m-hz').textContent = hzText;
    if (timestamp - lastUi > 500) {
      lastUi = timestamp;
      $('stats').textContent = `${Math.round(fps)} fps · ${backend}`;
      if (tipPart && !tip.hidden) $('tip-text').textContent = PARTS[tipPart].tip(live);
    }
  }

  // ---------- Loading ----------
  // The stages start folded (scale, not visibility, so they compile), then each group compiles
  // through the real frame (lab/lib/intro.js), then one warm-up frame builds the shadow and post
  // passes. The build show runs over the rendered scene.
  update();
  resize(); // the hero now holds its sentence, so the free band is final
  animateBuild();
  await precompile(renderer, {
    scene,
    render: () => post.render(),
    groups: [
      ['Compiling the soil', [stages.ground]],
      ['Compiling the foundation', [stages.foundation]],
      ['Compiling the floor', [stages.floor]],
      ['Compiling the walls', [stages.walls]],
      ['Compiling the room', [stages.interior]],
      ['Compiling the pipes', [stages.services]],
      ['Compiling the unit', [stages.unit]],
      ['Compiling the air', [air.group]],
    ],
  });
  await warmUp(renderer, [['Warming up the lenses', () => post.render()]]);

  clock.connect(document);
  function run() {
    clock.reset();
    renderer.setAnimationLoop(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else run();
  });
  frame(performance.now());
  document.body.classList.add('scene-ready');
  loader.handoff();
  if (!document.hidden) run();
}

start().catch((error) => {
  loader.fail(error);
  throw error;
});
