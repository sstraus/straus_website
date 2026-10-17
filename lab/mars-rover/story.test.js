// Run with: node --test lab/proto/mars-rover/
import test from 'node:test';
import assert from 'node:assert/strict';
import { sentence } from './story.js';

function* contexts() {
  for (const phase of ['ready', 'run', 'over']) {
    for (const distance of [0, 40, 200, 3000]) {
      for (const grade of [null, 'perfect', 'good', 'hard']) {
        for (const sky of ['day', 'sunset', 'night', 'dawn']) {
          for (const beat of [0, 1, 2, 3]) {
            yield {
              phase, distance, speed: 11, air: beat === 3 ? 2 : 0, hull: beat === 2 ? 20 : 80, streak: beat + 1,
              last: grade ? { grade, damage: 12, age: beat * 0.9 } : null, sky: { phase: sky }, beat,
            };
          }
        }
      }
    }
  }
}

test('every coach line reads at a glance (catches a paragraph where one line belongs)', () => {
  for (const ctx of contexts()) {
    const text = sentence(ctx);
    assert.ok(text.length > 0 && text.length <= 72, `${text.length} chars: "${text}"`);
  }
});

test('the control is named once, at the start, and nowhere else (catches key hints all over the run)', () => {
  const keyWords = /space|press|key|click|tap(?!s)/i;
  for (const ctx of contexts()) {
    const text = sentence(ctx);
    if (ctx.phase === 'ready' || ctx.phase === 'over') continue;
    assert.ok(!keyWords.test(text), `"${text}"`);
  }
  assert.match(sentence({ phase: 'ready' }), /space/);
});

test('the coach answers the landing that just happened (catches praise after a crash)', () => {
  const base = { phase: 'run', distance: 500, air: 0, hull: 80, streak: 3, sky: { phase: 'day' }, beat: 0 };
  assert.match(sentence({ ...base, last: { grade: 'perfect', age: 0.5 } }), /Clean landing.*3 in a row/);
  assert.match(sentence({ ...base, last: { grade: 'hard', age: 0.5 } }), /sand/);
  assert.match(sentence({ ...base, hull: 20, last: { grade: 'hard', age: 0.5 } }), /Hull at 20 %/);
  // Long after the landing the coach moves on.
  assert.doesNotMatch(sentence({ ...base, last: { grade: 'hard', age: 5 } }), /sand/);
});

test('the facts follow the sky (catches a blue-sunset line at noon)', () => {
  const run = (phase, beat) => sentence({ phase: 'run', distance: 500, air: 0, hull: 90, streak: 0, last: null, sky: { phase }, beat });
  assert.ok([0, 1].some((b) => /sunset/i.test(run('sunset', b))));
  assert.ok([0, 1].some((b) => /Phobos|Deimos/.test(run('night', b))));
  for (let b = 0; b < 3; b++) assert.doesNotMatch(run('day', b), /sunset|Phobos/i);
});

test('the end of the run gives the distance from the game (catches a hard-coded score)', () => {
  assert.match(sentence({ phase: 'over', distance: 1234.4 }), /1234 m/);
});
