// The bench loader, the same on every bench: the bench's hub pen sketch draws itself in colour as
// the real load progresses, with one plain-words label and a thin bar below. Then it hands off to
// the rendered scene. Also the warm-up helpers: precompile per group, real renders, GPU waits.
//
// Page: <div id="lab-loader" class="lab-loader" data-sketch="ferrofluid" data-seed="110"></div>,
// lab/lib/intro.css, and <script type="module" src="../../lib/intro.js"> right after the import
// map, so the drawing starts before three.js has downloaded. The bench then imports `loader`.
import { createPen } from './sketch.js';
import * as sketches from './sketches.js';
import { createLoadModel, strokeFraction, unitKey, sizeChanged } from './intro-core.js';

const NS = 'http://www.w3.org/2000/svg';

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Resolves when the GPU has finished the work submitted so far (WebGPU), or after a frame (WebGL). */
export function gpuDone(renderer) {
  const queue = renderer.backend?.device?.queue;
  return queue ? queue.onSubmittedWorkDone() : nextFrame();
}

function mount(el) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 260');
  svg.setAttribute('class', 'lab-loader-sketch');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs><filter id="lab-ink" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="grain"/>
    <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
  </filter></defs>`;
  const paper = document.createElementNS(NS, 'g');
  paper.setAttribute('class', 'paper');
  svg.appendChild(paper);
  const pen = createPen(paper, Number(el.dataset.seed ?? 1));
  sketches[el.dataset.sketch](pen);
  pen.finish();

  const status = document.createElement('div');
  status.className = 'lab-loader-status';
  status.setAttribute('role', 'status');
  status.innerHTML = '<span class="lab-loader-label"></span><span class="lab-loader-track"><span class="lab-loader-bar"></span></span>';
  el.append(svg, status);

  // Pen times written by pen.finish(): each stroke draws from --d for --t seconds.
  const total = parseFloat(svg.style.getPropertyValue('--after')) || 1;
  const strokes = [...paper.querySelectorAll('.s, .d, .lbl')].map((node) => ({
    node,
    line: node.classList.contains('s') && !node.classList.contains('dash'),
    delay: parseFloat(node.style.getPropertyValue('--d')) || 0,
    duration: parseFloat(node.style.getPropertyValue('--t')) || 0.05,
    drawn: -1,
  }));
  return { svg, strokes, total, label: status.querySelector('.lab-loader-label'), bar: status.querySelector('.lab-loader-bar') };
}

function createLoader(el) {
  const view = mount(el);
  const model = createLoadModel();
  let running = true;
  let counters = null; // () => cumulative counts, added per step as deltas (see trackRenderer)
  let lastCount = null;
  function annotate(row) {
    if (!counters || !row) return;
    const count = counters();
    for (const key in count) row[key] = count[key] - lastCount[key];
    lastCount = count;
  }
  let last = performance.now();

  function draw(p) {
    view.bar.style.transform = `scaleX(${p.toFixed(4)})`;
    for (const s of view.strokes) {
      const f = strokeFraction(p, s.delay, s.duration, view.total);
      if (Math.abs(f - s.drawn) < 0.004) continue;
      s.drawn = f;
      s.node.style.opacity = f > 0 ? (s.line ? 1 : f) : 0;
      if (s.line) s.node.style.strokeDashoffset = 1 - f;
      if (s.node.classList.contains('filled')) s.node.style.fillOpacity = f;
    }
  }
  function loop(now) {
    if (!running) return;
    draw(model.tick(Math.min(0.1, (now - last) / 1000)));
    last = now;
    requestAnimationFrame(loop);
  }
  view.label.textContent = model.label;
  requestAnimationFrame(loop);
  // A module that did not download fires `error` on its script element (it does not bubble); a module
  // that throws while it loads reaches window. Either way, say so instead of waiting forever.
  const failed = () => new Error('part of the page did not download. Reload to try again.');
  for (const script of document.querySelectorAll('script[type="module"]')) {
    script.addEventListener('error', () => { if (running) fail(failed()); });
  }
  window.addEventListener('error', (event) => { if (running) fail(event.error ?? failed()); });

  function fail(error) {
    running = false;
    el.classList.add('error');
    view.label.textContent = `Could not start: ${error.message}`;
  }

  return {
    get label() { return model.label; },
    /** Expected number of steps, counting the module download as the first one. */
    expect(n) { model.expect(n); },
    /** Start a labelled phase; the previous one gets its timing row. */
    step(label) {
      model.step(label);
      annotate(model.rows.at(-1));
      view.label.textContent = label;
    },
    /** Progress inside the current phase, 0..1. */
    progress(f) { model.progress(f); },
    /** The scene is on screen: the drawing fades out, label and bar move to the bottom. */
    handoff() { el.classList.add('handoff'); },
    /** Loading is over: logs the timing table, keeps it on window.__lab.loadTimes, fades out. */
    ready() {
      const rows = model.finish();
      annotate(rows.at(-2)); // the last step; the final row is the total
      running = false;
      draw(1);
      el.classList.add('handoff', 'done');
      console.table(rows);
      // transferSize is 0 for a response from the HTTP cache: a cold run shows the real download.
      const resources = performance.getEntriesByType('resource');
      const network = {
        requests: resources.length,
        kB: Math.round(resources.reduce((sum, r) => sum + r.transferSize, 0) / 1024),
        lastByteMs: Math.round(Math.max(0, ...resources.map((r) => r.responseEnd))),
      };
      console.log('lab network', network);
      window.__lab = { ...window.__lab, loadTimes: rows, network };
      if (window.__lab.builds?.length) console.table(window.__lab.builds); // precompile misses
      return rows;
    },
    fail,
    /** From now on each timing row also gets the change of these counts during its step. */
    count(fn) {
      counters = fn;
      lastCount = fn();
    },
  };
}

let precompiling = false;
// Milliseconds in render() calls (node builds, pipeline requests: main thread) and waiting for the
// GPU (driver shader compiles, the frame itself). Added to the timing rows by trackRenderer.
const spent = { js: 0, gpu: 0 };
function timedRender(render) {
  const t = performance.now();
  render();
  spent.js += performance.now() - t;
}
async function timedWait(promise) {
  const t = performance.now();
  await promise;
  spent.gpu += performance.now() - t;
}

/** The page's loader, started as soon as this module runs. */
export const loader = createLoader(document.getElementById('lab-loader'));

/**
 * Precompile through the real render path, one labelled loader step per group.
 * `render` is the bench's real frame (e.g. () => pipeline.render()). Everything renderable in the
 * scene is hidden; then each group's objects are shown one at a time and rendered, so every shader
 * is built with the exact contexts, passes, shadow maps and sizes of a real frame. Only one object
 * per shader key is rendered (unitKey): the others reuse its build. Frustum culling is off for the
 * rendered object, so parts outside the current view compile too. Objects that were hidden stay
 * hidden and are not compiled (hide with scale or opacity instead, see the README).
 * groups: [[label, [object3D, ...]], ...].
 */
export async function precompile(renderer, { scene, render, groups }) {
  trackRenderer(renderer);
  sizeViewportCopies(renderer);
  precompiling = true;
  const renderable = (o) => o.isMesh || o.isLine || o.isPoints || o.isSprite;
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const hidden = [];
  scene.traverse((o) => { if (renderable(o) && shown(o)) hidden.push(o); });
  hidden.forEach((o) => { o.visible = false; });
  const wasHidden = new Set(hidden);
  const seen = new Set();
  // Passes (PassNode, GTAO, bloom) render once per node frame, and three advances the node frame
  // once per browser frame. Several renders in one browser frame would draw the scene only the
  // first time, so every other unit would skip the passes and their shadow maps and build later.
  const { nodeFrame } = renderer._nodes;
  // three requests pipelines asynchronously (createRenderPipelineAsync on WebGPU, parallel shader
  // compile on WebGL 2) only in compileAsync; a render creates them one by one. Here the render path
  // requests them asynchronously too, so the driver can compile them in parallel. A draw waits for
  // its pipeline, which does not matter behind the loader; each group then waits for all of them.
  const pipelines = renderer._pipelines;
  const pending = [];
  pipelines.updateForRender = (renderObject) => pipelines.getForRender(renderObject, pending);
  let lastYield = performance.now();
  try {
    for (const [label, objects] of groups) {
      loader.step(label);
      await nextFrame();
      const units = [];
      for (const root of objects) {
        root.traverse((o) => {
          if (!wasHidden.has(o)) return;
          const key = unitKey(o);
          if (!seen.has(key)) { seen.add(key); units.push(o); }
        });
      }
      for (const [i, unit] of units.entries()) {
        // A renderable parent hides its children: show the chain up to the scene for this render.
        const chain = [];
        for (let p = unit; p; p = p.parent) if (wasHidden.has(p)) chain.push(p);
        const culled = unit.frustumCulled;
        chain.forEach((o) => { o.visible = true; });
        unit.frustumCulled = false;
        nodeFrame.update();
        timedRender(render);
        unit.frustumCulled = culled;
        chain.forEach((o) => { o.visible = false; });
        loader.progress((i + 1) / units.length);
        if (performance.now() - lastYield > 100) {
          await timedWait(gpuDone(renderer));
          await nextFrame();
          lastYield = performance.now();
        }
      }
      await timedWait(Promise.all(pending.splice(0)));
    }
  } finally {
    delete pipelines.updateForRender; // back to the prototype method
    hidden.forEach((o) => { o.visible = true; });
    precompiling = false;
  }
}

/**
 * Timing rows get these columns per step: node builds, GPU pipelines and programs created, and the ms
 * spent in render() calls (js: node builds, pipeline requests) and waiting for the GPU (gpu: driver
 * compiles, the frames). A cold run (no GPU shader cache) against a warm one shows the driver share. After precompile, a step that still builds is a precompile miss: each such build is
 * kept on window.__lab.builds with the object (its name, or type and geometry), its nearest named
 * ancestor and the material name, and ready() prints them.
 */
function trackRenderer(renderer) {
  let builds = 0;
  const late = [];
  renderer.debug.onNodeBuilderCreated = (builder, renderObject) => {
    builds += 1;
    if (precompiling) return;
    const { object, material } = renderObject;
    let owner = object.parent;
    while (owner && !owner.name) owner = owner.parent;
    late.push({
      step: loader.label,
      object: object.name || `${object.type}(${object.geometry?.type ?? ''})`,
      in: owner?.name ?? '',
      material: material.name || material.type,
      shadow: material.isShadowPassMaterial === true,
      context: renderObject.context.id,
    });
  };
  loader.count(() => ({
    builds, pipelines: renderer._pipelines.caches.size, programs: renderer.info.memory.programs,
    js: Math.round(spent.js), gpu: Math.round(spent.gpu),
  }));
  window.__lab = { ...window.__lab, builds: late };
}

/**
 * Transmission copies the frame into one framebuffer texture per render target. In three r186 those
 * textures share one image, so after a resize only the first one re-allocates (see sizeChanged): load
 * small, then grow the window, and the copy overflows the others ("touches outside of Texture").
 * Re-allocate each texture whose size changed since its last copy.
 */
function sizeViewportCopies(renderer) {
  const sizes = new WeakMap();
  const copy = renderer.copyFramebufferToTexture.bind(renderer);
  renderer.copyFramebufferToTexture = (texture, rectangle) => {
    if (sizeChanged(sizes, texture)) texture.needsUpdate = true;
    return copy(texture, rectangle);
  };
}

/** Real frames behind the opaque loader, one labelled step each, waiting for the GPU after each. */
export async function warmUp(renderer, frames) {
  for (const [label, render] of frames) {
    loader.step(label);
    await nextFrame();
    timedRender(render); // synchronous: the part that compiles, so the bar can only move around it
    loader.progress(0.5);
    await timedWait(gpuDone(renderer));
    loader.progress(1);
  }
}
