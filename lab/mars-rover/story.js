/**
 * The coach: one live sentence under the tiles. Free of three.js, so node can test it.
 *
 * It says what just happened and what to try next, in plain words. When nothing is happening it
 * says something true about Mars instead: the sky, the moons, the gravity. The control is named
 * once, at the start (a game teaches its keys: the lab's one exception to "no keyboard hints").
 *
 * ctx: { phase: 'ready' | 'run' | 'over', distance, speed, air, hull, streak,
 *        last: { grade, damage, age } | null, sky: { phase }, beat }
 */

const pick = (lines, beat) => lines[((beat % lines.length) + lines.length) % lines.length];

const FACTS = {
  day: [
    'Gravity here is 38 % of Earth\'s: every jump hangs in the air.',
    'The sky is butterscotch by day: fine dust hangs high in the air.',
    'The air is about 1 % as dense as Earth\'s. It hardly pushes back.',
  ],
  sunset: [
    'Blue sunset: fine dust sends blue light forward, round the sun.',
    'On Mars the sunset is blue and the day sky is tan. It is the dust.',
  ],
  night: [
    'Phobos crosses the sky twice a sol, rising in the west.',
    'The small, slow light is Deimos. It takes days to cross the sky.',
  ],
  dawn: [
    'A sol lasts 24 h 39 min, a little longer than a day on Earth.',
    'Dawn at about minus 80 °C. By noon the ground reaches about 0 °C.',
  ],
};

export function sentence(ctx) {
  const { phase, beat = 0 } = ctx;
  if (phase === 'ready') return 'Tap anywhere or press space to jump. That is the only control.';
  if (phase === 'over') return `Run over at ${Math.round(ctx.distance)} m. Tap to drive again.`;
  if (ctx.distance < 70) return 'The rover drives itself. Your one move is the jump.';

  const last = ctx.last;
  if (last && last.age < 2.4) {
    if (last.grade === 'perfect') {
      return ctx.streak > 1
        ? `Clean landing on the slip face: ${ctx.streak} in a row. Faster now.`
        : 'Clean landing on the slip face. The slope throws you forward.';
    }
    if (last.grade === 'good') return 'Down safely. Land on the steep side and it pushes you faster.';
    if (ctx.hull < 35) return `Hull at ${Math.round(ctx.hull)} %. One more hard hit may end the run.`;
    return 'Nose into the sand. Jump on the crest to clear the next dune.';
  }
  if (ctx.air > 1.6) return 'Gravity here is 38 % of Earth\'s: every jump hangs in the air.';
  return pick(FACTS[ctx.sky?.phase] ?? FACTS.day, beat);
}
