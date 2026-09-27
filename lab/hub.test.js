import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { EXPERIMENTS } from './experiments.js';
import * as sketches from './lib/sketches.js';
import { createPen } from './lib/sketch.js';

// Minimal SVG DOM: enough for the pen to build its elements.
function fakeElement() {
  return {
    attrs: {}, children: [], style: { setProperty() {} },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { this.children.push(c); return c; },
  };
}
globalThis.document = { createElementNS: () => fakeElement() };

// Catches: a card that links to a folder that was renamed or never built (a 404 on the index).
test('every open experiment links to a prototype that exists', () => {
  for (const exp of EXPERIMENTS.filter((e) => e.open)) {
    assert.ok(existsSync(new URL(`./${exp.slug}/index.html`, import.meta.url)), exp.slug);
  }
});

// Catches: a typo in hand-placed sketch coordinates that yields NaN and an invisible, broken path.
test('every sketch draws finite paths inside its paper', () => {
  for (const exp of EXPERIMENTS) {
    assert.equal(typeof sketches[exp.draw], 'function', exp.draw);
    const paper = fakeElement();
    sketches[exp.draw](createPen(paper, 1));
    const all = [];
    const walk = (el) => { all.push(el); el.children.forEach(walk); };
    walk(paper);
    const paths = all.filter((el) => el.attrs.d);
    assert.ok(paths.length > 20, `${exp.draw} drew only ${paths.length} strokes`);
    for (const el of paths) {
      const nums = el.attrs.d.match(/-?\d+(\.\d+)?|NaN|Infinity/g);
      assert.ok(nums.every((n) => Number.isFinite(Number(n))), `${exp.draw}: ${el.attrs.d.slice(0, 60)}`);
      for (let i = 0; i < nums.length; i += 2) {
        const x = Number(nums[i]), y = Number(nums[i + 1]);
        assert.ok(x > -20 && x < 420 && y > -20 && y < 280, `${exp.draw} strays off the paper at ${x},${y}`);
      }
    }
  }
});
