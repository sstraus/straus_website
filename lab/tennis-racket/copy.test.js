// Tests for the words on screen. Run with: node --test lab/proto/tennis-racket/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { narrate } from './narrate.js';

// A key name, a key cap or an instruction to press something. "(C)" style title suffixes too.
const KEY_HINT = /<kbd|\bpress\b|\bspace ?bar\b|>\s*space\s*<|\besc(ape)?\b|\bshortcut|\bkey(board)?\b|\([a-z?]\)|\b1 2 3\b/i;

function* states() {
  for (const phase of ['hold', 'flight', 'caught']) {
    for (const axis of ['handle', 'middle', 'face']) {
      for (const zeroG of [false, true]) {
        for (const flips of [0, 1, 2, 3]) {
          for (const flash of [0, 0.5]) {
            yield { phase, axis, twist: 42, flips, rate: 5.45, stable: axis !== 'middle', zeroG, flash };
          }
        }
      }
    }
  }
}

test('the page shows no keyboard hint (catches a shortcut label, which Boss rejects on sight)', () => {
  const html = readFileSync(fileURLToPath(import.meta.resolve('./index.html')), 'utf8');
  const match = html.match(KEY_HINT);
  assert.equal(match, null, `found "${match?.[0]}"`);
});

test('no live sentence mentions a key (catches a hint slipping into the narration)', () => {
  for (const state of states()) {
    const text = narrate(state);
    assert.ok(!KEY_HINT.test(text), `${JSON.stringify(state)} → "${text}"`);
  }
});

test('every reachable state has a finished sentence (catches a missing branch or a NaN number)', () => {
  for (const state of states()) {
    const text = narrate(state);
    assert.ok(typeof text === 'string' && text.length > 20, JSON.stringify(state));
    assert.ok(!/undefined|NaN|Infinity/.test(text), `${JSON.stringify(state)} → "${text}"`);
  }
});
