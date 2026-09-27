import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sentence } from './story.js';

// Every combination the page can reach, so no branch escapes the checks.
function* states() {
  const events = [null];
  for (const type of ['hit', 'shieldHit', 'item', 'use', 'pad', 'wall', 'land', 'lap', 'shot', 'bump', 'off', 'respawn']) {
    for (const item of ['bolt', 'mine', 'shield']) for (const age of [0.1, 3]) events.push({ type, item, result: 'hit', age });
  }
  for (const phase of ['grid', 'countdown', 'race', 'finished']) {
    for (const zone of [null, 'start', 'sweeper', 'drop', 'hairpin', 'pads', 'crest', 'loop', 'twist', 'esses', 'climb', 'tunnel']) {
      for (const event of events) {
        for (const item of [null, 'bolt', 'mine', 'shield']) {
          for (const flag of [false, true]) {
            yield { phase, count: flag ? 2 : 0, zone, air: flag, item, event, place: flag ? 1 : 3, ships: 4, lap: 3, laps: 3, brake: flag };
          }
        }
      }
    }
  }
}

// The tennis bench's rule: any shortcut label is a keyboard hint.
const KEY_HINT = /<kbd|\bpress\b|\bspace ?bar\b|>\s*space\s*<|\besc(ape)?\b|\bshortcut|\bkey(board)?\b|\([a-z?]\)|\b1 2 3\b|\bclick\b|\btap\b/i;
const JARGON = /curvature|centripetal|fictitious|damp|spring constant|eddy|lorentz|m\/s²/i;

test('every live sentence fits one line of 72 characters (catches: a paragraph where one line belongs)', () => {
  for (const s of states()) {
    const text = sentence(s);
    assert.ok(typeof text === 'string' && text.length > 0 && text.length <= 72, `${JSON.stringify(s)} → "${text}"`);
  }
});

test('no sentence names a key or a gesture, and none uses jargon (catches: keyboard hints on a phone)', () => {
  for (const s of states()) {
    const text = sentence(s);
    assert.ok(!KEY_HINT.test(text), `hint: "${text}"`);
    assert.ok(!JARGON.test(text), `jargon: "${text}"`);
  }
});

test('a fresh hit wins over the zone and fades after two seconds (catches: a stale event line)', () => {
  const base = { phase: 'race', zone: 'loop', air: false, item: null, place: 2, ships: 4, lap: 1, laps: 3, brake: false };
  const hit = sentence({ ...base, event: { type: 'hit', item: 'mine', age: 0.5 } });
  assert.match(hit, /mine/i);
  assert.match(sentence({ ...base, event: { type: 'hit', item: 'mine', age: 2.5 } }), /loop/);
});

test('the speed pad line matches the physics (catches: copy that drifts from SHIP.padBoost)', async () => {
  const { SHIP } = await import('./physics.js');
  const text = sentence({ phase: 'race', event: { type: 'pad', age: 0 } });
  assert.ok(text.includes(`+${Math.round(SHIP.padBoost * 3.6)} km/h`), text);
});
