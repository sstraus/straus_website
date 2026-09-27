// Antigrav: an anti-gravity racer on a circuit in orbit. The player against three computer ships.
// The game (track, physics, items, pilots, race rules, story, mix) is pure and tested; this file
// wires it to three.js, the controls, the sound and the page.
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loader, precompile, warmUp, nextFrame } from '../lib/intro.js';
import { fog, rangeFogFactor, color } from 'three/tsl';
import { buildTrack, frameAt, toWorld, gapS, wrapS } from './track.js';
import { createShip, stepShip, collideShips, speedOf, DT, SHIP } from './physics.js';
import { createItems, equip, pickup, useItem, updateItems, ITEM, ITEMS } from './items.js';
import { createPilot, drive } from './ai.js';
import { createRace, updateRace, gridSlots, canDrive, placeFraction, LAPS } from './race.js';
import { sentence } from './story.js';
import { mulberry32 } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildTrackMesh } from './track-mesh.js';
import { createShipMeshes, NOZZLES, TAIL } from './ship-model.js';
import { createEffects } from './effects.js';
import { createPipeline } from './post.js';
import { createSpace } from './space.js';
import { environmentScene, U, SUN } from './materials.js';
import { createUI } from './ui.js';

const $ = (id) => document.getElementById(id);
const PLAYER = 0;
const NAMES = ['You', 'Kestrel', 'Vesper', 'Ardent'];
const COLORS = [0xff6a1a, 0x22c3ff, 0xe8409a, 0x9be22d].map((c) => new THREE.Color(c));
const NUMBERS = [7, 3, 5, 9];
const GRID_SLOT = [3, 0, 1, 2];          // the player starts at the back
const NO_INPUT = { throttle: 0, steer: 0, brakeL: 0, brakeR: 0 };
const STORY_EVENTS = new Set(['hit', 'shieldHit', 'item', 'use', 'pad', 'wall', 'lap']);
// Low and close to the deck; the field of view opens from 70° to 95° with speed.
const CAMERA = { back: 6.6, up: 1.85, look: 16, fov: 70, fovTop: 95 };
// Review harness (?autopilot and window.__antigrav.review): the pro autopilot flies the player.
const AUTOPILOT = location.search.includes('autopilot');

// ---------- loader (lab/lib/intro.js) ----------
// Steps: the module download, 3 set-up steps, 5 compile groups, 2 warm-up frames, the roll-out.
loader.expect(12);
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
  await loading('Laying out the circuit');
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: location.search.includes('webgl') });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('stage').appendChild(renderer.domElement);
  await renderer.init();
  // Instance matrices as vertex attributes, never as a uniform array: three writes the array size
  // and a unique buffer name into the vertex shader, so every small InstancedMesh compiled a
  // program of its own (measured: 46 vertex programs for 22 materials).
  renderer.backend.capabilities.getUniformBufferLimit = () => 0;
  const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  const t0 = performance.now();

  const track = buildTrack();
  const scene = new THREE.Scene();
  // Far enough for the outer star shell (6 km) and the far circuit.
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.3, 12000);
  scene.add(camera);
  // A thin blue haze: the far structures fade, the sky and the lights opt out.
  scene.fogNode = fog(color(0x0a1830), rangeFogFactor(300, 3500).mul(0.5));
  const trackMesh = buildTrackMesh(track);
  scene.add(trackMesh.group);
  // Space: the baked far layer, star shells, rocks, the shipyard, the flare (space.js).
  const space = createSpace(renderer, track, trackMesh);
  scene.add(space.group);

  await loading('Rolling out the ships');
  const shipMeshes = createShipMeshes(4, COLORS, NUMBERS, PLAYER);
  scene.add(shipMeshes.group);
  const effects = createEffects();
  scene.add(effects.group);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  // A soft, partial shadow: the deck in full shadow went black and read as a hole.
  sun.shadow.intensity = 0.55;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x8fa6c8, 0x1d4a7a, 0.55));   // space above, planet glow below

  await loading('Lighting the planet');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = environmentScene();
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  // The softbox room and the generator's passes ran once; free them and their programs.
  pmrem.dispose();
  envScene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  scene.environmentIntensity = 0.9;

  // ---------- game state ----------
  const lines = {};
  const game = {
    phase: 'grid', level: 'pro', race: null, ships: [], pilots: [], items: createItems(), rand: mulberry32(13),
    events: [], story: null, time: 0, shake: 0, kick: 0, finishAt: 0, autopilot: null,
  };
  const aiInputs = [0, 1, 2, 3].map(() => ({ throttle: 0, steer: 0, brakeL: 0, brakeR: 0, fire: false }));
  const playerInput = { throttle: 0, steer: 0, brakeL: 0, brakeR: 0 };
  const inputs = [NO_INPUT, NO_INPUT, NO_INPUT, NO_INPUT];      // what each ship flew last step

  function resetGrid() {
    const slots = gridSlots(track, 4);
    game.ships = [0, 1, 2, 3].map((id) => equip(createShip(track, { ...slots[GRID_SLOT[id]], id })));
    game.pilots = game.ships.map((_, id) => (id === PLAYER ? null : createPilot(track, game.level, game.rand, lines)));
    game.autopilot = createPilot(track, 'pro', game.rand, lines);
    game.items = createItems();
    game.race = null;
    game.story = null;
    game.finishAt = 0;
    looks.forEach((l) => Object.assign(l, { boost: 0, shieldKick: 0, lean: 0, pitch: 0, brakeL: 0, brakeR: 0 }));
    U.hits.array.forEach((h) => h.set(0, 0, -100, 0));
  }
  // Per-ship look, smoothed from the physics: flaps, lean, pitch, boost, shield flash.
  const looks = [0, 1, 2, 3].map(() => ({ thrust: 0, shield: 0, zap: 0, plume: 0, brakeL: 0, brakeR: 0, hover: SHIP.h0, boost: 0, shieldKick: 0, lean: 0, pitch: 0 }));
  resetGrid();

  const post = createPipeline(renderer, scene, camera);
  await precompile(renderer, {
    scene,
    render: () => post.render(),
    groups: [
      ['Compiling space and the planet', [space.group]],
      ['Compiling the deck and the walls', trackMesh.group.children.filter((o) => o !== trackMesh.station)],
      ['Compiling the station', [trackMesh.station]],
      ['Compiling the ships', [shipMeshes.group]],
      ['Compiling the effects', [effects.group]],
    ],
  });

  // ---------- page, controls, sound ----------
  const ui = createUI({ names: NAMES, colors: COLORS });
  const input = createInput({
    throttle: $('throttle'), steer: $('steer'), brakeL: $('brake-l'), brakeR: $('brake-r'), fire: $('fire'), essay: $('essay'), surface: renderer.domElement,
  });
  const audio = createAudio();
  ui.bindAudio(audio);
  input.onFirstGesture(() => audio.unlock());
  input.setEnabled(false);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 6;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const player = () => game.ships[PLAYER];
  const entryOf = (ship) => game.race.entries.find((e) => e.ship === ship);

  function startRace() {
    audio.unlock();
    audio.reset();
    game.level = ui.level;
    resetGrid();
    game.race = createRace(track, game.ships, { laps: LAPS, player: PLAYER });
    game.phase = 'race';
    game.blend = 0;
    chase.ready = false;
    controls.enabled = false;
    input.reset();
    input.setEnabled(!AUTOPILOT);
    ui.setPhase('race');
  }
  ui.onRace(startRace);
  ui.onAgain(() => {
    resetGrid();
    game.phase = 'grid';
    enterShowroom();
    ui.setPhase('grid');
  });

  // ---------- simulation ----------
  function simStep(dt) {
    const race = game.race, ev = game.events, first = ev.length;
    const driving = race && canDrive(race);
    const ctx = { ships: game.ships, items: game.items, track, dt, player: game.ships[PLAYER] };
    game.ships.forEach((ship, i) => {
      let inp = NO_INPUT;
      if (driving) {
        const auto = i === PLAYER && (AUTOPILOT || race.phase === 'finished');
        if (i === PLAYER && !auto) inp = playerInput;
        else inp = drive(auto ? game.autopilot : game.pilots[i], ship, ctx, aiInputs[i]);
        if (auto && race.phase !== 'finished') humanize(inp, dt);
        if (inp.fire && ship.item) useItem(game.items, ship, game.ships, track, ev);
      }
      inputs[i] = inp;
      stepShip(ship, inp, track, dt, ev);
    });
    collideShips(game.ships, track, ev);
    updateItems(game.items, game.ships, track, dt, ev);
    if (race) {
      updateRace(race, dt, ev);
      for (let k = first; k < ev.length; k++) {
        const e = ev[k];
        if (e.type === 'pickup') pickup(game.items, e.ship, e.pad, placeFraction(race, entryOf(e.ship)), game.rand, ev);
      }
    }
  }

  // The autopilot on the player's ship eases off like a person: a slow throttle drift and a
  // short lift every few seconds, so pads, airbrakes and wall touches still happen.
  const lift = { t: 0, next: 4 };
  function humanize(inp, dt) {
    lift.next -= dt;
    if (lift.next <= 0) { lift.t = 0.25 + game.rand() * 0.35; lift.next = 3 + game.rand() * 5; }
    lift.t = Math.max(0, lift.t - dt);
    inp.throttle = lift.t > 0 ? 0.35 : Math.min(1, inp.throttle * (0.93 + 0.07 * Math.sin(game.time * 1.3)));
  }

  // ---------- visuals ----------
  const F = frameAt(track, 0);
  const V = { p: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), U: new THREE.Vector3() };
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3();
  const mat = new THREE.Matrix4(), pos = [0, 0, 0];

  function frameVectors(s, d, h) {
    frameAt(track, s, F);
    toWorld(track, s, d, h, pos, F);
    V.p.fromArray(pos); V.T.fromArray(F.T); V.N.fromArray(F.N); V.U.fromArray(F.U);
    return V;
  }

  // Pose of a ship: heading on the deck, a roll into the turn (more with an airbrake out), a pitch
  // from the hover and the airbrakes. `out.ground` is the deck under it (X right, Y forward, Z up).
  const poses = [0, 1, 2, 3].map(() => ({ p: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), vel: new THREE.Vector3(), ground: new THREE.Matrix4() }));
  function poseShip(ship, out, look = null) {
    const f = frameVectors(ship.s, ship.d, ship.h);
    const c = Math.cos(ship.psi), s = Math.sin(ship.psi);
    fwd.copy(f.T).multiplyScalar(c).addScaledVector(f.N, s);
    right.copy(f.N).multiplyScalar(c).addScaledVector(f.T, -s);
    out.ground.makeBasis(right, fwd, f.U).setPosition(tmp.copy(f.p).addScaledVector(f.U, 0.08 - ship.h));
    const lean = look ? look.lean : 0, pitch = look ? look.pitch : 0;
    up.copy(f.U).multiplyScalar(Math.cos(lean)).addScaledVector(right, Math.sin(lean));
    right.multiplyScalar(Math.cos(lean)).addScaledVector(f.U, -Math.sin(lean));
    fwd.multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch));
    up.crossVectors(right, fwd).normalize();
    mat.makeBasis(right, up, tmp.copy(fwd).negate()).setPosition(f.p);
    out.p.copy(f.p);
    out.fwd.copy(fwd);
    out.up.copy(f.U);
    out.vel.copy(f.T).multiplyScalar(ship.vx).addScaledVector(f.N, ship.vy);
    return mat;
  }

  function updateLook(ship, look, inp, dt) {
    const k = 1 - Math.exp(-dt * 10), kr = 1 - Math.exp(-dt * 6);
    const v = speedOf(ship);
    look.brakeL += ((inp.brakeL ? 1 : 0) - look.brakeL) * k;
    look.brakeR += ((inp.brakeR ? 1 : 0) - look.brakeR) * k;
    look.boost *= Math.exp(-dt * 1.4);
    look.shieldKick *= Math.exp(-dt * 4);
    const lean = THREE.MathUtils.clamp(ship.r * 0.45 + (look.brakeR - look.brakeL) * 0.22, -0.75, 0.75);
    const pitch = THREE.MathUtils.clamp(ship.vh * 0.03, -0.2, 0.2) + (look.brakeL + look.brakeR) * 0.035 + look.boost * 0.04;
    look.lean += (lean - look.lean) * kr;
    look.pitch += (pitch - look.pitch) * kr;
    look.thrust = ship.throttle;
    look.zap = Math.max(ship.mineDrag / ITEM.mineDrag, ship.thrustCut / ITEM.boltCut, 0);
    look.shield = Math.max(ship.shield / ITEM.shield, look.shieldKick);
    look.plume = ship.throttle * (0.9 + 1.6 * Math.min(1, v / SHIP.vmax)) + look.boost * 1.4;
    look.hover = ship.h;
  }

  // Contact on the energy barrier: U.hits holds (s, side, time, strength) per ship for the wall
  // shader; a scrape keeps renewing it.
  function touchWall(ship, side, strength) {
    const h = U.hits.array[ship.id];
    const fresh = game.time - h.z > 0.3;
    h.set(ship.s, side, game.time, fresh ? strength : Math.max(strength, h.w * 0.98));
  }

  const team = COLORS.map((c) => [c.r, c.g, c.b]);
  const nozzle = new THREE.Vector3();
  function drawShips(dt) {
    game.ships.forEach((ship, i) => {
      const look = looks[i];
      updateLook(ship, look, inputs[i], dt);
      const pz = poses[i];
      const m = poseShip(ship, pz, look);
      // A rival's glow and shield bubble dim within 7 m of the camera (its hull dithers away).
      look.near = i === PLAYER ? 1 : THREE.MathUtils.smoothstep(camera.position.distanceTo(pz.p), 3, 7);
      shipMeshes.setShip(i, m, look, pz.ground);
      // A thin, faint ribbon from the centre nozzle: the plume does the heavy lifting.
      const v = speedOf(ship);
      if (ship.throttle > 0.05 && v > 5 && dt > 0) {
        const k = 0.12 * ship.throttle + 0.2 * look.boost;
        nozzle.set(NOZZLES[0][0], NOZZLES[0][1], TAIL + 0.3).applyMatrix4(m);
        effects.spawn({ pos: nozzle.toArray(), color: team[i].map((x) => x * k), life: 0.1 + 0.12 * Math.min(1, v / SHIP.vmax), size: 0.07, axis: pz.fwd.toArray(), len: v * dt * 1.6 });
      }
      if (ship.scraping && v > 15) {
        const side = Math.sign(ship.d);
        touchWall(ship, side, 0.5);
        const f = frameVectors(ship.s, ship.d + side * 2, 0.5);
        effects.burst(f.p.toArray(), pz.vel.clone().multiplyScalar(0.9).toArray(), { n: 4, speed: 12, color: [7, 3.4, 1.1], life: 0.4, size: 0.05, stretch: 0.03, drag: 0.8 });
        // The scrape trail: a hot line left on the barrier foot.
        effects.spawn({ pos: f.p.toArray(), color: [2.4, 0.9, 0.25], life: 0.6, size: 0.25, axis: pz.fwd.toArray(), len: v * dt * 2 });
      }
    });
    shipMeshes.commit();
  }

  // Item pads go dark after a pickup and light up again over the cool-down.
  const padTint = new THREE.Color(), dimmed = new Set();
  function drawPads() {
    const cool = game.items.padCool, pads = trackMesh.pads;
    let dirty = false;
    for (const pad of dimmed) {
      if (cool.has(pad)) continue;
      pads.setColorAt(trackMesh.padIndex.get(pad), padTint.setScalar(1));
      dimmed.delete(pad);
      dirty = true;
    }
    for (const [pad, t] of cool) {
      pads.setColorAt(trackMesh.padIndex.get(pad), padTint.setScalar(0.08 + 0.4 * (1 - t / ITEM.padCooldown) ** 4));
      dimmed.add(pad);
      dirty = true;
    }
    if (dirty) pads.instanceColor.needsUpdate = true;
  }

  // Start lights: red, red, amber, then green for 1.5 s.
  const lampColor = new THREE.Color();
  let lampHex = -1;
  function setLamp(hex) {
    if (hex === lampHex) return;
    lampHex = hex;
    trackMesh.lamp.setColorAt(0, lampColor.setHex(hex).multiplyScalar(hex ? 3 : 1));
    trackMesh.lamp.instanceColor.needsUpdate = true;
  }

  const boltColor = new THREE.Color(3, 1.3, 0.35), mineColor = new THREE.Color();
  function drawItems() {
    const { bolts, mines } = game.items;
    bolts.slice(0, effects.bolts.capacity).forEach((b, i) => {
      const f = frameVectors(b.s, b.d, b.h + 0.4);
      mat.makeBasis(f.N, f.U, tmp.copy(f.T).negate()).setPosition(f.p);
      effects.bolts.set(i, mat, boltColor);
      // A tracer: the streak the bolt leaves stays on screen after the bolt has gone.
      effects.spawn({ pos: f.p.toArray(), color: [2.4, 1, 0.3], life: 0.3, size: 0.22, axis: f.T.toArray(), len: 8 });
    });
    effects.bolts.finish(Math.min(bolts.length, effects.bolts.capacity));
    mines.slice(0, effects.mines.capacity).forEach((m, i) => {
      const f = frameVectors(m.s, m.d, 0.9 + 0.15 * Math.sin(game.time * 4 + i));
      const pulse = 0.85 + 0.15 * Math.sin(game.time * 9 + i);
      const spin = game.time * 2 + i;
      right.copy(f.N).multiplyScalar(Math.cos(spin)).addScaledVector(f.T, Math.sin(spin));
      fwd.crossVectors(right, f.U);
      mat.makeBasis(right.multiplyScalar(pulse), tmp.copy(f.U).multiplyScalar(pulse), fwd.multiplyScalar(pulse)).setPosition(f.p);
      const armed = m.age > 1.2 ? 1 : 0.4;
      effects.mines.set(i, mat, mineColor.setRGB(1.3, 0.35, 2.4).multiplyScalar(armed * pulse));
    });
    effects.mines.finish(Math.min(mines.length, effects.mines.capacity));
  }

  // ---------- events: sound, sparks, story, shake ----------
  const where = (ship) => ({ along: gapS(track, player().s, ship.s), side: ship.d - player().d, mine: ship === player() });
  const mid = new THREE.Vector3();
  function handleEvents() {
    const me = player();
    for (const e of game.events) {
      audio.event(e, where);
      const mine = e.ship === me;
      const at = e.ship ? poses[e.ship.id] : null;
      switch (e.type) {
        case 'wall': {
          // Sparks at the contact, a flash on the barrier, shake and a chromatic kick by speed.
          const f = frameVectors(e.ship.s, e.ship.d + e.side * 2, 0.6);
          const k = Math.min(1, e.strength / 20);
          touchWall(e.ship, e.side, 0.5 + 1.5 * k);
          // Sparks keep most of the ship's speed, so they trail behind the contact on screen
          // instead of flashing past the camera in two frames.
          const carry = at.vel.clone().multiplyScalar(0.92).toArray();
          effects.burst(f.p.toArray(), carry, { n: 24 + Math.round(40 * k), speed: 10 + 18 * k, color: [7, 3.4, 1.1], size: 0.05, life: 0.55, stretch: 0.03, drag: 0.8 });
          effects.spawn({ pos: f.p.toArray(), vel: at.vel.toArray(), color: [3, 2.2, 1.4], life: 0.12, size: 1.5 + 2.5 * k });
          effects.ring({ pos: f.p.toArray(), vel: at.vel.toArray(), a: f.U.toArray(), b: f.T.toArray(), r0: 0.4, r1: 2 + 5 * k, life: 0.35, color: [0.8, 1.6, 2.4] });
          if (mine) { game.shake += 0.08 + 0.6 * k; post.chroma.value = Math.min(1, post.chroma.value + 0.2 + 0.8 * k); }
          break;
        }
        case 'bump': {
          // Metal sparks where the hulls meet and a camera jolt, no flash; the push is in the physics.
          mid.copy(at.p).add(poses[e.other.id].p).multiplyScalar(0.5);
          const k = Math.min(1, e.strength / 15);
          effects.burst(mid.toArray(), at.vel.toArray(), { n: 16 + Math.round(28 * k), speed: 10 + 12 * k, color: [6, 4, 2], size: 0.05, life: 0.45, stretch: 0.03, drag: 0.8 });
          if (mine || e.other === me) game.shake += 0.15 + 0.35 * k;
          break;
        }
        case 'hit':
          if (e.item === 'bolt') {
            // Explosion: fireball, shockwave ring, debris, and a white flash for the player.
            effects.burst(at.p.toArray(), at.vel.toArray(), { n: 40, speed: 24, color: [3.4, 1.4, 0.35], size: 0.7, life: 0.9, stretch: 0.01, drag: 1.2 });
            effects.ring({ pos: at.p.toArray(), vel: at.vel.toArray(), r0: 1, r1: 20, life: 0.6, color: [3.4, 1.8, 0.7] });
            effects.shards(at.p.toArray(), at.vel.clone().multiplyScalar(0.9).toArray(), { n: 18, speed: 16 });
            effects.spawn({ pos: at.p.toArray(), vel: at.vel.toArray(), color: [4, 3, 2.2], life: 0.35, size: 12 });
            effects.spawn({ pos: at.p.toArray(), vel: at.vel.toArray(), color: [2.4, 0.9, 0.25], life: 0.7, size: 6 });
            if (mine) { game.shake += 0.8; post.flash.value = 1; post.chroma.value = 1; }
          } else {
            // Magnetic mine: an EMP ring flat on the deck; the hull crackles while it holds (zap).
            const f = frameVectors(e.ship.s, e.ship.d, 0.3);
            effects.ring({ pos: f.p.toArray(), vel: at.vel.toArray(), a: f.N.toArray(), b: f.T.toArray(), r0: 1, r1: 14, life: 0.6, color: [1.2, 0.5, 3] });
            effects.ring({ pos: f.p.toArray(), vel: at.vel.toArray(), a: f.N.toArray(), b: f.T.toArray(), r0: 0.5, r1: 7, life: 0.9, color: [0.8, 0.8, 2.4] });
            effects.burst(at.p.toArray(), at.vel.toArray(), { n: 30, speed: 12, color: [1.4, 0.4, 2.6], size: 0.6, life: 0.8, stretch: 0.01, drag: 1 });
            if (mine) { game.shake += 0.5; post.flash.value = 0.5; post.chroma.value = 0.7; }
          }
          break;
        case 'off':
          if (mine) game.shake += 0.3;
          break;
        case 'respawn': {
          // Put back on the deck (the pose is still out where it flew): a ring on the deck, and the
          // camera cuts back behind the ship with a white flash.
          const f = frameVectors(e.ship.s, 0, 0.3);
          effects.ring({ pos: f.p.toArray(), vel: f.T.clone().multiplyScalar(e.ship.vx).toArray(), a: f.N.toArray(), b: f.T.toArray(), r0: 1, r1: 8, life: 0.5, color: [0.8, 1.6, 2.4] });
          if (mine) { chase.ready = false; post.flash.value = 0.6; }
          break;
        }
        case 'shieldHit':
          // The hex bubble flares and throws sparks off its surface.
          looks[e.ship.id].shieldKick = 1;
          effects.burst(at.p.toArray(), at.vel.toArray(), { n: 30, speed: 10, color: [0.6, 1.6, 2.6], size: 0.6, life: 0.5, stretch: 0, drag: 1 });
          effects.ring({ pos: at.p.toArray(), vel: at.vel.toArray(), r0: 2.5, r1: 7, life: 0.35, color: [0.6, 1.5, 2.6] });
          if (mine) game.shake += 0.25;
          break;
        case 'mineEnd':
          if (e.result === 'expired') {
            // An old mine fizzles out: a small ring and a few sparks where it lay.
            const f = frameVectors(e.mine.s, e.mine.d, 0.9);
            effects.ring({ pos: f.p.toArray(), a: f.N.toArray(), b: f.T.toArray(), r0: 0.3, r1: 3.5, life: 0.5, color: [1, 0.35, 2] });
            effects.burst(f.p.toArray(), [0, 0, 0], { n: 10, speed: 4, color: [1.2, 0.4, 2.2], size: 0.25, life: 0.5, stretch: 0 });
          }
          break;
        case 'pad':
          looks[e.ship.id].boost = 1;
          effects.burst(at.p.toArray(), at.vel.clone().multiplyScalar(0.8).toArray(), { n: 14, speed: 6, color: [3, 1.6, 0.5], size: 0.3, life: 0.4, stretch: 0.05 });
          if (mine) game.kick = 1;
          break;
        case 'land':
          if (mine) game.shake += Math.min(0.4, e.strength * 0.02);
          break;
        case 'use':
          if (e.item === 'bolt') effects.spawn({ pos: at.p.toArray(), vel: at.vel.toArray(), color: [3, 1.4, 0.4], life: 0.12, size: 3 });
          break;
        case 'boltEnd':
          if (e.bolt.owner === me && e.result === 'hit') game.story = { type: 'shot', result: 'hit', age: 0 };
          break;
        case 'finish':
          if (mine) game.finishAt = game.time + 1.6;
          break;
        default:
      }
      if (mine && STORY_EVENTS.has(e.type)) game.story = { type: e.type, item: e.item, result: e.result, age: 0 };
    }
    game.events.length = 0;
  }

  // ---------- camera ----------
  const chase = { offset: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), look: new THREE.Vector3(), ready: false };
  const chasePos = new THREE.Vector3(), chaseQuat = new THREE.Quaternion(), fromPos = new THREE.Vector3(), fromQuat = new THREE.Quaternion();
  const focusDir = new THREE.Vector3();
  const look = new THREE.Matrix4();

  // The chase camera sits behind and above the ship in the ship's own up (so it rolls through the
  // loop); offset and up are smoothed, the position is not, so there is no lag at 500 km/h.
  function updateChase(dt, snap = false) {
    const me = player(), pz = poses[PLAYER];
    const v = speedOf(me);
    const velDir = tmp.copy(pz.vel).normalize();
    const dir = fwd.copy(pz.fwd).lerp(v > 5 ? velDir : pz.fwd, 0.5).normalize();
    const want = new THREE.Vector3().copy(dir).multiplyScalar(-(CAMERA.back + v * 0.008)).addScaledVector(pz.up, CAMERA.up);
    const k = snap ? 1 : 1 - Math.exp(-dt * 8);
    chase.offset.lerp(want, k);
    chase.up.lerp(pz.up, snap ? 1 : 1 - Math.exp(-dt * 5)).normalize();
    chase.look.lerp(dir, k);
    chasePos.copy(pz.p).add(chase.offset);
    if (!(me.off > 0)) keepInsideTrack(chasePos, me);   // flying off: the camera follows it out
    // The look point sits low on the deck ahead: the view leans forward.
    const target = right.copy(pz.p).addScaledVector(chase.look, CAMERA.look).addScaledVector(chase.up, 0.1);
    look.lookAt(chasePos, target, chase.up);
    chaseQuat.setFromRotationMatrix(look);
  }

  // The camera never leaves the track's box: between the walls and above the deck, so nothing
  // trackside can pass through it in a tight bend.
  const offTrack = new THREE.Vector3();
  function keepInsideTrack(p, me) {
    let f = frameVectors(me.s, 0, 0);
    f = frameVectors(me.s + offTrack.subVectors(p, f.p).dot(f.T), 0, 0);
    offTrack.subVectors(p, f.p);
    const d = offTrack.dot(f.N), h = offTrack.dot(f.U);
    // Well clear of the barrier: at 1 m its chevrons fill a third of the frame on a wall hit.
    const limit = track.halfWidth - 2.6;
    p.addScaledVector(f.N, THREE.MathUtils.clamp(d, -limit, limit) - d).addScaledVector(f.U, Math.max(h, 0.6) - h);
  }

  // Showroom: orbit around the player's ship on the grid, pan kept close to it.
  function enterShowroom() {
    const pz = poses[PLAYER];
    poseShip(player(), pz);
    camera.up.set(0, 1, 0);
    controls.target.copy(pz.p);
    camera.position.copy(pz.p).addScaledVector(pz.fwd, 9).addScaledVector(V.N, 7).addScaledVector(pz.up, 3);
    camera.fov = CAMERA.fov;
    camera.updateProjectionMatrix();
    controls.enabled = true;
    controls.update();
    input.setEnabled(false);
    setLamp(0);
  }
  const panShift = new THREE.Vector3();
  function keepNearShip(center) {
    panShift.copy(controls.target);
    const off = tmp.copy(controls.target).sub(center);
    if (off.length() > 8) off.setLength(8);
    controls.target.copy(center).add(off);
    camera.position.add(panShift.subVectors(controls.target, panShift));
  }

  function updateCamera(dt) {
    const me = player();
    if (game.phase === 'grid') {
      controls.update();
      keepNearShip(poses[PLAYER].p);
      return;
    }
    updateChase(dt, !chase.ready);
    chase.ready = true;
    if (game.blend < 1) {
      if (game.blend === 0) { fromPos.copy(camera.position); fromQuat.copy(camera.quaternion); }
      game.blend = Math.min(1, game.blend + dt / 1.4);
      const e = game.blend < 0.5 ? 4 * game.blend ** 3 : 1 - (-2 * game.blend + 2) ** 3 / 2;
      camera.position.lerpVectors(fromPos, chasePos, e);
      camera.quaternion.slerpQuaternions(fromQuat, chaseQuat, e);
    } else {
      camera.position.copy(chasePos);
      camera.quaternion.copy(chaseQuat);
    }
    // Shake from impacts, a fine vibration at top speed (more on a pad), the field of view
    // opening with speed and punching on every pad.
    const v = speedOf(me), top = Math.min(1, v / SHIP.vmax);
    const boost = looks[PLAYER].boost;
    game.shake *= Math.exp(-dt * 6);
    game.kick *= Math.exp(-dt * 1.8);
    const buzz = 0.03 * top ** 3 + 0.06 * boost;
    const t = game.time;
    camera.position.addScaledVector(chase.up, buzz * (Math.sin(t * 73) + Math.sin(t * 131) * 0.5));
    camera.position.addScaledVector(right.crossVectors(chase.look, chase.up).normalize(), buzz * Math.sin(t * 89 + 1.3));
    if (game.shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * game.shake;
      camera.position.y += (Math.random() - 0.5) * game.shake;
      camera.position.z += (Math.random() - 0.5) * game.shake;
    }
    camera.fov = CAMERA.fov + (CAMERA.fovTop - CAMERA.fov) * top ** 1.4 + 20 * game.kick;
    camera.updateProjectionMatrix();
    post.speed.value = Math.max(0, (v - 40) / 90) + 0.6 * game.kick;
    post.chroma.value *= Math.exp(-dt * 7);
    // The blur's vanishing point: the velocity direction projected on screen, eased so a hit
    // does not jerk it, and held on screen when the ship slides sideways. At rest there is no
    // direction (and projecting the camera's own position gives NaN): keep the last one.
    const vel = poses[PLAYER].vel;
    if (vel.lengthSq() > 1) {
      focusDir.copy(vel).normalize().add(camera.position).project(camera);
      if (focusDir.z < 1 && Number.isFinite(focusDir.x) && Number.isFinite(focusDir.y)) {
        const k = 1 - Math.exp(-dt * 8), f = post.focus.value;
        f.x += (THREE.MathUtils.clamp(focusDir.x * 0.5 + 0.5, 0.15, 0.85) - f.x) * k;
        f.y += (THREE.MathUtils.clamp(focusDir.y * 0.5 + 0.5, 0.15, 0.85) - f.y) * k;
      }
    }

  }

  // ---------- review harness ----------
  // For the orchestrator's review loop: jump to a set piece at racing speed, hand out an item,
  // fire it, throw the player at a wall. No UI.
  const zoneStart = (tag) => track.zones.find((z) => z.tag === tag).s0;
  const tunnel = track.zones.find((z) => z.tag === 'tunnel');
  const JUMPS = {
    start: track.startS + 50, sweeper: zoneStart('sweeper'), drop: zoneStart('drop'), hairpin: zoneStart('hairpin'),
    twist: zoneStart('twist') - 60, crest: zoneStart('crest'), loop: zoneStart('loop'), esses: zoneStart('esses'), tunnel: tunnel.s0 - 150,
    station: (tunnel.s0 + tunnel.s1) / 2, finish: track.startS - 250,
  };
  function createReview() {
    const racing = () => {
      if (!game.race || game.phase !== 'race') startRace();
      if (game.race.phase === 'countdown') { game.race.phase = 'race'; game.race.count = 0; }
    };
    return {
      sectionNames: () => Object.keys(JUMPS),
      // The player at the set piece at 110 m/s, the three others around it. A jump moves each
      // ship's race distance by the same signed gap, so positions stay honest; a jump across the
      // start line can count a short lap.
      jump(name) {
        if (!(name in JUMPS)) throw new Error(`unknown section "${name}": ${Object.keys(JUMPS).join(', ')}`);
        racing();
        const ahead = [0, 22, 48, -26], lane = [0, -4, 4, 3];
        game.ships.forEach((ship, i) => {
          const s = wrapS(track, JUMPS[name] + ahead[i]);
          ship.dist += gapS(track, ship.s, s);
          Object.assign(ship, { s, d: lane[i], h: SHIP.h0, vx: 110, vy: 0, vh: 0, psi: 0, r: 0, air: false, scraping: false, off: 0 });
        });
        chase.ready = false;
        game.blend = 1;
        return name;
      },
      give(item) {
        if (!ITEMS.includes(item)) throw new Error(`unknown item "${item}": ${ITEMS.join(', ')}`);
        racing();
        player().item = item;
        game.events.push({ type: 'item', ship: player(), item });
        return item;
      },
      fire() {
        const me = player();
        if (!me.item || !game.race || !canDrive(game.race)) return false;
        useItem(game.items, me, game.ships, track, game.events);
        return true;
      },
      // Puts the player just inside the wall on `side` ('left' | 'right' or -1 | 1), moving into it.
      hitWall(side = 'right') {
        racing();
        const k = side === 'left' || side === -1 ? -1 : 1, me = player();
        Object.assign(me, { d: k * (track.halfWidth - SHIP.halfW - 0.05), vy: k * 25, psi: k * 0.2 });
        return k;
      },
      // Puts ship 1 beside the player, closing sideways at 14 m/s: a side bump in a few frames.
      bump() {
        racing();
        const me = player(), o = game.ships[1];
        Object.assign(o, { s: me.s, dist: me.dist, d: me.d + 4.3, vx: me.vx, vy: -7, psi: 0, r: 0, off: 0, bump: 0 });
        me.vy = 7; me.bump = 0;
        return 1;
      },
      // Throws the player 8 m up next to the wall on `side`, drifting out: it flies off the track.
      launch(side = 'right') {
        const k = this.hitWall(side), me = player();
        Object.assign(me, { h: 8, vh: 4, vy: k * 22 });
        return k;
      },
    };
  }

  // ---------- framing ----------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  let running = false;
  window.addEventListener('resize', () => { resize(); if (!running) post.render(); });
  resize();

  // ---------- warm-up: both views, every pass, while the loader is still opaque ----------
  drawShips(0);
  enterShowroom();
  await warmUp(renderer, [
    ['Framing the grid', () => post.render()],
    ['Warming up the chase camera', () => {
      updateChase(0, true);
      camera.position.copy(chasePos);
      camera.quaternion.copy(chaseQuat);
      post.render();
    }],
  ]);
  enterShowroom();

  // frameMsP95: the 95th percentile of the frame time over the last 5 s (300 frames at 60 fps).
  const perf = { frames: 0, since: performance.now(), fps: 0, frameMsP95: 0, ms: new Float32Array(300), at: 0 };
  const p95 = () => {
    const sorted = [...perf.ms].filter((x) => x > 0).sort((a, b) => a - b);
    return sorted.length ? Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10 : 0;
  };
  window.__antigrav = { backend, perf, game, track, renderer, camera, review: createReview() };
  const clock = new THREE.Timer();
  let introDone = false, introT = 0;

  function frame() {
    clock.update();
    const raw = clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    perf.ms[perf.at] = raw * 1000;
    perf.at = (perf.at + 1) % perf.ms.length;
    game.time += dt;
    U.time.value = game.time;

    // Input and the fixed-step simulation.
    const inp = input.update(dt);
    const race = game.race;
    const driving = race && canDrive(race) && race.phase !== 'finished';
    Object.assign(playerInput, driving ? inp : NO_INPUT);
    if (input.consumeFire() && driving && player().item) useItem(game.items, player(), game.ships, track, game.events);
    game.acc = Math.min((game.acc || 0) + dt, DT * 12);
    while (game.acc >= DT) { simStep(DT); game.acc -= DT; }

    // Start lights.
    if (race) {
      setLamp(race.phase === 'countdown' ? (race.count >= 2 && race.count <= 3 ? 0xff2a1a : race.count === 1 ? 0xffb020 : 0) : race.t < 1.5 ? 0x2cff6a : 0);
    }

    drawShips(dt);
    drawItems();
    drawPads();
    handleEvents();
    updateCamera(dt);
    space.update(dt, camera, effects.spawn);
    effects.update(dt, camera);
    post.flash.value *= Math.exp(-dt * 8);

    // The sun and its shadow follow the player.
    const pp = poses[PLAYER].p;
    sun.target.position.copy(pp);
    sun.position.copy(pp).addScaledVector(SUN, 100);

    // Sound.
    const me = player();
    audio.update(
      { speed: speedOf(me), throttle: me.throttle, brakes: (inputs[PLAYER].brakeL ? 1 : 0) + (inputs[PLAYER].brakeR ? 1 : 0), scraping: me.scraping, dragged: me.mineDrag > 0, boost: looks[PLAYER].boost },
      game.ships.filter((s) => s !== me).map((o) => {
        const along = gapS(track, me.s, o.s);
        return { along, side: o.d - me.d, closing: Math.sign(along) * (me.vx - o.vx) };
      }),
    );

    // Page.
    if (game.story) game.story.age += dt;
    const entry = race ? race.entries[PLAYER] : null;
    const zone = track.zones.find((z) => me.s >= z.s0 && me.s <= z.s1);
    ui.tiles({
      speed: speedOf(me), lap: entry ? Math.min(entry.laps + 1, race.laps) : 1, laps: LAPS,
      place: entry ? entry.place : 4, ships: 4, time: entry ? (entry.finish ?? race.t) : 0, item: me.item,
    });
    ui.sentence(sentence({
      phase: race ? race.phase : 'grid', count: race ? race.count : 0, zone: zone ? zone.tag : null, air: me.air,
      item: me.item, shield: me.shield, event: game.story, place: entry ? entry.place : 4, ships: 4,
      lap: entry ? entry.laps + 1 : 1, laps: LAPS, brake: playerInput.brakeL + playerInput.brakeR > 0, speed: speedOf(me),
    }));
    if (game.finishAt && game.time >= game.finishAt) {
      game.finishAt = 0;
      game.phase = 'done';
      input.setEnabled(false);
      ui.setPhase('done');
      ui.finish([...race.entries].sort((a, b) => a.place - b.place), me);
    }

    if (!introDone) {
      // The roll-out: the camera swings round the player's ship once the drawing has faded.
      introT += dt;
      if (introT > 0.9) {
        introDone = true;
        loader.ready();
        document.body.classList.remove('loading');
        console.log('antigrav', { backend, setupMs: Math.round(performance.now() - t0), programs: renderer.info.memory.programs });
      }
    }

    post.render();

    perf.frames += 1;
    const now = performance.now();
    if (now - perf.since > 1000) {
      perf.fps = Math.round((perf.frames * 1000) / (now - perf.since));
      perf.frames = 0;
      perf.since = now;
      const info = renderer.info;
      Object.assign(perf, { drawCalls: info.render.drawCalls, triangles: info.render.triangles, programs: info.memory.programs, frameMsP95: p95() });
      ui.perf(`${backend} · ${perf.fps} fps · p95 ${perf.frameMsP95} ms · ${perf.drawCalls} draws · ${Math.round(perf.triangles / 1000)}k tris · ${perf.programs} programs`);
    }
  }

  // Pause when hidden or held in portrait on a phone: no rendering, no simulation, no dt jump.
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  function update() {
    document.body.classList.toggle('portrait', portrait.matches);
    const run = !document.hidden && !portrait.matches;
    audio.setHidden(!run);
    if (run === running) return;
    running = run;
    if (run) {
      clock.reset();
      perf.since = performance.now();
      perf.frames = 0;
      perf.ms.fill(0);
      renderer.setAnimationLoop(frame);
    } else {
      renderer.setAnimationLoop(null);
    }
  }
  document.addEventListener('visibilitychange', update);
  portrait.addEventListener('change', update);

  loader.step('Taking the grid');
  frame();
  document.body.classList.add('scene-ready');
  loader.handoff();
  ui.setPhase('grid');
  update();
  if (AUTOPILOT) startRace();
}
