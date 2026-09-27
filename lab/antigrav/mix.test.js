import { test } from 'node:test';
import assert from 'node:assert/strict';
import { busGains, doppler, distanceGain, panFor, crossfade, dbToGain, hissGain, scrapeGain, engineLayers, passBy, LEVEL } from './mix.js';

test('mute silences everything and music off keeps the effects (catches: a music toggle that mutes the engine)', () => {
  assert.deepEqual(busGains({ muted: true, music: true }).master, 0);
  const noMusic = busGains({ muted: false, music: false });
  assert.equal(noMusic.master, 1);
  assert.equal(noMusic.music, 0);
  assert.equal(noMusic.sfx, LEVEL.sfx);
  assert.ok(busGains().music > 0);
});

test('decibels convert to gain (catches: dB used as a linear factor)', () => {
  assert.ok(Math.abs(dbToGain(-6) - 0.501) < 1e-3);
  assert.equal(dbToGain(0), 1);
});

test('a closing ship sounds higher and a receding one lower (catches: the Doppler sign flipped)', () => {
  assert.ok(doppler(30) > 1 && doppler(-30) < 1);
  assert.equal(doppler(0), 1);
  assert.ok(doppler(10000) <= 2 && doppler(-10000) >= 0.5);
});

test('a rival passing at 100 m/s shifts pitch by less than a fifth (catches: a Doppler so strong the rivals wobble)', () => {
  assert.ok(doppler(100) < 1.2 && doppler(-100) > 0.85, `${doppler(100)} ${doppler(-100)}`);
});

test('other ships fade with distance and pan to their side (catches: pan mirrored left-right)', () => {
  assert.ok(distanceGain(5) > 0.9 && distanceGain(100) < 0.1 && distanceGain(500) === 0);
  assert.ok(panFor(5, 10) > 0 && panFor(-5, 10) < 0);
  assert.ok(Math.abs(panFor(5, 200)) < Math.abs(panFor(5, 5)));
});

test('the music crossfade keeps the power constant (catches: a linear fade that dips in the middle)', () => {
  for (let x = 0; x <= 1; x += 0.05) {
    const [a, b] = crossfade(x);
    assert.ok(Math.abs(a * a + b * b - 1) < 1e-12);
  }
  assert.deepEqual(crossfade(0).map(Math.round), [1, 0]);
  assert.deepEqual(crossfade(1).map(Math.round), [0, 1]);
});

test('airbrake hiss and scrape are silent at rest and when not in use (catches: a hiss on the grid)', () => {
  assert.equal(hissGain(2, 0), 0);
  assert.equal(hissGain(0, 140), 0);
  assert.ok(hissGain(2, 140) > hissGain(1, 140));
  assert.equal(scrapeGain(false, 140), 0);
  assert.ok(scrapeGain(true, 140) > scrapeGain(true, 30));
});

test('the turbine whine climbs with speed in small smooth steps and a pad lifts it (catches: a stepped or throttle-only pitch)', () => {
  let prev = engineLayers(0, 1).whine.freq;
  for (let v = 1; v <= 180; v++) {
    const f = engineLayers(v, 1).whine.freq;
    assert.ok(f > prev && f - prev < 15, `${prev} -> ${f} Hz at ${v} m/s`);
    prev = f;
  }
  assert.ok(engineLayers(140, 1, 1).whine.freq > engineLayers(140, 1).whine.freq, 'a pad lifts the whine');
  assert.equal(engineLayers(90, 1).shimmer.freq, 2 * engineLayers(90, 1).whine.freq);
});

test('the rumble follows the thrust, not the speed (catches: a sub layer tied to speed that drones on when coasting)', () => {
  const coastFast = engineLayers(140, 0), pushSlow = engineLayers(40, 1);
  assert.ok(pushSlow.sub.gain > coastFast.sub.gain && pushSlow.rumble.gain > coastFast.rumble.gain);
});

test('the air rush is silent at rest and loud flat out (catches: wind tied to throttle)', () => {
  assert.equal(engineLayers(0, 1).wind.gain, 0);
  assert.ok(engineLayers(140, 0).wind.gain > 3 * engineLayers(70, 1).wind.gain);
  assert.ok(engineLayers(140, 0).wind.freq > engineLayers(70, 0).wind.freq);
});

test('the engine layers leave headroom at any speed, throttle and boost (catches: a mix that clips flat out on a pad)', () => {
  for (const v of [0, 40, 100, 140, 200]) {
    for (const u of [0, 1]) {
      for (const b of [0, 1]) {
        const L = engineLayers(v, u, b);
        const sum = Object.values(L).reduce((acc, layer) => acc + layer.gain, 0);
        assert.ok(sum <= 1, `sum ${sum} at ${v} m/s, u ${u}, boost ${b}`);
      }
    }
  }
});

test('a pass-by fires when a close ship crosses the player, not when it is far off or keeps pace (catches: a whoosh every frame)', () => {
  assert.equal(passBy(4, -3, 3, 25), true);
  assert.equal(passBy(-4, 3, -2, -20), true);
  assert.equal(passBy(null, -3, 3, 25), false);
  assert.equal(passBy(4, 3, 3, 25), false);
  assert.equal(passBy(4, -3, 40, 25), false);
  assert.equal(passBy(4, -3, 3, 2), false);
});
