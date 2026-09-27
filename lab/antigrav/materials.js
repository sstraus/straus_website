// The fixed material set: one node graph per family, built once. Colours and animation come in
// through shared uniforms (U) or per-instance colours, so a new ship or pad never adds a shader.
// Emitters write their light to the emissive MRT (bloom); everything else writes black there.
import * as THREE from 'three/webgpu';
import {
  uniform, uv, vec2, vec3, vec4, float, mix, smoothstep, step, fract, abs, max, fwidth, mrt, floor,
  mx_noise_float, instanceColor, attribute,
  normalWorld, positionWorld, cameraPosition, normalize, dot, pow, length, exp, sin, clamp, atan,
  uniformArray, dFdx, dFdy, positionView, normalView, cross, sign, texture,
} from 'three/tsl';

const num = (v) => (typeof v === 'number' ? uniform(v) : v);
const hex = (v) => (typeof v === 'number' || typeof v === 'string' ? uniform(new THREE.Color(v)) : v);

// Materials that many meshes use are built once and shared: one material, one set of pipelines.
const shared = new Map();
const once = (key, make) => {
  if (!shared.has(key)) shared.set(key, make());
  return shared.get(key);
};

/** MRT override for unlit materials: `glow` (vec3 node) goes to bloom, or nothing when omitted. */
export const glowOutput = (glow = null) => mrt({ emissive: glow ? vec4(glow, 1) : vec4(0, 0, 0, 1) });

export const SUN = new THREE.Vector3(0.85, 0.35, -0.2).normalize();
export const PLANET = { dir: new THREE.Vector3(0.25, -0.6, -0.75).normalize(), radius: 38 * Math.PI / 180 };

// Shared uniforms. `time` is game time, so everything freezes while the tab is hidden.
export const U = {
  time: uniform(0),
  edge: uniform(new THREE.Color(0x35d0ff)),
  startS: uniform(0),
  sun: uniform(SUN.clone()),
  trackLength: uniform(1),
  hits: uniformArray([0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -100, 0)), 'vec4'),   // wall contact per ship
};

// 1 on lines of width w every `period` along x, antialiased with the pixel footprint.
const lines = (x, period, w) => {
  const f = abs(fract(x.div(period).add(0.5)).sub(0.5)).mul(period);
  const aa = fwidth(x).mul(1.5).add(1e-4);
  return float(1).sub(smoothstep(float(w), aa.add(w), f));
};
// 1 inside [a, b] with soft edges of width e.
const band = (x, a, b, e) => smoothstep(a - e, a + e, x).mul(float(1).sub(smoothstep(b - e, b + e, x)));

// 1 where the surface faces the camera, 0 at a silhouette edge.
const facing = () => abs(dot(normalize(cameraPosition.sub(positionWorld)), normalWorld));

// Chase lights that run forward along the track at 70 m/s.
const chase = (s) => pow(fract(s.sub(U.time.mul(70)).div(36)), 6);

// Screen-space bump from a procedural height (Mikkelsen's surface gradient, as three's
// BumpMapNode does for textures): no texture, no tangents.
function bumped(H, scale) {
  const sx = normalize(dFdx(positionView)), sy = normalize(dFdy(positionView));
  const r1 = cross(sy, normalView), r2 = cross(normalView, sx);
  const det = dot(sx, r1);
  const grad = sign(det).mul(r1.mul(dFdx(H)).add(r2.mul(dFdy(H)))).mul(scale);
  return normalize(abs(det).mul(normalView).sub(grad));
}

// Swept track parts carry `track` = (d, h, kn): offset, height and the curvature of the bend
// (+ = bends right). uv = (profile u, s in m).
const trackAttr = () => attribute('track', 'vec3');

/**
 * Track deck. Dark metal plates with grooved seams and a fine diamond grip, polished wear on the
 * racing line, skid marks, lane dashes, light studs that pulse forward with the chase lights,
 * the chase lights mirrored in the metal near the edges, the start checker.
 */
export function deckMaterial() {
  const m = new THREE.MeshPhysicalNodeMaterial();
  const d = uv().x, s = uv().y, ad = abs(d);
  const grain = mx_noise_float(vec3(d.mul(0.7), s.mul(0.18), 0)).mul(0.5).add(0.5);
  const plates = mx_noise_float(vec3(floor(d.div(5.5)), floor(s.div(8)), 3)).mul(0.5).add(0.5);
  const inside = step(ad, 10.2);
  const seams = max(lines(s, 8, 0.03), lines(d, 5.5, 0.03)).mul(inside);
  const grip = lines(d.add(s), 0.5, 0.05).mul(lines(d.sub(s), 0.5, 0.05)).mul(inside);
  const wear = smoothstep(0.45, 0.8, mx_noise_float(vec3(d.mul(0.22), s.mul(0.012), 5)).mul(0.5).add(0.5));
  const skid = smoothstep(0.5, 0.8, mx_noise_float(vec3(d.mul(1.4), s.mul(0.006), 9)).mul(0.5).add(0.5))
    .mul(smoothstep(0.1, 0.6, mx_noise_float(vec3(7, s.mul(0.015), 11)))).mul(inside);
  const lanes = lines(ad.sub(3.7), 100, 0.09).mul(step(0.55, fract(s.div(10))));
  const studAt = vec2(ad.sub(3.7), fract(s.div(5).add(0.5)).sub(0.5).mul(5));
  const stud = float(1).sub(smoothstep(0.09, 0.13, length(studAt)));
  const toStart = abs(s.sub(U.startS));
  const checker = step(0.5, fract(floor(d.div(1.1)).add(floor(s.div(1.1))).mul(0.5)));
  const startLine = step(toStart, 2.2).mul(step(ad, 10.2));
  const outer = step(11, ad);
  // Dark blue-grey plates: under a 3.2 sun anything lighter reads as grey concrete (measured).
  let base = mix(hex(0x0a0e15), hex(0x10151d), plates).mul(grain.mul(0.35).add(0.8));
  base = base.mul(float(1).sub(skid.mul(0.55))).add(wear.mul(0.03));
  base = mix(base, vec3(0.025), seams.max(outer.mul(0.6)));
  base = mix(base, vec3(0.2, 0.25, 0.32), lanes.mul(0.5));
  base = mix(base, mix(vec3(0.03), vec3(0.8), checker), startLine);
  m.colorNode = base;
  // A low sun in front of the camera hits the deck at a grazing angle, where Fresnel turns any
  // dielectric into a mirror: the deck washed to beige concrete. A weak specular keeps it dark
  // blue-grey, and the neon stays the brightest thing on it.
  m.roughnessNode = mix(num(0.52), num(0.74), grain).sub(wear.mul(0.12)).add(skid.mul(0.12)).add(seams.mul(0.2)).add(grip.mul(0.08));
  m.metalnessNode = num(0);
  m.specularIntensityNode = num(0.06);
  m.normalNode = bumped(grip.mul(0.25).sub(seams), 0.35);
  const run = chase(s);
  const edge = band(ad, 10.35, 10.9, 0.04);
  const mirrored = smoothstep(7.5, 10.3, ad).mul(float(1).sub(step(10.3, ad))).mul(run).mul(0.22);
  m.emissiveNode = U.edge.mul(edge.mul(run.mul(3).add(0.45)).add(mirrored)).add(vec3(0.9, 0.95, 1).mul(stud.mul(run.mul(4).add(0.5))));
  return m;
}

/**
 * Energy walls: additive. uv = (h in m, s in m). A grid that fades upward, chevrons on the outer
 * wall of every bend (amber, pointing into the turn), and a flash where a ship touches the
 * barrier: U.hits holds one (s, side, time, strength) per ship; a scrape keeps it alive.
 */
export function wallMaterial(height) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  m.fog = false;
  const h = uv().x, s = uv().y, t = trackAttr();
  const side = sign(t.x);
  const fade = pow(float(1).sub(smoothstep(0, height, h)), 1.6);
  const mesh = max(lines(s, 3, 0.025), lines(h, 0.7, 0.02)).mul(0.35);
  const foot = float(1).sub(smoothstep(0.05, 0.3, h));
  const outer = smoothstep(0.0015, 0.004, t.z.mul(side).negate());
  const chev = step(0.62, fract(s.add(abs(h.sub(1.3)).mul(1.1)).div(4))).mul(band(h, 0.35, 2.3, 0.05));
  const chevrons = chev.mul(outer).mul(chase(s).mul(1.5).add(0.6));
  let flash = float(0);
  for (let i = 0; i < 4; i++) {
    const hit = U.hits.element(i);
    const ds0 = abs(s.sub(hit.x));
    const ds = ds0.min(U.trackLength.sub(ds0));
    const age = U.time.sub(hit.z).max(0);
    const reach = age.mul(40).add(2.5);
    flash = flash.add(hit.w.mul(exp(ds.mul(ds).div(reach.mul(reach)).negate())).mul(exp(age.mul(-5))).mul(step(0.5, side.mul(hit.y))));
  }
  const col = U.edge.mul(fade.mul(mesh.add(0.05)).add(foot.mul(1.1)).add(chase(s).mul(fade).mul(0.5)))
    .add(hex(0xff7a2a).mul(chevrons))
    .add(vec3(0.8, 0.95, 1).mul(flash.mul(mesh.mul(4).add(0.35)).mul(fade.add(0.15))));
  m.colorNode = col;
  m.mrtNode = glowOutput(col.mul(0.55));
  m.name = 'wall';
  return m;
}

/** Plain structure: dark painted metal with a little variation. Also the keel and the gantries. */
export const structureMaterial = () => once('structure', () => {
  const m = new THREE.MeshStandardNodeMaterial();
  const n = mx_noise_float(positionWorld.mul(0.07)).mul(0.5).add(0.5);
  m.colorNode = hex(0x2a313b).mul(n.mul(0.5).add(0.75));
  m.roughnessNode = n.mul(0.25).add(0.35);
  m.metalnessNode = num(0.7);
  m.name = 'structure';
  return m;
});

/**
 * Station hull: plated metal with panel seams, and small windows in strips (decks), most of
 * them dark. The windows are 0.6 by 0.4 m, so the hull reads at the scale of a building.
 * uv in metres.
 */
export const hullMaterial = () => once('hull', () => {
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const p = uv();
  const plates = mx_noise_float(vec3(floor(p.x.div(6)), floor(p.y.div(4)), 5)).mul(0.5).add(0.5);
  const seams = max(lines(p.x, 6, 0.04), lines(p.y, 4, 0.04));
  const deck = step(0.35, mx_noise_float(vec3(floor(p.y.div(4)), 3, 1).mul(0.61)));
  const cell = floor(vec2(p.x.div(1.1), p.y.div(0.9)));
  const lit = step(0.45, mx_noise_float(vec3(cell, 7).mul(0.37)));
  const pane = band(fract(p.x.div(1.1)), 0.3, 0.7, 0.03).mul(band(fract(p.y.div(0.9)), 0.4, 0.7, 0.03));
  const row = band(fract(p.y.div(4)), 0.35, 0.8, 0.01);
  const windows = pane.mul(lit).mul(deck).mul(row);
  const n = mx_noise_float(positionWorld.mul(0.02)).mul(0.5).add(0.5);
  m.colorNode = hex(0x39424e).mul(n.mul(0.3).add(plates.mul(0.3)).add(0.6)).mul(float(1).sub(seams.mul(0.6)));
  m.roughnessNode = num(0.5).add(plates.mul(0.15));
  m.metalnessNode = num(0.6);
  m.emissiveNode = hex(0xffc58a).mul(windows.mul(0.25));
  m.name = 'hull';
  return m;
});

/** Light bars and lamps: unlit, the instance colour is the light. Every lamp shares it. */
export const neonMaterial = () => once('neon', () => {
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = vec3(1);
  m.mrtNode = glowOutput(instanceColor);
  m.name = 'neon';
  return m;
});

/**
 * Pads on the deck, additive, one material for both kinds: the instanced `kind` is 0 for a speed
 * pad (chevrons racing forward) and 1 for an item pad (a pulsing diamond). The instance colour
 * dims an item pad while it recharges.
 */
export function padMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  m.fog = false;
  const kind = attribute('kind', 'float');
  const x = uv().x.sub(0.5), y = uv().y;
  const chev = step(0.5, fract(y.mul(4).sub(abs(x).mul(2.2)).sub(U.time.mul(5))));
  const rim = float(1).sub(band(abs(x), 0, 0.44, 0.02).mul(band(y, 0.03, 0.97, 0.02)));
  const speed = hex(0xffa23a).mul(chev.mul(1.8).add(rim.mul(1.3)).add(0.1));
  const r = abs(x).add(abs(y.sub(0.5)));
  const pulse = sin(U.time.mul(5)).mul(0.5).add(0.5);
  const ring = band(r, 0.3, 0.42, 0.03).mul(pulse.mul(0.8).add(0.6));
  const core = float(1).sub(smoothstep(0.1, 0.22, r));
  const item = hex(0xb36bff).mul(ring.mul(1.8).add(core.mul(1.2)).add(0.05));
  const col = mix(speed, item, kind);
  m.colorNode = col;
  m.mrtNode = glowOutput(col.mul(instanceColor).mul(0.8));
  m.name = 'pad';
  return m;
}

/**
 * Trackside boards: a sponsor sheet from a canvas atlas (one row per board, `row` instanced),
 * lit from inside. With `holo` the same sheet is a hologram: additive, cyan, scanlines, flicker.
 */
export function boardMaterial(atlas, rows, holo = false) {
  const m = holo
    ? new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })
    : new THREE.MeshBasicNodeMaterial();
  const row = attribute('row', 'float');
  const sheet = texture(atlas, vec2(uv().x, uv().y.add(row).div(rows))).rgb;
  if (holo) {
    m.fog = false;
    const scan = sin(uv().y.mul(90).sub(U.time.mul(12))).mul(0.25).add(0.75);
    const flicker = step(0.08, fract(sin(floor(U.time.mul(14)).mul(91.7)).mul(43758.5))).mul(0.4).add(0.6);
    const col = vec3(0.35, 0.9, 1.2).mul(sheet.g.max(sheet.r).max(sheet.b)).mul(scan).mul(flicker).mul(1.4);
    m.colorNode = col;
    m.mrtNode = glowOutput(col.mul(0.7));
  } else {
    m.colorNode = sheet.mul(1.5);
    m.mrtNode = glowOutput(sheet.mul(0.35));
  }
  m.name = holo ? 'hologram' : 'board';
  return m;
}

// Per-instance ship data (instanced attributes, see ship-model.js): `team` the base colour,
// `drive` = (thrust, zap, number code, 0). Per-vertex: `paint` 1 paint / 0 carbon, `hot` 1 on the
// nozzle lips. Positions and normals are read raw, before instancing, so the livery sticks to the hull.
const shipP = () => attribute('position', 'vec3');
// Rivals (drive.w = 1) dissolve (hashed alpha) where they come within 6.5 m of the camera (a ship side by side with the player is ~8 m away), so a ship
// overtaking past the lens never fills the frame. The player's ship (w = 0) never fades.
const nearFade = (m) => {
  m.alphaHash = true;
  const drive = attribute('drive', 'vec4');
  return mix(float(1), smoothstep(4, 6.5, length(cameraPosition.sub(positionWorld))), drive.w);
};
const bit = (code, k) => step(0.5, fract(code.add(0.5).div(2 ** (k + 1))));

// A seven-segment digit in the unit square q (x right, y up); `code` has one bit per segment a..g.
function sevenSegment(q, code) {
  const t = 0.075;
  const h = (y) => band(q.x, 0.2, 0.8, 0.02).mul(band(q.y, y - t, y + t, 0.02));
  const v = (x, y0, y1) => band(q.x, x - t, x + t, 0.02).mul(band(q.y, y0, y1, 0.02));
  const segs = [h(0.9), v(0.8, 0.5, 0.9), v(0.8, 0.1, 0.5), h(0.1), v(0.2, 0.1, 0.5), v(0.2, 0.5, 0.9), h(0.5)];
  return segs.reduce((acc, seg, k) => acc.max(seg.mul(bit(code, k))), float(0));
}

/**
 * Ship paint: clearcoat over a metallic base, two-tone, with panel lines, white stripes, the race
 * number on the pods, neon chines, a glowing underside, hot nozzle lips and the crackle of a
 * mine's pulse. One material for every team.
 */
export function paintMaterial() {
  const m = new THREE.MeshPhysicalNodeMaterial();
  const paint = attribute('paint', 'float'), hot = attribute('hot', 'float');
  const team = attribute('team', 'vec3'), drive = attribute('drive', 'vec4');
  const p = shipP(), n = attribute('normal', 'vec3');
  const ax = abs(p.x);
  const top = step(0.06, n.y).mul(paint);
  // Livery: an arrow. `sweep` is constant along lines raked back from the spine; the team colour
  // fills the arrow forward of it, a dark shade of it the rear flanks, split by a white pinstripe.
  const sweep = p.z.add(ax.mul(1.15));
  const stripes = band(sweep, 0.72, 0.8, 0.012).mul(top);
  // The race number on top of each pod, behind the fins' root, upright for the chase camera.
  const deck = step(0.5, n.y).mul(paint);
  const q = vec2(p.x.sub(sign(p.x).mul(1.25)).add(0.26).div(0.52), float(1.95).sub(p.z).div(0.72));
  const inCell = band(q.x, 0, 1, 0.01).mul(band(q.y, 0, 1, 0.01));
  const number = sevenSegment(q, drive.z).mul(deck).mul(inCell);
  // Panel seams raked like the arrow, 1.1 m apart, on the paint only.
  const panels = lines(p.z.sub(ax.mul(0.6)), 1.1, 0.006).mul(paint).mul(float(1).sub(stripes));
  const flank = smoothstep(0.78, 0.84, sweep);
  let col = mix(vec3(0.025, 0.027, 0.03), mix(team, team.mul(0.22), flank), paint);
  col = mix(col, vec3(0.92), stripes.max(number));
  col = col.mul(float(1).sub(panels.mul(0.3)));
  m.colorNode = col;
  m.opacityNode = nearFade(m);
  m.roughnessNode = mix(num(0.55), num(0.28), paint).add(panels.mul(0.3));
  m.metalnessNode = mix(num(0.35), num(0.55), paint).mul(float(1).sub(stripes.mul(0.6)));
  m.clearcoatNode = paint.mul(float(1).sub(panels));
  m.clearcoatRoughnessNode = num(0.05);
  // Nozzle lips glow with the thrust; a mine's pulse crawls over the hull as thin arcs.
  const heat = hot.mul(drive.x.mul(0.8).add(0.2));
  const arcs = pow(max(float(1).sub(abs(mx_noise_float(p.mul(3.5).add(vec3(0, U.time.mul(9), U.time.mul(-7)))))), 0), 24);
  // A neon line along the chines and a glow under the hull (the hover field), in the team colour.
  const chine = band(p.y, -0.035, 0.0, 0.01).mul(step(0.35, ax)).mul(float(1).sub(hot));
  const under = step(n.y, -0.2).mul(float(1).sub(hot)).mul(float(1).sub(chine));
  const field = team.mul(chine.mul(2.2).add(under.mul(0.5)).mul(drive.x.mul(0.4).add(0.6)));
  m.emissiveNode = vec3(2.4, 1.1, 0.45).mul(heat).add(vec3(0.7, 0.8, 2.6).mul(arcs.mul(drive.y).mul(3))).add(field);
  m.name = 'paint';
  return m;
}

/** Canopy: dark tinted glass as a clearcoat (no transmission), a faint instrument glow inside. */
export function canopyMaterial() {
  const m = new THREE.MeshPhysicalNodeMaterial({ color: 0x0a1622, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.01 });
  const p = shipP();
  m.emissiveNode = vec3(0.1, 0.5, 0.7).mul(band(p.y, 0.3, 0.36, 0.02).mul(0.25));
  m.opacityNode = nearFade(m);
  m.name = 'canopy';
  return m;
}

/** Exhaust discs: hot core, the instance colour is the thrust. */
export function exhaustMaterial() {
  const m = new THREE.MeshBasicNodeMaterial();
  const k = max(float(1.3).sub(length(uv().sub(0.5)).mul(2.2)), 0.12);
  m.colorNode = vec3(k);
  m.mrtNode = glowOutput(instanceColor.mul(k));
  m.name = 'exhaust';
  return m;
}

/**
 * Engine plumes: open cones from the nozzles (uv.y = 1 at the nozzle, 0 at the tip), additive.
 * The length is in the instance matrix, the colour and strength in the instance colour. Shock
 * diamonds and a fast flicker stand in for the heat shimmer (there is no refraction pass).
 */
export function plumeMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  // Clamped: the interpolated uv dips below 0 at the rim, and GLSL pow() of a negative base is NaN,
  // which the bloom then smears over the whole frame (WebGL only).
  const along = float(1).sub(uv().y).clamp(0, 1);
  const core = pow(facing(), 2.5);
  const diamonds = sin(along.mul(38).sub(U.time.mul(60))).mul(0.5).add(0.5).mul(float(1).sub(along)).mul(0.35);
  const flicker = mx_noise_float(vec3(uv().x.mul(6), along.mul(5).sub(U.time.mul(25)), 0)).mul(0.3).add(0.85);
  const k = pow(float(1).sub(along), 2.6).mul(core.mul(1.1)).mul(flicker).add(diamonds.mul(core).mul(0.6));
  m.colorNode = vec3(k);
  m.mrtNode = glowOutput(instanceColor.mul(k));
  m.name = 'plume';
  return m;
}

/** Bolts and mines: bright solids, additive, brighter at the core. */
export function glowSolidMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const k = pow(facing(), 1.5).mul(1.4).add(0.3);
  m.colorNode = vec3(k);
  m.mrtNode = glowOutput(instanceColor.mul(k));
  m.name = 'glow-solid';
  return m;
}

/** Shields: a hex-cell bubble that lights up at its rim and along the cell edges. */
export function shieldMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  const rim = pow(max(float(1).sub(facing()), 0), 2.2);
  const p = shipP();
  const g = vec2(atan(p.z, p.x).mul(2.6), p.y.mul(3.2)).mul(1.9);
  const r = vec2(1, 1.732), hh = r.mul(0.5);
  const a = fract(g.div(r)).mul(r).sub(hh), b = fract(g.sub(hh).div(r)).mul(r).sub(hh);
  const cell = mix(b, a, step(dot(a, a), dot(b, b)));
  const hexDist = max(dot(abs(cell), vec2(0.5, 0.866)), abs(cell.x));
  const edge = smoothstep(0.43, 0.49, hexDist);
  const sweep = pow(fract(p.y.mul(0.4).sub(U.time.mul(0.8))), 8);
  const k = rim.mul(1.2).add(edge.mul(0.35).mul(sweep.mul(2).add(0.4))).add(0.02);
  m.colorNode = vec3(k);
  m.mrtNode = glowOutput(instanceColor.mul(k).mul(0.8));
  m.name = 'shield';
  return m;
}

/** Rings: a soft band at the rim of a 2x2 quad (shockwaves, mine pulses), additive. */
export function ringMaterial() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  const r = length(uv().sub(0.5)).mul(2);
  const k = band(r, 0.82, 0.97, 0.05).add(float(1).sub(smoothstep(0, 0.97, r)).mul(0.12));
  m.colorNode = vec3(k);
  m.mrtNode = glowOutput(instanceColor.mul(k));
  m.name = 'ring';
  return m;
}

/** Particles: soft round sprites, additive. Stretched quads make sparks and speed lines. */
export const spriteMaterial = () => once('sprite', () => {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const r = length(uv().sub(0.5)).mul(2);
  const k = pow(clamp(float(1).sub(r), 0, 1), 1.8);
  m.colorNode = vec3(k);
  m.mrtNode = glowOutput(instanceColor.mul(k));
  m.name = 'sprite';
  return m;
});

/** A dark softbox room for the glossy parts: a sun panel, the planet glow below, a few strips. */
export function environmentScene() {
  const scene = new THREE.Scene();
  // One material for every panel: the colour is a vertex attribute.
  const unlit = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  unlit.colorNode = attribute('glow', 'vec3');
  const painted = (geometry, c) => {
    geometry.setAttribute('glow', new THREE.Float32BufferAttribute(Array.from({ length: geometry.attributes.position.count }, () => c).flat(), 3));
    return new THREE.Mesh(geometry, unlit);
  };
  // The room is a sphere turned inside out, so the one double-sided material serves it too.
  scene.add(painted(new THREE.SphereGeometry(50, 32, 16), [0.01, 0.012, 0.02]));
  const panel = (w, h, c, pos) => {
    const p = painted(new THREE.PlaneGeometry(w, h), c);
    p.position.copy(pos);
    p.lookAt(0, 0, 0);
    scene.add(p);
  };
  panel(22, 14, [6, 5.5, 5], SUN.clone().multiplyScalar(40));
  panel(60, 30, [0.12, 0.25, 0.5], PLANET.dir.clone().multiplyScalar(40));
  panel(40, 2, [1.2, 1.4, 1.8], new THREE.Vector3(0, 30, 10));
  panel(40, 2, [1.2, 1.4, 1.8], new THREE.Vector3(0, 30, -10));
  panel(2, 30, [0.3, 1.2, 1.6], new THREE.Vector3(-35, 5, 0));
  return scene;
}
