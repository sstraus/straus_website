import { test } from 'node:test';
import assert from 'node:assert/strict';

// A browser stand-in: the Web Audio graph is a stub that accepts every call, the context starts
// suspended (as Chrome makes it outside a user activation), and window keeps its listeners.
const stub = () => new Proxy(function () {}, {
  get: (t, k) => (k === 'then' ? undefined : k in t ? t[k] : (t[k] = stub())),
  apply: (t, self, args) => (args[0] && typeof args[0] === 'object' ? args[0] : stub()),
});
const listeners = new Map();
class FakeContext {
  constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 8000; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
}
for (const m of ['createGain', 'createBiquadFilter', 'createOscillator', 'createBufferSource', 'createDynamicsCompressor',
  'createMediaElementSource', 'createStereoPanner', 'decodeAudioData']) FakeContext.prototype[m] = () => stub();
FakeContext.prototype.destination = stub();
let made = null;
globalThis.window = {
  AudioContext: class extends FakeContext { constructor() { super(); made = this; } },
  addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
};
globalThis.Audio = class { canPlayType() { return ''; } play() { return Promise.resolve(); } pause() {} addEventListener() {} };
globalThis.fetch = () => Promise.reject(new Error('offline'));
const fire = (type) => (listeners.get(type) ?? []).forEach((fn) => fn());
const { createAudio } = await import('./audio.js');

test('a later key or tap wakes a context born suspended (catches: the first gesture was a wheel turn or an unlifted touch, and the race stays silent)', async () => {
  const audio = createAudio();
  await audio.unlock().catch(() => {});       // the effects do not load here: the graph is still built
  assert.equal(made.state, 'suspended');
  fire('keydown');
  assert.equal(made.state, 'running');

  await made.suspend();
  fire('touchend');
  assert.equal(made.state, 'running');
});

test('a gesture does not wake the sound while the page is hidden (catches: a tap on a phone held in portrait plays the paused race)', async () => {
  const audio = createAudio();
  await audio.unlock().catch(() => {});
  audio.setHidden(true);
  fire('pointerup');
  assert.equal(made.state, 'suspended');
  audio.setHidden(false);
  assert.equal(made.state, 'running');
});
