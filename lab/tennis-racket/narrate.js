/** The live sentence: one short description of what the racket does right now. */

const AXIS_TEXT = {
  handle: 'about the <b>handle</b>, the axis with the smallest inertia',
  middle: 'about the <b>middle</b> axis, across the head',
  face: 'about the axis <b>through the strings</b>, the largest inertia',
};

const deg = (v) => `<span class="num">${Math.round(v)}°</span>`;

export function narrate({ phase, axis, twist, flips, rate, stable, zeroG, flash }) {
  if (phase === 'hold') {
    if (axis === 'middle') return `Spin ${AXIS_TEXT.middle}. The <span class="red">red face</span> starts on top. Watch where it ends.`;
    return `Spin ${AXIS_TEXT[axis]}. Two of the three axes behave. This is one of them.`;
  }

  if (zeroG) {
    if (stable) return `No gravity, no air, no torque. Spun ${AXIS_TEXT[axis]}, it just keeps turning. Twist ${deg(twist)}.`;
    if (flash > 0.3) return `<span class="purple">Flip ${flips}.</span> Nothing touched it. The spin axis turned upside down by itself, again.`;
    return `No gravity, no torque, and still it flips, again and again: <span class="num">${flips}</span> so far. Dzhanibekov saw this with a wingnut in orbit.`;
  }

  if (phase === 'caught') {
    if (stable) return `Caught with only ${deg(twist)} of twist. Calm axis. Now try the <span class="blue">middle</span> one.`;
    if (flips % 2 === 1) return `Caught turned over: the <span class="white">white face</span> is where the <span class="red">red</span> one was. Throw again, it happens every time.`;
    return `<span class="num">${flips}</span> flips, so it came back almost straight. Spin slower for exactly one.`;
  }

  if (stable) {
    const soft = axis === 'face' ? ' It wobbles a bit, because two inertias are close, but it always comes back.' : ' The wobble stays small.';
    return `Spinning ${AXIS_TEXT[axis]}. Twist ${deg(twist)}.${soft}`;
  }
  if (flash > 0.3) return `<span class="purple">Flip!</span> The racket turns half over on its own. Its angular momentum did not change, only the body did.`;
  if (flips === 0) {
    const doubling = (Math.LN2 / rate).toFixed(2);
    return `Spinning ${AXIS_TEXT.middle}. The wobble doubles every <span class="num">${doubling} s</span>. The middle axis cannot hold it.`;
  }
  const top = flips % 2 === 1 ? '<span class="white">white face</span>' : '<span class="red">red face</span>';
  return `Twisted ${deg(twist)}. Two axes stay calm, the middle one flips: the ${top} is on top now.`;
}
