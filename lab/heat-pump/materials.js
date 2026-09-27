/**
 * Every material of the diorama. Each one has two faces: the photo (PBR with
 * procedural detail) and the thermal camera (the surface temperature on an
 * ironbow scale). One uniform fades between them for the whole scene.
 */
import * as THREE from 'three/webgpu';
import {
  abs, clamp, color, cos, exp, float, floor, fract, hash, max, mix, mx_noise_float, mx_worley_noise_float, normalWorld,
  mrt, positionWorld, positionLocal, saturate, sin, smoothstep, step, time, uniform, uv, vec3, vec4,
} from 'three/tsl';
import { WALL_LAYERS, WALL_INNER, BACK_INNER } from './layout.js';
import { SOIL } from './thermal.js';

/** Live values the shaders read. main.js writes them from physics.js and thermal.js. */
export const U = {
  thermal: uniform(0),
  lo: uniform(-10),
  hi: uniform(45),
  outside: uniform(-7),
  inside: uniform(20),
  flow: uniform(35),
  ret: uniform(30),
  floor: uniform(24),
  ripple: uniform(1),
  window: uniform(17),
  // The cycle: evaporating, condensing, compressor outlet and inlet, whichever exchanger does what.
  evaporating: uniform(-15),
  condensing: uniform(40),
  discharge: uniform(62),
  suction: uniform(-10),
  // The two exchangers: the coil outside and the plate inside. They swap roles with the season.
  coil: uniform(-15),
  plate: uniform(40),
  wall: WALL_LAYERS.concat({}).map(() => uniform(0)),
  snow: uniform(1),
  frost: uniform(0.5),
  plume: uniform(0),
  waterSpeed: uniform(0.3),
  power: uniform(0.5),
  air: uniform(1),
  fanWarm: uniform(0), // 0 the fan blows cold air out (winter), 1 warm air (summer)
  ports: uniform(0), // glow of the four-way valve ports while the changeover shows them
  cut: uniform(0), // 0 closed … 1 the four-way valve body cut open
};

const P = positionWorld;

/**
 * Per-material values are uniforms, never literals. Three.js caches shader
 * programs by their source, so materials of one family (same graph, other
 * values) share one program and compile once. About 20 programs instead of 70.
 */
const num = (v) => (typeof v === 'number' ? uniform(v) : v);
const hex = (v) => (typeof v === 'number' || typeof v === 'string' ? uniform(new THREE.Color(v)) : v);
const noise = (scale, p = P) => mx_noise_float(p.mul(num(scale)));
const cells = (scale, p = P) => mx_worley_noise_float(p.mul(num(scale)));

/** Unlit and additive materials: keep them out of the bloom input. */
export const noGlow = () => mrt({ emissive: vec4(0, 0, 0, 1) });

/** The ironbow palette of thermal cameras: indigo, purple, red, orange, yellow, white. */
export const IRONBOW = ['#0b0726', '#4b1a88', '#b52c6d', '#ee6a24', '#fbc93f', '#fff8dc'];
const STOPS = [0, 0.22, 0.46, 0.68, 0.87, 1];
export function heat(celsius) {
  const t = saturate(celsius.sub(U.lo).div(U.hi.sub(U.lo)));
  let out = color(IRONBOW[0]);
  for (let i = 1; i < IRONBOW.length; i++) out = mix(out, color(IRONBOW[i]), smoothstep(STOPS[i - 1], STOPS[i], t));
  return out;
}

// ---------------------------------------------------------------- temperatures

/** Temperature inside the wall, from the depth below the inner face of either wall. */
const wallDepth = clamp(max(P.x.sub(WALL_INNER), float(BACK_INNER).sub(P.z)), 0, -WALL_INNER);
const wallTemperature = (() => {
  let t = U.wall[0];
  let depth = 0;
  WALL_LAYERS.forEach((layer, i) => {
    t = t.add(U.wall[i + 1].sub(U.wall[i]).mul(saturate(wallDepth.sub(depth).div(layer.thickness))));
    depth += layer.thickness;
  });
  return t;
})();

/** Soil: the air reaches down with exponential damping outside; under the house the slab keeps it mild. */
const depthBelowGrade = P.y.negate().max(0);
const outsideGround = float(SOIL.deep).add(U.outside.sub(SOIL.deep).mul(exp(depthBelowGrade.div(-SOIL.damping))));
const houseGround = mix(U.inside.sub(3), float(SOIL.deep), saturate(depthBelowGrade.div(1.3)));
const groundTemperature = mix(houseGround, outsideGround, smoothstep(WALL_INNER, 0, P.x));

/** Floor surface, warmer over each loop of the serpentine in floor mode. */
const floorTemperature = U.floor.add(U.floor.sub(U.inside).mul(0.15).mul(U.ripple).mul(cos(P.z.add(0.12).mul(Math.PI * 2 / 0.15))));

/**
 * A surface temperature as a weighted sum of the live temperatures, so every
 * material shares one graph: `{ inside: 1, add: -0.4 }` is 0.4 K below the
 * room. `top` and `y` blend to a second sum from bottom to top.
 */
const TERMS = [
  [['inside', 'outside', 'flow', 'ret'], vec4(U.inside, U.outside, U.flow, U.ret)],
  [['evaporating', 'condensing', 'discharge', 'window'], vec4(U.evaporating, U.condensing, U.discharge, U.window)],
  [['ground', 'wall', 'floor', 'add'], vec4(groundTemperature, wallTemperature, floorTemperature, 1)],
  [['coil', 'plate', 'suction', 'unused'], vec4(U.coil, U.plate, U.suction, 0)],
];
const weighted = (spec) => TERMS.map(([keys, values]) => uniform(new THREE.Vector4(...keys.map((k) => spec[k] ?? 0))).dot(values)).reduce((a, b) => a.add(b));
function field({ top, y = [0, 1], ...bottom }) {
  return mix(weighted(bottom), weighted(top ?? bottom), smoothstep(num(y[0]), num(y[1]), P.y));
}

/**
 * The shadow pass builds its program from `colorNode.a`, so a procedural
 * colour would give every family its own shadow program although every
 * surface here is opaque. The colour lives in `baseNode` instead and is
 * `colorNode` only while the material itself is built: all shadows share one
 * program per side and alpha test.
 */
class Surface extends THREE.MeshPhysicalNodeMaterial {
  setupDiffuseColor(builder) {
    this.colorNode = this.baseNode;
    super.setupDiffuseColor(builder);
    this.colorNode = null;
  }
}

/**
 * A material that shows `base` in photo mode and its temperature in thermal
 * mode. `temperature` is a spec for field() or a node; `glow` is a real
 * emitter and the only input of the bloom.
 */
function surface({ base, roughness = 0.9, metalness = 0, clearcoat = 0, clearcoatRoughness = 0.3, temperature = { inside: 1 }, glow = 0x000000, ...options }) {
  const material = new Surface(options);
  const k = U.thermal;
  material.baseNode = mix(hex(base), vec3(0.012), k);
  material.roughnessNode = mix(num(roughness), float(1), k);
  material.metalnessNode = mix(num(metalness), float(0), k);
  material.clearcoatNode = mix(num(clearcoat), float(0), k);
  material.clearcoatRoughnessNode = num(clearcoatRoughness);
  material.emissiveNode = mix(hex(glow), heat(temperature.isNode ? temperature : field(temperature)).mul(0.95), k);
  return material;
}

// ---------------------------------------------------------------- families

const up = smoothstep(0.6, 0.9, normalWorld.y);
const facingZ = smoothstep(0.8, 0.95, abs(normalWorld.z));

/** Paint, plastic, metal: a tint with two octaves of grain. */
const grain = (tint, amp1 = 0, scale1 = 1, amp2 = 0, scale2 = 1) => hex(tint).mul(noise(scale1).mul(num(amp1)).add(noise(scale2).mul(num(amp2))).add(1));
const plain = (tint, options = {}, ...octaves) => surface({ base: grain(tint, ...octaves), ...options });

/** Ribs, fins and brushing: a sine along `wave` (a direction times a spatial frequency). */
const ribbed = (tint, wave, amp, options) => surface({ base: hex(tint).mul(sin(P.dot(uniform(new THREE.Vector3(...wave)))).mul(num(amp)).add(1)), ...options });

/** Foams: a tint with round cells of a second tint. */
const pitted = (tint, pit, scale, options) => surface({ base: mix(hex(tint), hex(pit), smoothstep(0.35, 0.1, cells(scale))), ...options });

function soilBase(tint, stoneTint, stoneScale, stoneSize) {
  const size = num(stoneSize);
  const stones = smoothstep(size, size.mul(0.4), cells(stoneScale));
  return mix(hex(tint).mul(noise(9).mul(0.12).add(1)), hex(stoneTint).mul(noise(60).mul(0.1).add(1)), stones);
}
const soil = (tint, stoneTint, stoneScale, stoneSize, roughness = 0.95) => surface({ base: soilBase(tint, stoneTint, stoneScale, stoneSize), roughness, temperature: { ground: 1 } });

function concreteBase(tint) {
  const stones = smoothstep(0.32, 0.12, cells(26));
  const mottle = noise(2.5).mul(0.06).add(noise(40).mul(0.03)).add(1);
  return mix(hex(tint), color(0x5f5c58), stones.mul(0.55)).mul(mottle);
}

/** Oak planks along x, 19 cm wide, with a hash tone per plank and stretched grain. */
function oakBase() {
  const row = floor(P.z.div(0.19));
  const tone = hash(row);
  const endJoint = fract(P.x.add(tone.mul(1.7)).div(1.3));
  const plank = floor(P.x.add(tone.mul(1.7)).div(1.3)).add(row.mul(17));
  const woodGrain = mx_noise_float(vec3(P.x.mul(1.6), P.z.mul(95), plank)).mul(0.5).add(0.5);
  const wood = mix(color(0x8a5a33), color(0xc39766), hash(plank).mul(0.55).add(woodGrain.mul(0.45)));
  const seam = max(step(fract(P.z.div(0.19)), 0.012), step(endJoint, 0.004)).mul(up);
  return mix(wood, color(0x3a2616), seam.mul(0.8));
}

/** Clay block: vertical voids on the section faces, a grid of voids on top, mortar beds every 25 cm. */
function blockBase() {
  const across = mix(P.z, P.x, facingZ);
  const bedLine = fract(P.y.add(0.05).div(0.25));
  const slots = step(0.24, fract(across.div(0.031))).mul(step(0.035, bedLine));
  const grid = step(0.24, fract(P.x.div(0.031))).mul(step(0.3, fract(P.z.div(0.025))));
  const voids = mix(slots, grid, up);
  const bed = step(bedLine, 0.035).mul(up.oneMinus());
  const clay = color(0xb4643f).mul(noise(30).mul(0.1).add(1));
  return mix(mix(clay, color(0x2a150d), voids.mul(0.85)), color(0xcfc6b5), bed);
}

/**
 * Lawn seen from above: fine blades, not blotches. Snow is a thin even layer;
 * as it thins, grass tips show through as a fine speckle.
 */
function lawnBase() {
  const blades = noise(90).mul(0.5).add(0.5);
  const grass = mix(color(0x2c4620), color(0x5a7a3a), blades).mul(noise(2).mul(0.05).add(1));
  const tips = noise(70, P.add(3.1)).mul(0.5).add(0.5);
  const cover = smoothstep(-0.06, 0.06, U.snow.mul(1.1).sub(tips));
  const snow = color(0xeef2f6).mul(noise(25).mul(0.025).add(0.975));
  return mix(grass, snow, cover);
}

/**
 * The colour of moving fluids in the photo view: blue below the room, pale
 * near it, orange when warm, red when hot. The thermal view uses heat().
 */
function ramp(celsius) {
  const cool = mix(color(0x2f7dff), color(0xd6e2ec), smoothstep(10, 24, celsius));
  return mix(mix(cool, color(0xff8a2a), smoothstep(24, 45, celsius)), color(0xff3b1f), smoothstep(45, 75, celsius));
}

/**
 * PEX pipe coloured by the water inside: blue when it cools the floor, orange
 * when it heats it, so the summer cross-over shows on every loop. A travelling
 * band shows which way the water runs. Temperature runs flow → return by `a + b·uv.x`.
 */
function pipe(a, b, pulse) {
  const band = smoothstep(0.75, 1, sin(uv().x.mul(160).sub(time.mul(U.waterSpeed).mul(30))).mul(0.5).add(0.5)).mul(num(pulse));
  const temperature = mix(U.flow, U.ret, saturate(num(a).add(uv().x.mul(num(b)))));
  return surface({
    base: mix(color(0x3f7fd0), color(0xe0703a), smoothstep(19, 31, temperature)).mul(noise(200).mul(0.04).add(1)),
    roughness: 0.38,
    clearcoat: 0.5,
    temperature,
    glow: ramp(temperature).mul(band.mul(0.35)),
  });
}

/**
 * A refrigerant run: copper with the refrigerant drawn as points of light that
 * move with the flow. Liquid is a dense crowd of small points, vapour a few
 * sparse ones; the colour follows the temperature. main.js writes `live`:
 * temperature °C, gas 0 liquid … 1 vapour, travel (metres moved along the
 * drawing direction) and shown 0 … 1.
 */
export function refrigerantRun(length) {
  const live = { temperature: uniform(20), gas: uniform(1), travel: uniform(0), shown: uniform(1) };
  const along = uv().x.mul(num(length)).sub(live.travel);
  const points = (spacing, around) => {
    const cell = along.div(spacing);
    const turn = fract(uv().y.mul(around).add(hash(floor(cell))));
    return smoothstep(0.25, 0.12, abs(fract(cell).sub(0.5))).mul(smoothstep(0.25, 0.12, abs(turn.sub(0.5))));
  };
  const crowd = mix(points(0.012, 6), points(0.045, 2), live.gas);
  const material = surface({
    base: hex(0xc47a4f).mul(noise(300).mul(0.06).add(1)),
    roughness: 0.3,
    metalness: 1,
    temperature: live.temperature,
    glow: ramp(live.temperature).mul(crowd.mul(live.shown).mul(0.9)),
  });
  return { material, live };
}

/** A port stub of the four-way valve: brass that lights up in the colour of the gas through it while the changeover shows the ports. */
export const valvePort = (temperature) => surface({ base: 0xc8a25a, roughness: 0.3, metalness: 1, temperature, glow: ramp(temperature).mul(U.ports) });

/** Corrugated duct; `pulse` 1 sends yellow current pulses along it. */
const duct = (pulse) => surface({
  base: hex(0x5a5f66).mul(sin(uv().x.mul(1200)).mul(0.1).add(1)),
  roughness: 0.6,
  temperature: { ground: 1 },
  glow: color(0xffd24a).mul(smoothstep(0.9, 1, sin(uv().x.mul(90).sub(time.mul(5))).mul(0.5).add(0.5)).mul(U.power).mul(num(pulse))),
});

// ---------------------------------------------------------------- the catalogue

export function createMaterials() {
  const room = { inside: 1, add: -0.4 };
  const double = { side: THREE.DoubleSide };
  const m = {
    // Ground and foundation
    base: plain(0x10141b, { roughness: 0.55, clearcoat: 0.6 }, 0.05, 8),
    topsoil: surface({
      base: mix(soilBase(0x3b2a1d, 0x5a4938, 55, 0.2), lawnBase(), up.mul(step(-0.02, P.y))),
      roughness: 0.95,
      temperature: { ground: 1 },
    }),
    subsoil: soil(0x6b5139, 0x9a8b77, 22, 0.22),
    sand: plain(0xc9b388, { roughness: 0.97, temperature: { ground: 1 } }, 0.08, 140, 0.05, 12),
    backfill: soil(0x5a4431, 0x8f8578, 30, 0.2),
    fill: soil(0x6e5a45, 0x8d8272, 28, 0.2),
    gravel: soil(0x4a4640, 0x9c968c, 34, 0.42, 0.9),
    concrete: surface({ base: concreteBase(0x8e8b85), roughness: 0.88, temperature: { ground: 1 } }),
    xps: plain(0x86b6de, { roughness: 0.8, temperature: { ground: 1 } }, 0.05, 70),
    // Floor build-up
    tacker: surface({
      base: mix(
        color(0xd9dbdc).mul(noise(90).mul(0.04).add(1)),
        mix(color(0xb9c0c6), color(0x3d6fb0), max(step(fract(P.x.div(0.05)), 0.03), step(fract(P.z.div(0.05)), 0.03)).mul(0.7)),
        up,
      ),
      roughness: mix(float(0.9), float(0.35), up),
      metalness: up.mul(0.6),
      temperature: { inside: 1, add: -2, top: { floor: 1 }, y: [-0.05, 0.07] },
    }),
    screed: plain(0xa7a197, { roughness: 0.85, temperature: { floor: 1 } }, 0.06, 22, 0.04, 180),
    oak: surface({ base: oakBase(), roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.35, temperature: { floor: 1 } }),
    edge: plain(0xdad3c2, { roughness: 0.95, temperature: { wall: 1 } }, 0.05, 120),
    // Walls
    plaster: plain(0xe8e2d6, { roughness: 0.93, temperature: { wall: 1 } }, 0.025, 14, 0.02, 260),
    block: surface({ base: blockBase(), roughness: 0.92, temperature: { wall: 1 } }),
    eps: pitted(0xefeee8, 0xd4d3cb, 160, { roughness: 0.95, temperature: { wall: 1 } }),
    render: plain(0xd4cdbf, { roughness: 0.96, temperature: { wall: 1 } }, 0.06, 200, 0.04, 4),
    // Window
    frame: plain(0x2c3137, { roughness: 0.4, clearcoat: 0.5, temperature: { window: 0.5, inside: 0.5 } }),
    glass: plain(0x9fb8c8, { roughness: 0.04, metalness: 0.1, temperature: { window: 1 }, transparent: true, depthWrite: false }),
    sill: surface({ base: concreteBase(0xcfcac2), roughness: 0.5, clearcoat: 0.4, temperature: { window: 0.6, inside: 0.4 } }),
    // Furniture
    fabric: plain(0x4d5a6b, { roughness: 1, temperature: room }, 0.06, 300, 0.05, 3),
    cushion: plain(0x9a6b4c, { roughness: 1, temperature: room }, 0.06, 300),
    rug: surface({
      base: mix(color(0xcfc4ae), color(0x8e7f68), step(0.5, fract(P.x.mul(6)).add(fract(P.z.mul(6))).mul(0.5)).mul(0.25)).mul(noise(400).mul(0.1).add(1)),
      roughness: 1,
      temperature: { floor: 1, add: -1.5 },
    }),
    walnut: surface({ base: mix(color(0x3b2417), color(0x6b4428), mx_noise_float(vec3(P.x.mul(60), P.y.mul(3), P.z.mul(3))).mul(0.5).add(0.5)), roughness: 0.45, clearcoat: 0.5, temperature: room }),
    blackSteel: plain(0x1d2024, { roughness: 0.45, metalness: 0.7, temperature: room }),
    shade: plain(0xf3e7cf, { roughness: 0.9, glow: 0xe6b57c, temperature: { inside: 1, add: 18 }, ...double }),
    pot: plain(0xd9d4cc, { roughness: 0.6, clearcoat: 0.3, temperature: room }, 0.04, 50),
    leaf: plain(0x3a6b2e, { roughness: 0.7, temperature: { inside: 1, add: -1.4 }, ...double }, 0.3, 30),
    // Heating
    radiator: ribbed(0xf2f2ef, [Math.PI * 2 / 0.033, 0, 0], 0.035, {
      roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2,
      temperature: { ret: 1, add: -2, top: { flow: 1, add: -2 }, y: [0.305, 0.905] },
    }),
    chrome: plain(0xe6e9ec, { roughness: 0.12, metalness: 1, temperature: { flow: 1, add: -5 } }),
    trvHead: plain(0xf4f4f1, { roughness: 0.4, clearcoat: 0.5, temperature: { inside: 1, add: 2 } }),
    manifoldBrass: plain(0xc8a25a, { roughness: 0.3, metalness: 1, temperature: { ret: 1, top: { flow: 1 }, y: [0.65, 0.8] } }, 0.05, 400),
    cabinet: plain(0xe9e9e6, { roughness: 0.45, clearcoat: 0.4 }),
    galvanized: plain(0x9ea4a9, { roughness: 0.45, metalness: 0.6 }, 0.05, 90, 0.03, 700),
    consumer: plain(0xf1f1ee, { roughness: 0.5, clearcoat: 0.3, temperature: { inside: 1, add: 1 } }),
    breaker: plain(0x2c3036, { roughness: 0.5, temperature: { inside: 1, add: 4 } }),
    // Water pipes
    flowPipe: pipe(0, 0, 1),
    returnPipe: pipe(1, 0, 1),
    loopPipe: pipe(0, 1, 0),
    foam: pitted(0x171a1c, 0x1e2023, 300, { roughness: 0.95, temperature: { outside: 0.65, inside: 0.35 } }),
    jacket: surface({ base: color(0x1a1c1f).mul(sin(uv().x.mul(900)).mul(0.08).add(1)), roughness: 0.55, clearcoat: 0.3, temperature: { ground: 1 }, side: THREE.DoubleSide, alphaTest: 0.5 }),
    jacketFoam: pitted(0xd4d1c5, 0xebe7da, 500, { roughness: 0.95, temperature: { ground: 0.6, flow: 0.4 } }),
    duct: duct(0),
    powerDuct: duct(1),
    tape: surface({ base: mix(color(0xf2d23a), color(0x1a1a1a), step(0.5, fract(P.x.mul(5)))), roughness: 0.6, temperature: { ground: 1 } }),
    epdm: plain(0x15171a, { roughness: 0.8, temperature: { ground: 1 } }),
    // Outdoor unit
    casing: plain(0xdfe2e4, { roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25, temperature: { outside: 1, add: 1 } }, 0.012, 600),
    casingDark: plain(0x2b2f35, { roughness: 0.6, temperature: { outside: 1, add: 1 } }, 0.03, 500),
    grille: plain(0x1e2126, { roughness: 0.5, metalness: 0.4, temperature: { outside: 1 } }),
    blade: plain(0x30343a, { roughness: 0.4, clearcoat: 0.5, temperature: { outside: 1, add: -2 }, ...double }),
    fin: surface({
      base: mix(color(0xb9c0c7).mul(noise(200).mul(0.05).add(1)), color(0xf4f8fb), U.frost.mul(smoothstep(-0.3, 0.3, noise(35)))),
      roughness: mix(float(0.35), float(0.9), U.frost), metalness: mix(float(0.8), float(0.1), U.frost), temperature: { coil: 0.7, outside: 0.3 },
      side: THREE.DoubleSide,
    }),
    copper: plain(0xc47a4f, { roughness: 0.3, metalness: 1, temperature: { ret: 1 } }, 0.06, 300),
    copperCold: surface({ base: mix(color(0xc47a4f), color(0xe9eef2), U.frost.mul(0.7)), roughness: 0.35, metalness: mix(float(1), float(0.2), U.frost), temperature: { coil: 1 } }),
    compressor: plain(0x17191c, { roughness: 0.55, clearcoat: 0.4, temperature: { suction: 1, add: 14, top: { discharge: 1 }, y: [0.4, 0.65] } }, 0.04, 80),
    steel: ribbed(0x9aa1a8, [2600, 0, 2600], 0.03, { roughness: 0.42, metalness: 0.72, temperature: { outside: 1, add: 2 } }),
    plate: ribbed(0xb8bec4, [0, 900, 0], 0.04, { roughness: 0.38, metalness: 0.75, temperature: { ret: 1, top: { plate: 1 }, y: [0.46, 0.76] } }),
    brass: plain(0xc8a25a, { roughness: 0.3, metalness: 1, temperature: { condensing: 0.5, evaporating: 0.5 } }),
    // The four-way valve body: its front half is cut away, from one end, while the changeover looks inside.
    valveBody: plain(0xc8a25a, { roughness: 0.3, metalness: 1, temperature: { discharge: 0.6, suction: 0.4 }, side: THREE.DoubleSide, alphaTest: 0.5 }),
    slider: plain(0xe4ddd0, { roughness: 0.45, clearcoat: 0.5, temperature: { suction: 1, add: 4 } }),
    pump: plain(0x9d1f1f, { roughness: 0.45, clearcoat: 0.6, temperature: { ret: 1 } }),
    vessel: plain(0xc8302c, { roughness: 0.4, clearcoat: 0.8, temperature: { ret: 1, add: -8 } }),
    rubber: plain(0x121416, { roughness: 0.85, temperature: { outside: 1, add: 3 } }),
    pcb: ribbed(0x1f5a3a, [Math.PI * 2 * 120, 0, 0], 0.08, { roughness: 0.5, clearcoat: 0.6, temperature: { outside: 1, add: 28 } }),
    capacitor: plain(0x1f3f8a, { roughness: 0.35, clearcoat: 0.8, temperature: { outside: 1, add: 30 } }),
    choke: plain(0xb4713f, { roughness: 0.3, metalness: 1, temperature: { outside: 1, add: 35 } }),
    label: plain(0xf5f5f2, { roughness: 0.6, temperature: { outside: 1, add: 1 } }),
    cable: plain(0x202226, { roughness: 0.6, temperature: { outside: 1, add: 4 } }),
    screw: plain(0xcfd3d6, { roughness: 0.25, metalness: 1, temperature: { outside: 1, add: 1 } }),
    isolator: plain(0xe2e2dd, { roughness: 0.5, clearcoat: 0.3, temperature: { outside: 1, add: 2 } }),
    isolatorKnob: plain(0xd12f24, { roughness: 0.4, clearcoat: 0.6, temperature: { outside: 1, add: 2 } }),
  };
  m.glass.opacityNode = mix(float(0.16), float(1), U.thermal);
  // The twin pipe is cut open over part of the trench, so the carriers inside show.
  m.jacket.opacityNode = step(0.0005, P.z).mul(step(0.55, P.x)).mul(step(P.x, 1.75)).oneMinus();
  m.valveBody.opacityNode = step(-0.2195, P.z).mul(step(P.x, U.cut.mul(0.11).add(2.275))).oneMinus();
  return m;
}

/** The warm-air plume over the radiator: a sheet of rising noise, brightest in the thermal view. */
export function createPlumeMaterial() {
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  material.mrtNode = noGlow();
  const p = positionLocal;
  const rise = vec3(p.x.mul(3), p.y.mul(2).sub(time.mul(0.35)), time.mul(0.1));
  const wisps = mx_noise_float(rise.mul(2)).mul(0.5).add(0.5).mul(mx_noise_float(rise.mul(5)).mul(0.3).add(0.7));
  const v = uv();
  const fade = smoothstep(0, 0.12, v.x).mul(smoothstep(1, 0.88, v.x)).mul(smoothstep(0, 0.1, v.y)).mul(smoothstep(1, 0.35, v.y));
  const strength = U.plume.mul(mix(float(0.12), float(0.9), U.thermal));
  material.colorNode = mix(color(0xffb070), heat(U.flow.sub(v.y.mul(20))), U.thermal).mul(wisps).mul(fade).mul(strength);
  return material;
}

/** Scene backdrop: the studio gradient, darker in the thermal view. */
export function backdrop(screenUV) {
  const studio = mix(color(0x141d2c), color(0x05070b), screenUV.y.oneMinus().pow(0.7).oneMinus());
  return mix(studio, color(0x020206), U.thermal.mul(0.8));
}
