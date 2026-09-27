// Sound: CC0 recordings (see audio/CREDITS.md) plus Web Audio synthesis, driven by the
// simulation. The player's engine is synthesized in engine-sound.js (turbine whine, sub rumble,
// field hum, air rush). Boost whooshes, pass-bys and the mine's crackle are filtered noise. Two buses (effects, music) under a master gain.
// Nothing plays before the first gesture; the context suspends while the tab is hidden. The
// maths lives in mix.js (tested).

import { createEngine, noiseBuffer } from './engine-sound.js';
import {
  busGains, doppler, distanceGain, panFor, passBy, crossfade, hissGain, scrapeGain, impactGain, clamp,
} from './mix.js';

const BASE = new URL('audio/', import.meta.url);
const SFX = ['engine-ai', 'airbrake', 'scrape', 'mine-hum', 'impact', 'impact-light', 'pad', 'pickup',
  'shot', 'explosion', 'explosion-low', 'mine-drop', 'shield', 'shield-pop', 'count', 'go', 'lap', 'finish'];
const MUSIC = ['music-winning-the-race', 'music-hyperflight-racing', 'music-hyper-ultra-racing'];
const FADE = 3;                // s of music crossfade
const LOOP_TRIM = 0.03;        // s cut from both ends of a loop: hides the mp3 encoder padding
const STORE = { muted: 'antigrav.muted', music: 'antigrav.music' };

const probe = typeof Audio === 'function' ? new Audio() : null;
const EXT = probe && probe.canPlayType('audio/ogg; codecs=opus') ? 'ogg' : 'mp3';
const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; } };
const write = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* private mode */ } };

export function createAudio() {
  const state = { muted: read(STORE.muted, false), music: read(STORE.music, true) };
  const buffers = new Map();
  let ctx = null, master, sfxBus, musicBus, loops = null, aiVoices = [], engine = null, noise = null;
  let prevAlong = [];
  const listeners = [];
  let tracks = null, trackIndex = 0, hidden = false;

  function applyBuses() {
    if (!ctx) return;
    const g = busGains(state), t = ctx.currentTime;
    master.gain.setTargetAtTime(g.master, t, 0.05);
    sfxBus.gain.setTargetAtTime(g.sfx, t, 0.05);
    musicBus.gain.setTargetAtTime(g.music, t, 0.3);
    if (tracks) for (const tr of tracks) if (!state.music || state.muted) tr.el.pause(); else if (tr.playing) tr.el.play().catch(() => {});
  }

  async function load(name) {
    const res = await fetch(new URL(`${name}.${EXT}`, BASE));
    if (!res.ok) throw new Error(`${name}.${EXT}: HTTP ${res.status}`);
    buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
  }

  // A looping voice: source -> filter -> gain -> panner -> bus. Starts silent.
  function loopVoice(name, { filter = false } = {}) {
    const buf = buffers.get(name);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = LOOP_TRIM;
    src.loopEnd = buf.duration - LOOP_TRIM;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    let head = src;
    let lp = null;
    if (filter) { lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7; src.connect(lp); head = lp; }
    head.connect(gain).connect(pan).connect(sfxBus);
    src.start(0, LOOP_TRIM + Math.random() * (buf.duration - 2 * LOOP_TRIM));
    return { src, gain, pan, lp };
  }

  const noiseSource = () => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    return src;
  };
  const filter = (type, freq, q = 1) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };

  // A whoosh: noise through a band-pass that sweeps from f0 to f1, panned from pan0 to pan1.
  function whoosh({ gain = 0.5, dur = 0.6, f0 = 400, f1 = 4000, q = 1.2, pan0 = 0, pan1 = 0, type = 'bandpass' } = {}) {
    if (!ctx || hidden || !noise || gain <= 0.01) return;
    const t = ctx.currentTime;
    const src = noiseSource(), bp = filter(type, f0, q), g = ctx.createGain(), p = ctx.createStereoPanner();
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.setValueAtTime(clamp(pan0, -1, 1), t);
    p.pan.linearRampToValueAtTime(clamp(pan1, -1, 1), t + dur);
    src.connect(bp).connect(g).connect(p).connect(sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function startMusic() {
    tracks = [0, 1].map(() => {
      const el = new Audio();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(musicBus);
      return { el, gain, playing: false };
    });
    playTrack(0, trackIndex, 1.2);
    tracks.forEach((tr, slot) => tr.el.addEventListener('timeupdate', () => {
      if (!tr.playing || tracks[1 - slot].playing) return;
      if (tr.el.duration - tr.el.currentTime < FADE) {
        trackIndex = (trackIndex + 1) % MUSIC.length;
        playTrack(1 - slot, trackIndex, FADE);
        fadeOut(slot, FADE);
      }
    }));
  }

  function playTrack(slot, index, fade) {
    const tr = tracks[slot];
    tr.el.src = new URL(`${MUSIC[index]}.${EXT}`, BASE).href;
    tr.playing = true;
    if (state.music && !state.muted && !hidden) tr.el.play().catch(() => {});
    ramp(tr.gain, 0, 1, fade);
  }

  function fadeOut(slot, fade) {
    const tr = tracks[slot];
    ramp(tr.gain, 1, 0, fade, () => { tr.el.pause(); tr.playing = false; });
  }

  // Equal-power ramp on a gain node, sampled as a value curve.
  function ramp(node, from, to, seconds, done) {
    const n = 32, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const [a, b] = crossfade(i / (n - 1)); curve[i] = from * a + to * b; }
    const g = node.gain, t = ctx.currentTime;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
    try {
      g.setValueCurveAtTime(curve, t, seconds);
    } catch {
      g.linearRampToValueAtTime(to, t + seconds);   // a curve still running overlaps: plain ramp
    }
    if (done) setTimeout(done, seconds * 1000 + 50);
  }

  // First gesture: build the graph, then decode the effects in the background.
  async function unlock() {
    if (ctx) { wake(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC({ latencyHint: 'interactive' });
    // A context made in an event that is not a user activation (a wheel turn, a touch that has not
    // lifted yet) starts suspended, and the first gesture is spent: every later activation retries.
    for (const type of ['pointerup', 'keydown', 'touchend']) window.addEventListener(type, wake, true);
    master = ctx.createGain();
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    applyBuses();
    startMusic();
    noise = noiseBuffer(ctx);
    engine = createEngine(ctx, sfxBus, noise);
    await Promise.all(SFX.map(load));
    loops = {
      hiss: loopVoice('airbrake'),
      scrape: loopVoice('scrape'),
      hum: loopVoice('mine-hum'),
    };
    aiVoices = [];
  }

  function play(name, { gain = 1, rate = 1, pan = 0 } = {}) {
    if (!ctx || hidden || !buffers.has(name) || gain <= 0.01) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers.get(name);
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    src.connect(g).connect(p).connect(sfxBus);
    src.start();
  }

  // Per-frame update from the simulation.
  // me: { speed, throttle, brakes, scraping, dragged, boost }
  // others: [{ along, side, closing }] relative to the player (m, m, m/s).
  function update(me, others) {
    if (!ctx) return;
    const t = ctx.currentTime, k = 0.04;
    if (engine) engine.set(me.speed, me.throttle, me.boost, t);
    // Pass-bys: a whoosh that sweeps across from the side the other ship passes on.
    others.forEach((o, i) => {
      if (passBy(prevAlong[i] ?? null, o.along, o.side, o.closing)) {
        const from = panFor(o.side, 0);
        whoosh({ gain: clamp(Math.abs(o.closing) / 60, 0.15, 0.6), dur: 0.5, f0: 2400, f1: 500, q: 0.8, pan0: from * 0.4, pan1: from });
      }
      prevAlong[i] = o.along;
    });
    if (!loops) return;
    loops.hiss.gain.gain.setTargetAtTime(hissGain(me.brakes, me.speed), t, 0.06);
    loops.scrape.gain.gain.setTargetAtTime(scrapeGain(me.scraping, me.speed) * 0.7, t, 0.03);
    loops.scrape.src.playbackRate.setTargetAtTime(0.8 + me.speed / 300, t, k);
    loops.hum.gain.gain.setTargetAtTime(me.dragged ? 0.8 : 0, t, 0.05);

    while (aiVoices.length < others.length) aiVoices.push(loopVoice('engine-ai', { filter: true }));
    others.forEach((o, i) => {
      const v = aiVoices[i];
      const dist = Math.hypot(o.along, o.side);
      v.gain.gain.setTargetAtTime(0.9 * distanceGain(dist), t, k);
      v.src.playbackRate.setTargetAtTime(clamp(0.9 * doppler(o.closing), 0.5, 2), t, 0.25);   // slow: a whoosh, not a wobble
      v.pan.pan.setTargetAtTime(panFor(o.side, o.along), t, k);
      v.lp.frequency.setTargetAtTime(o.along < 0 ? 5000 : 2200, t, 0.1);   // ships behind sound brighter
    });
  }

  // Game events -> one-shots. `where(ship)` gives { along, side, mine } relative to the player.
  function event(e, where) {
    if (!ctx) return;
    if (e.type === 'count') return play('count', { gain: 0.7 });
    if (e.type === 'go') return play('go', { gain: 0.8 });
    const w = e.ship ? where(e.ship) : { along: 0, side: 0, mine: true };
    const near = w.mine ? 1 : 0.8 * distanceGain(Math.hypot(w.along, w.side));
    const pan = w.mine ? 0 : panFor(w.side, w.along);
    switch (e.type) {
      case 'wall':
        // Harder hits sound lower and longer: the rate drops with the strength.
        if (w.mine) whoosh({ gain: impactGain(e.strength) * 0.4, dur: 0.25, f0: 5000, f1: 1500, q: 2, pan0: e.side * 0.6, pan1: e.side * 0.6 });
        return play('impact', { gain: impactGain(e.strength) * near, pan: w.mine ? e.side * 0.5 : pan, rate: 1.1 - 0.3 * impactGain(e.strength) + Math.random() * 0.1 });
      case 'land': return play('impact-light', { gain: impactGain(e.strength) * near * 0.8, pan });
      case 'bump': return play('impact-light', { gain: impactGain(e.strength) * near, pan, rate: 1.1 });
      case 'pad':
        if (w.mine) whoosh({ gain: 0.7, dur: 0.9, f0: 300, f1: 5000, q: 0.9 });
        return play('pad', { gain: 0.8 * near, pan });
      case 'item': return w.mine && play('pickup', { gain: 0.7 });
      case 'use':
        if (e.item === 'bolt') return play('shot', { gain: 0.9 * Math.max(near, 0.15), pan });
        if (e.item === 'mine') return play('mine-drop', { gain: 0.8 * near, pan });
        return play('shield', { gain: 0.7 * near, pan });
      case 'hit':
        play(e.item === 'bolt' ? 'explosion' : 'explosion-low', { gain: near, pan });
        if (w.mine) play('explosion-low', { gain: 0.6 });
        // A mine's pulse crackles: high noise, fast and bright.
        if (e.item === 'mine') whoosh({ gain: 0.5 * near, dur: 0.7, f0: 7000, f1: 2500, q: 3, type: 'bandpass', pan0: pan, pan1: -pan });
        return undefined;
      case 'shieldHit': return play('shield-pop', { gain: 0.9 * near, pan });
      case 'lap': return w.mine && play('lap', { gain: 0.6 });
      case 'finish': return w.mine && play('finish', { gain: 0.7 });
      default: return undefined;
    }
  }

  function setMuted(on) { state.muted = on; write(STORE.muted, on); applyBuses(); listeners.forEach((f) => f(state)); }
  function setMusic(on) { state.music = on; write(STORE.music, on); applyBuses(); listeners.forEach((f) => f(state)); }

  function reset() { prevAlong = []; }

  // Resume a suspended (or, in Safari, interrupted) context; the music elements are played again
  // because a play() refused before the activation does not retry by itself.
  function wake() {
    if (hidden || (ctx.state !== 'suspended' && ctx.state !== 'interrupted')) return;
    ctx.resume().then(applyBuses, () => {});
  }

  function setHidden(on) {
    hidden = on;
    if (!ctx) return;
    if (on) { ctx.suspend(); if (tracks) tracks.forEach((tr) => tr.el.pause()); } else { ctx.resume(); applyBuses(); }
  }

  return {
    state, unlock, update, event, setMuted, setMusic, setHidden, reset,
    onChange: (f) => { listeners.push(f); f(state); },
    get ready() { return !!loops; },
  };
}
