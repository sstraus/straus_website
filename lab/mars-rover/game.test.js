// Run with: node --test lab/proto/mars-rover/
import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeLanding, targetSpeed, createGame, update, sky, SPEED, SOL_METRES, START_SOL } from './game.js';
import { step, jump, LANDING_AIR } from './physics.js';

const DEG = Math.PI / 180;
const DT = 1 / 60;

/** Plays one run with a policy that decides, each frame, whether to press jump. */
function play(seed, policy, limit = 4000, seconds = 600) {
  const game = createGame(seed);
  let hard = 0;
  let perfect = 0;
  for (let t = 0; t < seconds && !game.over && game.distance < limit; t += DT) {
    update(game, DT, { jumpPressed: policy(game) });
    for (const e of game.events) {
      if (e.type === 'landing' && e.grade === 'hard') hard += 1;
      if (e.type === 'landing' && e.grade === 'perfect') perfect += 1;
    }
  }
  return { distance: game.distance, over: game.over, hard, perfect };
}

const never = () => false;

test('landing along the slope is perfect, into the face is hard (catches a grader that ignores the angle)', () => {
  assert.equal(gradeLanding({ delta: 3 * DEG, vn: 2 }).grade, 'perfect');
  assert.equal(gradeLanding({ delta: 22 * DEG, vn: 5 }).grade, 'good');
  const face = gradeLanding({ delta: 40 * DEG, vn: 4 });
  assert.equal(face.grade, 'hard');
  assert.ok(face.damage > 8);
});

test('a hard hit costs more the harder it is (catches a flat penalty that makes all mistakes equal)', () => {
  const soft = gradeLanding({ delta: 25 * DEG, vn: 6 }).damage;
  const bad = gradeLanding({ delta: 45 * DEG, vn: 9 }).damage;
  assert.ok(bad > soft, `${bad} vs ${soft}`);
  assert.ok(gradeLanding({ delta: 5 * DEG, vn: 2 }, 0.05).grade !== 'perfect', 'bottoming out the springs was graded perfect');
  assert.ok(gradeLanding({ delta: 80 * DEG, vn: 20 }, 0.3).damage <= 40, 'one landing can take almost half the hull');
});

test('the rover speeds up with distance and after a clean landing (catches a flat pace)', () => {
  assert.equal(targetSpeed(0), SPEED.start);
  assert.ok(targetSpeed(3500) > targetSpeed(1000));
  assert.ok(targetSpeed(1000, 2) > targetSpeed(1000));
});

test('a perfect landing builds the streak and a boost, a hard one takes the hull (catches rewards wired backwards)', () => {
  const game = createGame(1);
  // Feed the rules a perfect landing, then a hard one, through the same path as the physics.
  game.pending = { landed: { delta: 0.02, vn: 1.5, air: 1 }, wait: 0 };
  update(game, DT);
  assert.equal(game.streak, 1);
  assert.ok(game.boost > 0);
  game.pending = { landed: { delta: 0.8, vn: 9, air: 1 }, wait: 0 };
  update(game, DT);
  assert.equal(game.streak, 0);
  assert.ok(game.hull < 100);
  assert.equal(game.boost, 0);
});

test('the run ends when the hull is gone (catches a rover that drives on at 0 %)', () => {
  const game = createGame(1);
  for (let i = 0; i < 10 && !game.over; i++) {
    game.pending = { landed: { delta: 1.2, vn: 12, air: 1 }, wait: 0 };
    update(game, DT);
  }
  assert.equal(game.over, true);
  assert.equal(game.reason, 'hull');
  const distance = game.distance;
  update(game, 1);
  assert.equal(game.distance, distance, 'the rover still moves after the end');
});

test('every bad landing could have been saved by one jump at the right point (catches a game that punishes you for nothing)', () => {
  // Drive without jumping. At every hard landing, go back up to 2.5 s before the take-off and try a
  // jump at each moment the rover was on the ground: at least one of them must stay clean (no hard
  // landing, no crash) until past the moment of the original hard landing.
  const cleanAfterJump = (snapshot, terrain, seconds) => {
    const r = structuredClone(snapshot.rover);
    jump(r);
    for (let t = 0; t < seconds; t += DT) {
      step(r, terrain, DT, targetSpeed(snapshot.distance, snapshot.boost));
      if (r.crashed) return false;
      if (r.landed && r.landed.air >= LANDING_AIR && gradeLanding(r.landed).grade === 'hard') return false;
    }
    return true;
  };
  let hard = 0;
  let saved = 0;
  for (const seed of [1, 2, 3, 4]) {
    const game = createGame(seed);
    const history = [];
    for (let t = 0; t < 200 && !game.over && game.distance < 1000; t += DT) {
      history.push({ t, rover: structuredClone(game.rover), distance: game.distance, boost: game.boost });
      if (history.length > 200) history.shift();
      update(game, DT);
      if (!game.events.some((e) => e.type === 'landing' && e.grade === 'hard')) continue;
      hard += 1;
      const takeOff = t - game.rover.landing.air;
      const options = history.filter((h) => h.rover.grounded && h.t <= takeOff && h.t >= takeOff - 2.5);
      if (options.some((h) => cleanAfterJump(h, game.terrain, t - h.t + 0.6))) saved += 1;
    }
  }
  assert.ok(hard > 10, `only ${hard} bad landings to check`);
  assert.ok(saved / hard > 0.85, `${saved} of ${hard} bad landings could have been saved`);
});

test('doing nothing loses (catches a game that plays itself)', () => {
  const idle = [1, 2, 3, 4].map((s) => play(s, never, 6000, 900));
  assert.ok(idle.every((r) => r.over), `an idle rover finished: ${idle.map((r) => r.distance.toFixed(0)).join(', ')} m`);
});

test('a sol runs day, blue sunset, night, dawn, in that order (catches a sky out of step)', () => {
  // The distance at which the sol reaches a given point of the day.
  const at = (sol) => (((sol - START_SOL) % 1) + 1) % 1 * SOL_METRES;
  const phases = [];
  for (let s = 0; s < 1; s += 1 / 400) {
    const p = sky(at(s)).phase;
    if (phases[phases.length - 1] !== p) phases.push(p);
  }
  assert.deepEqual(phases, ['day', 'sunset', 'night', 'dawn']);
  assert.ok(sky(0).sun > 20 * DEG, `the run starts with the sun at ${(sky(0).sun / DEG).toFixed(0)}°`);
  assert.ok(sky(at(0.3)).sun > 60 * DEG, 'the sun never climbs');
  assert.ok(sky(at(0.75)).night > 0.9, 'the night is not dark');
  assert.ok(sky(at(0.555)).blue > 0.9, 'the sunset is not blue');
  assert.ok(sky(at(0.3)).blue < 0.05, 'the noon sky is blue: on Mars it is butterscotch');
  assert.deepEqual(sky(SOL_METRES * 3 + 10), sky(10));
});
