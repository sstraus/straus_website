import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRace, updateRace, gridSlots, canDrive, placeFraction, formatTime, ordinal } from './race.js';
import { ring } from './testing.js';

const track = { ...ring({ length: 1000 }), startS: 100 };
const fakeShip = (dist) => ({ dist });
const DT = 1 / 120;
const advance = (race, seconds, speeds, events) => {
  for (let t = 0; t < seconds; t += DT) {
    race.entries.forEach((e, i) => { e.ship.dist += speeds[i] * DT; });
    updateRace(race, DT, events);
  }
};

test('the countdown calls 3, 2, 1, GO once each and locks the controls until GO (catches: a false start)', () => {
  const race = createRace(track, [fakeShip(90)]);
  const events = [];
  for (let t = 0; t < 2.9; t += DT) { updateRace(race, DT, events); assert.equal(canDrive(race), false); }
  updateRace(race, 0.2, events);
  assert.deepEqual(events.map((e) => e.n ?? e.type), [3, 2, 1, 'go']);
  assert.equal(canDrive(race), true);
});

test('a lap counts after one full length past the line, not when the grid first crosses it (catches: a free lap at the start)', () => {
  const [slot] = gridSlots(track, 1);
  const race = createRace(track, [fakeShip(slot.s)]);
  race.phase = 'race';
  const events = [];
  advance(race, 1, [100], events);                  // crosses the line after 0.1 s
  assert.equal(race.entries[0].laps, 0);
  advance(race, 9.5, [100], events);
  assert.equal(race.entries[0].laps, 1);
  assert.ok(Math.abs(race.entries[0].times[0] - 10.1) < 0.02, `lap ${race.entries[0].times[0]}`);
  assert.equal(events.filter((e) => e.type === 'lap').length, 1);
});

test('best lap is the fastest one and the finish comes once, after the last lap (catches: best = last lap)', () => {
  const race = createRace(track, [fakeShip(100)], { laps: 3 });
  race.phase = 'race';
  const events = [];
  advance(race, 10.05, [100], events);
  advance(race, 5.05, [200], events);
  advance(race, 20, [50], events);
  const e = race.entries[0];
  assert.equal(e.laps, 3);
  assert.ok(Math.abs(e.best - 5) < 0.05, `best ${e.best}`);
  assert.equal(events.filter((x) => x.type === 'finish').length, 1);
  assert.equal(race.phase, 'finished');
  advance(race, 30, [100], events);
  assert.equal(e.times.length, 3);
});

test('places follow the distance run, and a finished ship stays ahead of the others (catches: places by position on the lap)', () => {
  const race = createRace(track, [fakeShip(100), fakeShip(100), fakeShip(100)], { laps: 1, player: 2 });
  race.phase = 'race';
  race.entries[1].ship.dist = 100 + 1200;           // one lap and a bit: finishes
  race.entries[0].ship.dist = 100 + 950;             // almost a lap
  race.entries[2].ship.dist = 100 + 990;             // further on the same lap
  updateRace(race, DT);
  assert.deepEqual(race.entries.map((e) => e.place), [3, 1, 2]);
  assert.equal(placeFraction(race, race.entries[1]), 0);
  assert.equal(placeFraction(race, race.entries[0]), 1);
});

test('the grid lines up behind the start line in two columns (catches: ships stacked in one spot)', () => {
  const g = gridSlots(track, 4);
  assert.ok(g.every((x) => x.s < track.startS));
  assert.equal(new Set(g.map((x) => `${x.s},${x.d}`)).size, 4);
});

test('times and places read like a race (catches: 1:5.3 instead of 1:05.30, 11st)', () => {
  assert.equal(formatTime(65.3), '1:05.30');
  assert.equal(formatTime(9.876), '0:09.88');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st']);
});
