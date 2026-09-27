/**
 * Pen-sketch renderer for SVG. Every stroke gets a seeded wobble, a small overshoot at the
 * ends and a second, fainter pass, so a drawing reads as ink on paper and not as vector art.
 * Strokes draw themselves in order once the <svg> gets the class "drawn" (see hub.css).
 */
const NS = 'http://www.w3.org/2000/svg';
const PEN_SPEED = 900; // user units of stroke per second of pen time
const MAX_DRAW = 3.2; // seconds: a whole sketch never takes longer than this to draw

/** Deterministic PRNG (mulberry32), so a sketch looks the same on every visit. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Math.round(n * 10) / 10;

/** Smooth path through the points (Catmull-Rom as cubic Béziers), or straight segments. */
function toPath(p, sharp) {
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  if (sharp) {
    for (let i = 1; i < p.length; i++) d += `L${f(p[i][0])} ${f(p[i][1])}`;
    return d;
  }
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} `
      + `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

function length(p) {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return l;
}

export function createPen(svg, seed) {
  const rand = seeded(seed);
  const jit = (amp) => (rand() - 0.5) * 2 * amp;
  const timed = []; // [element, delay, duration] in pen units (stroke length), rescaled in finish()
  let clock = 0;
  let layer = svg;

  function add(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    layer.appendChild(el);
    return el;
  }

  /** Hand wobble: a random shift plus one slow sideways wave along the stroke. */
  function wobble(points, rough) {
    const dx = jit(rough), dy = jit(rough);
    const freq = 1 + rand(), phase = rand() * Math.PI * 2, amp = rough * 0.8;
    const total = length(points) || 1;
    let s = 0;
    return points.map((pt, i) => {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if (i > 0) s += Math.hypot(pt[0] - points[i - 1][0], pt[1] - points[i - 1][1]);
      const w = amp * Math.sin((s / total) * Math.PI * 2 * freq + phase);
      return [pt[0] + dx - ((b[1] - a[1]) / tl) * w, pt[1] + dy + ((b[0] - a[0]) / tl) * w];
    });
  }

  /**
   * Emits one stroke. Options: tone (ink|faint|blue|orange|purple|green|red), width, passes,
   * rough, dash, flow (dashes that move), fill (colour), sharp (straight segments).
   */
  function emit(points, o = {}) {
    const tone = o.tone ?? 'ink';
    const passes = o.passes ?? (tone === 'faint' || o.fill ? 1 : 2);
    const rough = o.rough ?? 1.1;
    const len = length(points);
    for (let k = 0; k < passes; k++) {
      const d = toPath(wobble(points, k === 0 ? rough : rough * 1.4), o.sharp);
      const attrs = { d, class: `s t-${tone}${o.dash ? ' dash' : ''}${o.flow ? ' flow' : ''}${k ? ' again' : ''}` };
      if (o.width) attrs['stroke-width'] = o.width;
      if (o.fill) { attrs.fill = o.fill; attrs.class += ' filled'; }
      if (!o.dash) attrs.pathLength = 1;
      timed.push([add('path', attrs), clock + k * len * 0.35, len]);
    }
    clock += len;
  }

  const pen = {
    line(x1, y1, x2, y2, o = {}) {
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const over = o.overshoot ?? 1;
      const a0 = over * (1 + rand() * 2), a1 = over * (2 + rand() * 4);
      const bow = jit(l * 0.012);
      emit([
        [x1 - ux * a0, y1 - uy * a0],
        [(x1 + x2) / 2 - uy * bow, (y1 + y2) / 2 + ux * bow],
        [x2 + ux * a1, y2 + uy * a1],
      ], o);
    },
    /** Each edge is its own stroke, so corners cross like in a real sketch. */
    poly(points, o = {}) {
      const n = o.closed ? points.length : points.length - 1;
      for (let i = 0; i < n; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        pen.line(a[0], a[1], b[0], b[1], o);
      }
    },
    rect(x, y, w, h, o) {
      pen.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, closed: true });
    },
    /** One continuous stroke through the points; use it for fills and silhouettes. */
    shape(points, o = {}) {
      emit(o.closed ? [...points, points[0]] : points, { ...o, overshoot: 0 });
    },
    smooth(points, o) { emit(points, o); },
    ellipsePoints(cx, cy, rx, ry, o = {}) {
      const full = o.from === undefined;
      const a0 = full ? rand() * Math.PI * 2 : o.from;
      const a1 = full ? a0 + Math.PI * 2 + 0.25 + rand() * 0.2 : o.to;
      const rot = ((o.rot ?? 0) * Math.PI) / 180, c = Math.cos(rot), s = Math.sin(rot);
      const n = Math.max(10, Math.ceil((Math.abs(a1 - a0) * (rx + ry)) / 2 / 5));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = a0 + ((a1 - a0) * i) / n;
        const x = rx * Math.cos(t), y = ry * Math.sin(t);
        pts.push([cx + x * c - y * s, cy + x * s + y * c]);
      }
      return pts;
    },
    /** Full ellipse, or an arc with from/to in radians (0 = +x, angles grow clockwise on screen). */
    ellipse(cx, cy, rx, ry, o = {}) { emit(pen.ellipsePoints(cx, cy, rx, ry, o), o); },
    circle(cx, cy, r, o) { pen.ellipse(cx, cy, r, r, o); },
    arrowHead(x, y, angle, o = {}) {
      const size = o.size ?? 7;
      for (const side of [-1, 1]) {
        const a = angle + Math.PI + side * 0.45;
        pen.line(x, y, x + Math.cos(a) * size, y + Math.sin(a) * size, { ...o, dash: false, flow: false, overshoot: 0.3 });
      }
    },
    arrow(x1, y1, x2, y2, o = {}) {
      pen.line(x1, y1, x2, y2, { ...o, overshoot: 0 });
      pen.arrowHead(x2, y2, Math.atan2(y2 - y1, x2 - x1), o);
    },
    arcArrow(cx, cy, rx, ry, o) {
      const pts = pen.ellipsePoints(cx, cy, rx, ry, o);
      emit(pts, o);
      const [a, b] = pts.slice(-2);
      pen.arrowHead(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), o);
    },
    /** Parallel strokes clipped to a polygon (any shape: intersections are paired along each line). */
    hatch(polygon, o = {}) {
      const gap = o.gap ?? 6, ang = ((o.angle ?? -45) * Math.PI) / 180;
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const proj = polygon.map(([x, y]) => x * nx + y * ny);
      for (let c = Math.min(...proj) + gap / 2; c < Math.max(...proj); c += gap) {
        const hits = [];
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length];
          const pa = a[0] * nx + a[1] * ny - c, pb = b[0] * nx + b[1] * ny - c;
          if ((pa < 0) === (pb < 0)) continue;
          const t = pa / (pa - pb);
          hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
        hits.sort((p, q) => (p[0] * ux + p[1] * uy) - (q[0] * ux + q[1] * uy));
        for (let i = 0; i + 1 < hits.length; i += 2) {
          pen.line(hits[i][0], hits[i][1], hits[i + 1][0], hits[i + 1][1], { tone: 'faint', passes: 1, overshoot: 0.4, rough: 0.5, ...o });
        }
      }
    },
    dot(x, y, r, o = {}) {
      const el = add('circle', { cx: f(x), cy: f(y), r, class: `d t-${o.tone ?? 'ink'}` });
      timed.push([el, clock, 0.25 * PEN_SPEED]);
      clock += o.step ?? 3;
    },
    text(x, y, str, o = {}) {
      const el = add('text', { x, y, class: `lbl t-${o.tone ?? 'faint'}`, 'text-anchor': o.anchor ?? 'start' });
      el.textContent = str;
      timed.push([el, clock, 0.4 * PEN_SPEED]);
    },
    /** Runs fn with strokes going into a <g>; `origin` is the pivot of its idle animation. */
    group(cls, fn, o = {}) {
      const g = add('g', { class: cls });
      if (o.origin) g.style.transformOrigin = `${o.origin[0]}px ${o.origin[1]}px`;
      const outer = layer;
      layer = g;
      fn();
      layer = outer;
      return g;
    },
    /** Rescales the pen time so the sketch draws in at most MAX_DRAW seconds. */
    finish() {
      const total = clock / PEN_SPEED;
      const k = Math.min(1, MAX_DRAW / total);
      for (const [el, delay, dur] of timed) {
        el.style.setProperty('--d', `${((delay / PEN_SPEED) * k).toFixed(3)}s`);
        el.style.setProperty('--t', `${Math.max(0.04, (dur / PEN_SPEED) * k).toFixed(3)}s`);
      }
      svg.style.setProperty('--after', `${(total * k).toFixed(2)}s`);
    },
  };
  return pen;
}
