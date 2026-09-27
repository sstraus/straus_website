// Mixer maths for audio.js, pure so node can test it. Space is silent: what you hear is what the
// cockpit plays back from the sensors, so the levels follow the simulation, not acoustics. The
// one acoustic trick kept is a Doppler-like pitch shift, because it tells you a ship is closing,
// softened so a rival whooshes past instead of wobbling.

import { SHIP } from './physics.js';

export const LEVEL = { sfx: 0.9, music: 0.42 };
export const DOPPLER_C = 700;           // m/s: twice the speed of sound, so the shift stays gentle

export const dbToGain = (db) => 10 ** (db / 20);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Bus gains from the two toggles. Music off keeps the effects; mute silences everything.
export function busGains({ muted = false, music = true } = {}) {
  return { master: muted ? 0 : 1, sfx: LEVEL.sfx, music: music ? LEVEL.music : 0 };
}

// Pitch factor for a source closing at `closing` m/s (negative = moving away).
export const doppler = (closing) => clamp(DOPPLER_C / (DOPPLER_C - clamp(closing, -200, 200)), 0.5, 2);

// Loudness of another ship at `dist` metres: full within 15 m, fading with distance.
export const distanceGain = (dist) => (dist > 400 ? 0 : 1 / (1 + (dist / 25) ** 2));

// Stereo position from the sideways offset and the distance along the track.
export const panFor = (side, along) => clamp(side / (Math.abs(along) * 0.35 + 6), -1, 1);

// Equal-power crossfade at progress x (0..1): [outgoing, incoming] gains, squares sum to 1.
export const crossfade = (x) => {
  const t = clamp(x, 0, 1);
  return [Math.cos(t * Math.PI / 2), Math.sin(t * Math.PI / 2)];
};

// Airbrake hiss and wall scrape follow the speed.
export const hissGain = (brakes, speed) => clamp(brakes, 0, 2) * 0.35 * clamp(speed / 60, 0, 1.5);
export const scrapeGain = (scraping, speed) => (scraping ? clamp(speed / 80, 0.2, 1.3) : 0);

// One-shot level from an impact strength in m/s (wall, landing, bump).
export const impactGain = (strength) => clamp(strength / 25, 0.15, 1);

// The player's engine, all synthesized (see engine-sound.js): a turbine whine of pure tones whose
// pitch follows the speed, the air of its blades as narrow noise an octave up, a sub tone and a
// low rumble that follow the thrust, the field's electric hum, and the rush of the air (the
// cockpit's flow sensor) rising with speed. The whine is kept quiet at the top of its range, where
// the ear is most sensitive, so it does not tire over a race. Frequencies in Hz, gains 0..1,
// summing to less than 1.
export function engineLayers(speed, throttle, boost = 0) {
  const v = clamp(speed / SHIP.vmax, 0, 1.4), u = clamp(throttle, 0, 1), b = clamp(boost, 0, 1);
  const whine = 150 + 900 * v ** 0.85 + 40 * u + 150 * b;
  const top = Math.min(1, v);
  return {
    whine: { freq: whine, gain: (0.06 + 0.03 * u + 0.03 * b) * (1 - 0.3 * top) },
    shimmer: { freq: 2 * whine, gain: 0.03 + 0.08 * top ** 1.5 },
    sub: { freq: 36 + 16 * top, gain: 0.16 * (0.3 + 0.7 * u) },
    rumble: { cutoff: 110 + 140 * u + 60 * top, gain: 0.22 * (0.2 + 0.8 * u) },
    hum: { freq: 100, gain: 0.02 + 0.015 * u },
    wind: { freq: 250 + 1300 * v ** 1.2, gain: 0.2 * Math.min(1.2, v) ** 2 },
  };
}

// Another ship passes the player: its distance along the track changes sign while it is close
// sideways and the two differ in speed. `prevAlong` is null on the first frame.
export const passBy = (prevAlong, along, side, closing) => prevAlong !== null
  && Math.sign(prevAlong) !== Math.sign(along) && Math.abs(side) < 12 && Math.abs(closing) > 8;
