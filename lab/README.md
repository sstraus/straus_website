# Lab

A virtual lab of interactive 3D benches: each one opens up a piece of advanced technology or
physics that people hear about but cannot see working. No build step: plain ES modules and
three.js r186 (WebGPU, with a WebGL 2 fallback via `?webgl`), loaded from jsDelivr through
`lib/importmap.js`.

## Layout

```
lab/
  index.html, hub.js, hub.css   the lab index: one pen-sketch card per bench
  experiments.js                the card list; `open: false` = on the drawing board
  hub.test.js                   every open card has a page and a sketch
  lib/
    importmap.js                pins the three.js version (classic script, before any module)
    intro.js, intro-core.js     the shared loader: pen sketch, progress, precompile, warm-up
    intro.css
    sketch.js, sketches.js      the pen renderer and one sketch per bench (hub + loader)
    links.js, links.css         "← Lab" and "Follow for more", on every page
    rigid-body.js               torque-free rigid body (RK4 + quaternion), tested
    models/racket.js            tennis racket: inertia data and procedural mesh
  <bench>/                      one folder per published bench
  proto/                        benches in progress; not linked from the index
```

`lib/` also still holds the modules of the first lab framework (`bench.js`, `stage.js`,
`panel.js`, …). No published bench uses them.

## Build a bench

Work in `proto/<name>/` and follow `proto/README.md`: it is the shared brief (quality bar, UX
rules, loader standard, links, pan, techniques and lessons learned).

## Publish a bench

1. Move `proto/<name>/` to `lab/<name>/` and change `../../lib/` to `../lib/`.
2. Set `open: true` for it in `experiments.js`.
3. Add the URL to `sitemap.xml` and to the Lab list in the site `index.html`, and bump the
   site version (see the project `AGENTS.md`).
4. Run `node --test lab/ tests/lab/` and check the page in a browser: WebGPU and `?webgl`,
   a 390×844 phone and a desktop window, and a resize after load.
