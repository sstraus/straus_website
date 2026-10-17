/**
 * The rules of the run, on top of the physics: how a landing is graded, what it costs or gives,
 * when the run ends, and the time of day. Pure, so node can test it.
 */
import { createTerrain } from './terrain.js';
import { createRover, step, jump, LANDING_AIR } from './physics.js';

export const SPEED = { start: 8.5, top: 14, boost: 2.4 }; // m/s, the motors' target
export const SOL_METRES = 2600; // one Martian day passes over this distance
export const START_SOL = 0.12; // the run starts in the morning, with the sun well up
const BOOST_DECAY = 0.55; // per second

const DEG = Math.PI / 180;
export const GRADE = {
  perfect: { angle: 10 * DEG, hit: 3.2 },
  good: { angle: 24 * DEG, hit: 6 },
};

/**
 * A landing is graded on two numbers from the physics: the angle between chassis and ground at
 * touchdown, and the speed along the ground's normal. Land along the slope, falling with it, and
 * both are small. Land on the rising face of the next bump and both are large.
 * `bottomOut`: how far a suspension went past its travel in that landing, in metres.
 */
export function gradeLanding({ delta, vn }, bottomOut = 0) {
  const angle = Math.abs(delta);
  if (angle < GRADE.perfect.angle && vn < GRADE.perfect.hit && bottomOut === 0) return { grade: 'perfect', damage: 0 };
  if (angle < GRADE.good.angle && vn < GRADE.good.hit) return { grade: 'good', damage: 0 };
  // Hard: it costs hull, more for a harder hit and a worse angle, but never the whole hull at once.
  const damage = 4 + Math.max(0, vn - GRADE.good.hit) * 5 + Math.max(0, angle - GRADE.good.angle) * 40 + bottomOut * 40;
  return { grade: 'hard', damage: Math.min(40, damage) };
}

/** The speed the motors aim for: rises with distance, plus whatever a clean landing earned. */
export function targetSpeed(distance, boost = 0) {
  const d = Math.max(0, Math.min(1, distance / 3500));
  return SPEED.start + (SPEED.top - SPEED.start) * d + boost;
}

export function createGame(seed = 1) {
  const terrain = createTerrain(seed);
  const rover = createRover(terrain, 4);
  return {
    seed, terrain, rover,
    start: rover.x,
    distance: 0,
    hull: 100,
    streak: 0,
    bestStreak: 0,
    boost: 0,
    over: false,
    reason: null,
    last: null, // the last graded landing: { grade, damage, at }
    events: [], // what happened this frame, for the renderer and the coach
    time: 0,
  };
}

/** One frame. `jumpPressed` is true on the frame the player asks for a jump. */
export function update(game, dt, { jumpPressed = false } = {}) {
  game.events.length = 0;
  if (game.over) return game;
  if (jumpPressed && game.rover.grounded) {
    jump(game.rover);
    game.events.push({ type: 'jump' });
  }
  step(game.rover, game.terrain, dt, targetSpeed(game.distance, game.boost));
  game.time += dt;
  game.distance = Math.max(game.distance, game.rover.x - game.start);
  game.boost = Math.max(0, game.boost - BOOST_DECAY * dt);

  const landed = game.rover.landed;
  if (landed && landed.air >= LANDING_AIR) {
    // The bump stop of this landing is read a moment later, once the springs have taken the hit.
    game.pending = { landed, wait: 0.12 };
  }
  if (game.pending) {
    game.pending.wait -= dt;
    if (game.pending.wait <= 0 || game.rover.crashed) {
      const result = gradeLanding(game.pending.landed, game.rover.bottomOut);
      game.pending = null;
      settle(game, result);
    }
  }
  if (game.rover.crashed) end(game, game.rover.crashed);
  return game;
}

function settle(game, result) {
  game.last = { ...result, at: game.time };
  game.events.push({ type: 'landing', ...result });
  if (result.grade === 'perfect') {
    game.streak += 1;
    game.bestStreak = Math.max(game.bestStreak, game.streak);
    game.boost = Math.min(SPEED.boost * 1.6, game.boost + SPEED.boost);
    game.hull = Math.min(100, game.hull + 3); // a clean landing lets the rover shake off a little damage
  } else if (result.grade === 'good') {
    game.boost = Math.min(SPEED.boost * 1.6, game.boost + SPEED.boost * 0.35);
  } else {
    game.streak = 0;
    game.boost = 0;
    game.hull = Math.max(0, game.hull - result.damage);
    if (game.hull === 0) end(game, 'hull');
  }
}

function end(game, reason) {
  if (game.over) return;
  game.over = true;
  game.reason = reason;
  game.events.push({ type: 'over', reason });
}

/**
 * The time of day, from the distance: one sol per SOL_METRES. Day, a blue sunset (on Mars the fine
 * dust scatters blue light forward, so the sky round the setting sun turns blue while the rest stays
 * tan), night with Phobos and Deimos, and dawn.
 * Returns { sol, phase, sun (elevation, radians), blue (0..1 glow round the sun), night (0..1) }.
 */
export function sky(distance) {
  const sol = (((distance / SOL_METRES + START_SOL) % 1) + 1) % 1;
  // The run starts in the morning; the sun is highest at sol = 0.25 and sets at 0.55.
  const angle = (sol - 0.05) / 0.5 * Math.PI; // 0 at sunrise, π at sunset
  const sun = Math.sin(angle) * (70 * DEG);
  const night = smooth(0.54, 0.62, sol) * (1 - smooth(0.92, 0.99, sol));
  const blue = bell(sol, 0.555, 0.045) + bell(sol, 1.02, 0.03) + bell(sol, 0.02, 0.03) * 0.6;
  const phase = sol < 0.5 ? 'day' : sol < 0.6 ? 'sunset' : sol < 0.93 ? 'night' : 'dawn';
  return { sol, phase, sun, blue: Math.min(1, blue), night };
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bell = (x, centre, width) => Math.exp(-(((x - centre) / width) ** 2));
