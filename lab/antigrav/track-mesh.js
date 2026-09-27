// The circuit as a handful of meshes: the deck, the structure under it and the energy walls are
// each one geometry swept along the track samples; gantries, pads and tunnel ribs are instanced.
// The station around the tunnel is one swept hull plus one merged ring.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { frameAt, toWorld, inZone, WALL } from './track.js';
import {
  deckMaterial, wallMaterial, structureMaterial, hullMaterial, neonMaterial, padMaterial, boardMaterial, U,
} from './materials.js';

export const DECK_HALF = 12;       // m, the deck is wider than the walls (11.2)
const GANTRY_EVERY = 420;          // m
const RIB_EVERY = 14;              // m
const POST_EVERY = 8;              // m, trackside posts
const POST = { d: 11.75, h: 4 };
const HEX = { r: 19, rib: 17, ribIn: 15.5, h: 4 };
const RING = { r: 200, tube: 16 };

// Profile edges in the (d, h) plane, traversed clockwise (d to the right, h up), so the outward
// normal of an edge (dd, dh) is (-dh, dd). Each edge is flat shaded. `u` gives the across texture
// coordinate of each end (defaults to the running length of the profile).
function edges(points, u = null) {
  const out = [];
  let run = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [d0, h0] = points[i], [d1, h1] = points[i + 1];
    const l = Math.hypot(d1 - d0, h1 - h0);
    out.push({ a: [d0, h0], b: [d1, h1], n: [-(h1 - h0) / l, (d1 - d0) / l], u: u ? [u[i], u[i + 1]] : [run, run + l] });
    run += l;
  }
  return out;
}

// Sweeps profile edges along the track from s0 to s1, one row every `step` m. uv = (profile u,
// s in metres); `track` = (d, h, kn) for the shaders that need the side and the bend.
function sweep(track, profile, s0 = 0, s1 = track.length, step = track.step) {
  const rows = Math.max(1, Math.round((s1 - s0) / step));
  const perRow = profile.length * 2;
  const pos = new Float32Array((rows + 1) * perRow * 3);
  const nor = new Float32Array((rows + 1) * perRow * 3);
  const uvs = new Float32Array((rows + 1) * perRow * 2);
  const trk = new Float32Array((rows + 1) * perRow * 3);
  const f = frameAt(track, s0);
  let k = 0;
  for (let r = 0; r <= rows; r++) {
    const s = s0 + ((s1 - s0) * r) / rows;
    frameAt(track, s, f);
    for (const e of profile) {
      for (const [end, [d, h]] of [e.a, e.b].entries()) {
        for (let a = 0; a < 3; a++) {
          pos[k * 3 + a] = f.p[a] + f.N[a] * d + f.U[a] * h;
          nor[k * 3 + a] = f.N[a] * e.n[0] + f.U[a] * e.n[1];
        }
        uvs[k * 2] = e.u[end];
        uvs[k * 2 + 1] = s;
        trk[k * 3] = d; trk[k * 3 + 1] = h; trk[k * 3 + 2] = f.kn;
        k++;
      }
    }
  }
  const index = [];
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j < profile.length; j++) {
      const a = r * perRow + j * 2, b = a + perRow, c = b + 1, d = a + 1;
      index.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('track', new THREE.BufferAttribute(trk, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

// Matrix that maps local X to the track's right, Y to its up and Z backward, at (s, d, h).
function trackMatrix(track, s, d = 0, h = 0, out = new THREE.Matrix4()) {
  const f = frameAt(track, s);
  const p = toWorld(track, s, d, h, [0, 0, 0], f);
  out.makeBasis(new THREE.Vector3(...f.N), new THREE.Vector3(...f.U), new THREE.Vector3(...f.T).negate());
  return out.setPosition(p[0], p[1], p[2]);
}

function instanced(geometry, material, matrices, name, color = null) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  if (color) {
    const c = new THREE.Color(color);
    for (let i = 0; i < matrices.length; i++) mesh.setColorAt(i, c);
  }
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

// Sponsor sheets for the boards, drawn once into a canvas: one 8:1 row per invented brand.
const SPONSORS = [
  { name: 'NADIR GRAV SYSTEMS', ink: '#35d0ff', bg: '#07131d' },
  { name: 'HALO FUEL', ink: '#ffb13a', bg: '#1a0e04' },
  { name: 'VOLTA CELLS', ink: '#9be22d', bg: '#0b1405' },
  { name: 'ORBITAL LINES', ink: '#ff5aa8', bg: '#1a0612' },
];
function sponsorAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128 * SPONSORS.length;
  const ctx = canvas.getContext('2d');
  const draw = () => {
    SPONSORS.forEach(({ name, ink, bg }, i) => {
      // Row 0 sits at the bottom of the texture (uv.y = 0).
      const y = (SPONSORS.length - 1 - i) * 128;
      ctx.fillStyle = bg;
      ctx.fillRect(0, y, 1024, 128);
      ctx.fillStyle = ink;
      ctx.fillRect(0, y + 8, 1024, 6);
      ctx.fillRect(0, y + 114, 1024, 6);
      ctx.beginPath();
      ctx.arc(80, y + 64, 36, 0, Math.PI * 2);
      ctx.lineWidth = 10;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.fillRect(62, y + 58, 36, 12);
      ctx.font = 'italic 900 70px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 150, y + 66, 850);
    });
  };
  draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  document.fonts?.ready.then(() => { draw(); tex.needsUpdate = true; });
  return tex;
}

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// Texture coordinates in metres, so the window pattern keeps its size on every part.
function metreUV(g, su, sv) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

export function buildTrackMesh(track) {
  const group = new THREE.Group();
  group.name = 'track';
  U.startS.value = track.startS;
  U.trackLength.value = track.length;
  const structure = structureMaterial();
  const neon = neonMaterial();

  const deck = new THREE.Mesh(sweep(track, edges([[-DECK_HALF, 0], [DECK_HALF, 0]], [-DECK_HALF, DECK_HALF])), deckMaterial());
  deck.name = 'deck';
  deck.receiveShadow = true;

  const W = DECK_HALF, rail = [WALL.d - 0.3, WALL.d + 0.3];
  const under = edges([[-rail[1], 0], [-rail[1], WALL.h0], [-rail[0], WALL.h0], [-rail[0], 0.02]])
    .concat(edges([[rail[0], 0.02], [rail[0], WALL.h0], [rail[1], WALL.h0], [rail[1], 0]]))
    .concat(edges([[W, 0], [W, -0.6], [3.2, -0.6], [1.6, -3.2], [-1.6, -3.2], [-3.2, -0.6], [-W, -0.6], [-W, 0]]));
  const keel = new THREE.Mesh(sweep(track, under), structure);
  keel.name = 'keel';
  keel.receiveShadow = true;

  const H = WALL.h1 - WALL.h0;
  const walls = new THREE.Mesh(sweep(track, [
    ...edges([[WALL.d, WALL.h0], [WALL.d, WALL.h1]], [0, H]),
    ...edges([[-WALL.d, WALL.h1], [-WALL.d, WALL.h0]], [H, 0]),
  ]), wallMaterial(H));
  walls.name = 'walls';
  walls.renderOrder = 2;

  const outsideTunnel = (s) => !inZone(track, s % track.length, 'tunnel');

  // Gantries over the deck, none inside the station. Each carries a sponsor banner.
  const gantry = mergeGeometries([
    box(1.2, 11, 1.4, -13.2, 5.5), box(1.2, 11, 1.4, 13.2, 5.5), box(27.6, 1.3, 1.8, 0, 10.6),
  ]);
  const gantryBar = box(24, 0.25, 0.35, 0, 9.85, 0);
  const at = [];
  // None where the ship flies or the camera swings hard either: the drop, hairpin, crest, loops
  // and corkscrews.
  const clear = (s) => !['tunnel', 'drop', 'hairpin', 'crest', 'loop', 'twist'].some((tag) => inZone(track, s % track.length, tag));
  for (let s = track.startS + GANTRY_EVERY; s < track.startS + track.length - 60; s += GANTRY_EVERY) {
    if (clear(s)) at.push(trackMatrix(track, s % track.length));
  }
  const start = trackMatrix(track, track.startS);
  const gantries = instanced(gantry, structure, [start, ...at], 'gantries');
  const bars = instanced(gantryBar, neon, at, 'gantry-lights', 0x6fe3ff);
  const lampGeometry = mergeGeometries([-6, 0, 6].map((x) => box(4.2, 1.1, 0.5, x, 9.2, -1)));
  const lamp = instanced(lampGeometry, neon, [start], 'start-lights', 0x000000);

  // Posts along both walls every 8 m with a lamp on top: the near field that sells the speed.
  const postAt = [];
  for (let s = 0; s < track.length; s += POST_EVERY) {
    if (outsideTunnel(s)) for (const side of [-1, 1]) postAt.push(trackMatrix(track, s, side * POST.d));
  }
  const posts = instanced(box(0.22, POST.h, 0.22, 0, WALL.h0 + POST.h / 2), structure, postAt, 'posts');
  const postLamps = instanced(box(0.3, 0.12, 0.6, 0, WALL.h0 + POST.h + 0.06), neon, postAt, 'post-lamps', 0xbfefff);

  // Pads: a unit quad with X to the right, Y forward, Z up. One mesh, `kind` per instance.
  const quad = new THREE.PlaneGeometry(1, 1);
  const padGeometry = quad.clone();
  const kinds = new THREE.InstancedBufferAttribute(new Float32Array(track.pads.length), 1);
  const padIndex = new Map();
  const padAt = track.pads.map((p, i) => {
    kinds.setX(i, p.kind === 'item' ? 1 : 0);
    padIndex.set(p, i);
    const f = frameAt(track, p.s);
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...f.N).multiplyScalar(2 * p.w), new THREE.Vector3(...f.T).multiplyScalar(2 * p.l), new THREE.Vector3(...f.U));
    const q = toWorld(track, p.s, p.d, 0.05, [0, 0, 0], f);
    return m.setPosition(q[0], q[1], q[2]);
  });
  padGeometry.setAttribute('kind', kinds);
  const pads = instanced(padGeometry, padMaterial(), padAt, 'pads', 0xffffff);
  pads.renderOrder = 1;

  // Sponsor boards: banners on the gantry beams, boards beside the bends (they hover on their
  // own field, like the ships), and holograms floating over the start, pads, esses and climb.
  const atlas = sponsorAtlas();
  const rows = SPONSORS.length;
  const sheet = (n) => {
    const g = quad.clone();
    const row = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    for (let i = 0; i < n; i++) row.setX(i, i % rows);
    g.setAttribute('row', row);
    return g;
  };
  const place = (s, d, h, w, hgt, yaw = 0) => {
    const m = trackMatrix(track, s, d, h);
    return m.multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeScale(w, hgt, 1));
  };
  // A quad faces +Z, which is backward along the track: toward the ships coming.
  const boardAt = [...at.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 12.8, 1).multiply(new THREE.Matrix4().makeScale(22, 2.75, 1))))];
  for (const z of track.zones.filter((q) => q.tag === 'sweeper' || q.tag === 'hairpin' || q.tag === 'esses')) {
    for (const k of [0.15, 0.55]) {
      const s = z.s0 + (z.s1 - z.s0) * k;
      const f = frameAt(track, s);
      const side = f.kn > 0 ? -1 : 1;   // the outside of the bend, where the eye goes
      boardAt.push(place(s, side * 23, 7, 18, 2.25, -side * 0.35));
    }
  }
  const boards = instanced(sheet(boardAt.length), boardMaterial(atlas, rows), boardAt, 'boards');
  const holoAt = [];
  for (const [tag, k] of [['start', 0.35], ['pads', 0.5], ['esses', 0.5], ['climb', 0.4]]) {
    const z = track.zones.find((q) => q.tag === tag);
    if (z) holoAt.push(place(z.s0 + (z.s1 - z.s0) * k, 0, 17, 28, 3.5));
  }
  const holograms = instanced(sheet(holoAt.length), boardMaterial(atlas, rows, true), holoAt, 'holograms');
  holograms.renderOrder = 2;

  group.add(deck, keel, walls, gantries, bars, lamp, posts, postLamps, pads, boards, holograms);

  // The station: a hexagonal hull around the tunnel with lit ribs inside, and a ring around it.
  const tunnel = track.zones.find((z) => z.tag === 'tunnel');
  const station = new THREE.Group();
  station.name = 'station';
  const hex = (r) => Array.from({ length: 7 }, (_, i) => {
    const a = (-i * Math.PI) / 3;
    return [r * Math.cos(a), HEX.h + r * Math.sin(a)];
  });
  const hull = new THREE.Mesh(sweep(track, edges(hex(HEX.r)), tunnel.s0 - 8, tunnel.s1 + 8), hullMaterial());
  hull.name = 'hull';
  const ribShape = new THREE.Shape(hex(HEX.rib).map(([x, y]) => new THREE.Vector2(x, y - HEX.h)));
  ribShape.holes.push(new THREE.Path(hex(HEX.ribIn).map(([x, y]) => new THREE.Vector2(x, y - HEX.h))));
  const rib = new THREE.ExtrudeGeometry(ribShape, { depth: 1.4, bevelEnabled: false }).translate(0, HEX.h, -0.7);
  const ribLight = new THREE.TorusGeometry(HEX.ribIn - 0.25, 0.14, 4, 6).translate(0, HEX.h, 0);
  const ribAt = [];
  for (let s = tunnel.s0 + 6; s < tunnel.s1; s += RIB_EVERY) ribAt.push(trackMatrix(track, s));
  const ribs = instanced(rib, structure, ribAt, 'ribs');
  const ribLights = instanced(ribLight, neon, ribAt, 'rib-lights', 0x7fe9ff);

  const ringParts = [metreUV(new THREE.TorusGeometry(RING.r, RING.tube, 16, 96), 2 * Math.PI * RING.r, 2 * Math.PI * RING.tube)];
  const spoke = RING.r - HEX.r;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const c = metreUV(new THREE.CylinderGeometry(4, 4, spoke, 12, 1, true), 2 * Math.PI * 4, spoke);
    c.translate(0, HEX.r + spoke / 2, 0).rotateZ(a - Math.PI / 2);
    ringParts.push(c);
  }
  const ring = new THREE.Mesh(mergeGeometries(ringParts), hull.material);
  const ringMatrix = trackMatrix(track, (tunnel.s0 + tunnel.s1) / 2, 0, HEX.h);
  ring.applyMatrix4(ringMatrix);
  ring.name = 'ring';
  station.add(hull, ribs, ribLights, ring);
  group.add(station);

  // Coarse stand-ins for the sun's occlusion rays, never drawn: the deck every 16 m, the hull
  // every 24 m, a low ring. About 3 k triangles instead of the ~50 k drawn ones.
  const proxy = (geometry) => new THREE.Mesh(geometry);
  const lowRing = new THREE.TorusGeometry(RING.r, RING.tube, 6, 32).applyMatrix4(ringMatrix);
  const sunBlockers = [
    proxy(sweep(track, edges([[-WALL.d, 0], [WALL.d, 0]]), 0, track.length, 16)),
    proxy(sweep(track, edges(hex(HEX.r)), tunnel.s0 - 8, tunnel.s1 + 8, 24)),
    proxy(lowRing),
  ];
  for (const m of sunBlockers) m.material.side = THREE.DoubleSide;

  return { group, station, deck, walls, lamp, pads, padIndex, sunBlockers, ring: { matrix: ringMatrix, radius: RING.r, tube: RING.tube } };
}
