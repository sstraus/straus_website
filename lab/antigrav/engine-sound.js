// The player's engine as a Web Audio graph: sines and filtered noise only (no square or saw at an
// audible level, no recorded loop, so no seam). The levels come from engineLayers() in mix.js.
// It takes any BaseAudioContext, so the game and an offline render share one path.
//
//   whine    two sines, f and 2.01 f (a slow shimmer between them), soft low-pass
//   shimmer  noise through a narrow band-pass at 2 f: the air of the turbine blades
//   sub      a sine at 36-52 Hz, and rumble: noise under a low-pass, both with the thrust
//   hum      the field's electric hum: 100 Hz and a weaker 200 Hz
//   wind     noise through a wide band-pass that rises with speed
// Everything meets in one gain and a gentle compressor, so the engine never clips.

import { engineLayers } from './mix.js';

const LEVEL = 0.3;       // engine bus: under the music, the compressor only catches peaks
const GLIDE = 0.05;      // s, time constant of every parameter change: no zipper noise

// Two seconds of white noise; loops without a seam that the ear can find.
export function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function createEngine(ctx, out, noise = noiseBuffer(ctx)) {
  const silent = () => { const g = ctx.createGain(); g.gain.value = 0; return g; };
  const filter = (type, freq, q) => {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  };
  const sine = (freq) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq; return o; };
  const noiseSource = () => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    return src;
  };

  const bus = ctx.createGain();
  bus.gain.value = LEVEL;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 4;
  comp.attack.value = 0.005; comp.release.value = 0.2;
  bus.connect(comp).connect(out);

  const whine = [sine(150), sine(301.5)], whineGain = silent(), whineLp = filter('lowpass', 4000, 0.5);
  const partial = ctx.createGain();
  partial.gain.value = 0.3;
  whine[0].connect(whineLp);
  whine[1].connect(partial).connect(whineLp);
  whineLp.connect(whineGain).connect(bus);

  const shimmerSrc = noiseSource(), shimmerBp = filter('bandpass', 300, 10), shimmerGain = silent();
  shimmerSrc.connect(shimmerBp).connect(shimmerGain).connect(bus);

  const sub = sine(36), subGain = silent();
  sub.connect(subGain).connect(bus);
  const rumbleSrc = noiseSource(), rumbleLp = filter('lowpass', 110, 0.7), rumbleGain = silent();
  rumbleSrc.connect(rumbleLp).connect(rumbleGain).connect(bus);

  const hum = [sine(100), sine(200)], humGain = silent(), humHalf = ctx.createGain();
  humHalf.gain.value = 0.4;
  hum[0].connect(humGain);
  hum[1].connect(humHalf).connect(humGain);
  humGain.connect(bus);

  const windSrc = noiseSource(), windBp = filter('bandpass', 300, 0.7), windGain = silent();
  windSrc.connect(windBp).connect(windGain).connect(bus);

  for (const s of [...whine, shimmerSrc, sub, rumbleSrc, ...hum, windSrc]) s.start();

  return {
    // Drive the layers from the simulation at context time `t` (default: now).
    set(speed, throttle, boost = 0, t = ctx.currentTime) {
      const L = engineLayers(speed, throttle, boost);
      const to = (param, value) => param.setTargetAtTime(value, t, GLIDE);
      to(whine[0].frequency, L.whine.freq);
      to(whine[1].frequency, L.whine.freq * 2.01);
      to(whineGain.gain, L.whine.gain);
      to(shimmerBp.frequency, L.shimmer.freq);
      to(shimmerGain.gain, L.shimmer.gain);
      to(sub.frequency, L.sub.freq);
      to(subGain.gain, L.sub.gain);
      to(rumbleLp.frequency, L.rumble.cutoff);
      to(rumbleGain.gain, L.rumble.gain);
      to(humGain.gain, L.hum.gain);
      to(windBp.frequency, L.wind.freq);
      to(windGain.gain, L.wind.gain);
    },
  };
}
