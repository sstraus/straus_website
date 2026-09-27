// Race rules: grid, countdown, laps, lap times, positions, finish. Pure.
// Progress is the distance run past the start line (ship.dist - startS), so the grid starts
// slightly negative and a lap counts only after one full length of track.

export const LAPS = 3;
export const COUNT = 3;             // 3, 2, 1, GO: one second each

export function gridSlots(track, n) {
  return Array.from({ length: n }, (_, k) => ({ s: track.startS - 10 - 13 * k, d: k % 2 ? 4 : -4 }));
}

export function createRace(track, ships, { laps = LAPS, player = 0 } = {}) {
  return {
    track, laps, player, phase: 'countdown', clock: 0, t: 0, count: COUNT + 1,
    entries: ships.map((ship) => ({ ship, laps: 0, lapStart: 0, times: [], best: Infinity, finish: null, place: 1 })),
  };
}

export const canDrive = (race) => race.phase === 'race' || race.phase === 'finished';
export const progressOf = (race, e) => e.ship.dist - race.track.startS;
export const playerEntry = (race) => race.entries[race.player];

export function updateRace(race, dt, events = null) {
  if (race.phase === 'countdown') {
    race.clock += dt;
    const n = COUNT - Math.floor(race.clock);       // 3, 2, 1, then 0 = GO
    if (n < race.count) {
      race.count = n;
      if (events) events.push(n > 0 ? { type: 'count', n } : { type: 'go' });
      if (n <= 0) race.phase = 'race';
    }
    return race;
  }

  race.t += dt;
  const L = race.track.length;
  for (const e of race.entries) {
    if (e.finish !== null) continue;
    if (progressOf(race, e) >= (e.laps + 1) * L) {
      const time = race.t - e.lapStart;
      e.times.push(time);
      e.best = Math.min(e.best, time);
      e.laps++;
      e.lapStart = race.t;
      if (e.laps >= race.laps) {
        e.finish = race.t;
        if (events) events.push({ type: 'finish', ship: e.ship, time: e.finish });
      } else if (events) {
        events.push({ type: 'lap', ship: e.ship, time, lap: e.laps + 1, best: time === e.best });
      }
    }
  }

  const order = [...race.entries].sort((a, b) => {
    if (a.finish !== null || b.finish !== null) return (a.finish ?? Infinity) - (b.finish ?? Infinity);
    return progressOf(race, b) - progressOf(race, a);
  });
  order.forEach((e, i) => { e.place = i + 1; });
  if (race.phase === 'race' && playerEntry(race).finish !== null) race.phase = 'finished';
  return race;
}

// 0 for the leader, 1 for the last ship (the item draw uses it).
export const placeFraction = (race, e) => (race.entries.length > 1 ? (e.place - 1) / (race.entries.length - 1) : 0);

export function formatTime(t) {
  if (!Number.isFinite(t)) return '–:––.––';
  const m = Math.floor(t / 60), s = t - 60 * m;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10]}`;
