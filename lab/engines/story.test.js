// Run with: node --test lab/engines/
import test from 'node:test';
import assert from 'node:assert/strict';
import { sentence } from './story.js';
import { movingPartCount } from './physics.js';

// Every state the page can reach, so no branch of the story escapes the checks.
function* states() {
  for (const rpm of [0, 0.5, 400, 799, 800, 2500, 4000, 6000, 6500]) {
    for (const view of ['both', 'engine', 'motor']) {
      for (const exploded of [false, true]) {
        for (let beat = 0; beat < 9; beat++) yield { rpm, view, exploded, beat };
      }
    }
  }
}

const JARGON = /TDC|BDC|stoichiometr|polytrop|Wiebe|back-?EMF|flux|MMF|\b[dq]-axis|BMEP|stator|phasor|harmonic|enthalp|adiabat|torque/i;

test('no live sentence uses engineering jargon (catches the essay vocabulary leaking into the main UI)', () => {
  for (const state of states()) {
    const text = sentence(state);
    assert.ok(!JARGON.test(text), `${JSON.stringify(state)} → "${text}"`);
  }
});

test('every live sentence reads at a glance (catches a paragraph where one line belongs)', () => {
  for (const state of states()) {
    const text = sentence(state);
    assert.ok(text.length > 0 && text.length <= 72, `${text.length} chars: "${text}"`);
  }
});

test('below idle the story says the engine stalls (catches an engine described as running from zero)', () => {
  assert.match(sentence({ rpm: 400, view: 'both', exploded: false, beat: 0 }), /stalls/);
  assert.match(sentence({ rpm: 400, view: 'engine', exploded: false, beat: 3 }), /cannot keep itself turning/);
  // The motor alone has nothing to say about stalling.
  assert.doesNotMatch(sentence({ rpm: 400, view: 'motor', exploded: false, beat: 0 }), /stall/);
});

test('each machine view tells only its own story (catches coils described in the engine-only view)', () => {
  for (let beat = 0; beat < 12; beat++) {
    assert.doesNotMatch(sentence({ rpm: 3000, view: 'engine', exploded: false, beat }), /coil|magnet|rotor|motor/i);
    assert.doesNotMatch(sentence({ rpm: 3000, view: 'motor', exploded: false, beat }), /cylinder|fuel|cam|valve(s)? open/i);
  }
});

test('both machines on screen take turns in the story (catches one machine never mentioned)', () => {
  const texts = Array.from({ length: 7 }, (_, beat) => sentence({ rpm: 3000, view: 'both', exploded: false, beat }));
  assert.ok(texts.some((t) => /cylinder|engine|fuel/i.test(t)));
  assert.ok(texts.some((t) => /coil|motor|rotor/i.test(t)));
});

test('the exploded view counts the moving parts from the physics (catches a hard-coded count that drifts)', () => {
  const text = sentence({ rpm: 3000, view: 'both', exploded: true, beat: 0 });
  assert.ok(text.includes(String(movingPartCount('engine'))), text);
});

test('the fire rate is two fires per crank turn (catches four fires per turn for four cylinders)', () => {
  assert.match(sentence({ rpm: 6000, view: 'engine', exploded: false, beat: 1 }), /fires 200 times a second/);
});
