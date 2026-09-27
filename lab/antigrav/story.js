// The live sentence: one short line that says what is happening and why. Pure, so node can test
// that every state gets a line of 72 characters or less, in plain words, with no key hints.
//
// `state`: { phase: 'grid' | 'countdown' | 'race' | 'finished', count, zone (track tag or null),
//   air, item (null | 'bolt' | 'mine' | 'shield'), shield, event (null | { type, item, result, age }),
//   place, ships, lap, laps, brake (bool), speed (m/s) }

export const ITEM_NAME = { bolt: 'Bolt', mine: 'Mine', shield: 'Shield' };

function eventLine(e) {
  switch (e.type) {
    case 'hit':
      return e.item === 'bolt'
        ? 'Bolt hit: engine cut for half a second. Hold the line.'
        : 'Magnetic mine: its field drags you back for a moment.';
    case 'shieldHit': return 'The shield took the hit. No speed lost.';
    case 'item': return `${ITEM_NAME[e.item]} on board. Fire when it helps.`;
    case 'use':
      if (e.item === 'bolt') return 'Bolt away. It homes on the first ship ahead.';
      if (e.item === 'mine') return 'Mine dropped. It catches whoever comes too close.';
      return 'Shield up for four seconds: it stops one hit.';
    case 'pad': return 'Speed pad: +126 km/h. Drag bleeds it off again.';
    case 'wall': return 'Wall hit. Speed lost: steer before the bend, not in it.';
    case 'land': return 'Landed. The hover field caught the hull.';
    case 'off': return 'Over the wall. Nothing holds you out here.';
    case 'respawn': return 'Put back where you left the track, slow: about three seconds lost.';
    case 'lap': return 'New lap. The best lap counts on the finish board.';
    case 'shot': return e.result === 'hit' ? 'Direct hit on the ship ahead.' : null;
    default: return null;
  }
}

function zoneLine(zone, brake) {
  switch (zone) {
    case 'hairpin': return brake ? 'Airbrake out: the tail slides and the nose comes round.' : 'Tight hairpin. An airbrake turns you in harder.';
    case 'loop': return 'No gravity up here: the track field holds you through the loop.';
    case 'twist': return 'Corkscrew: the deck rolls a full turn and the field keeps you on it.';
    case 'crest': return 'Crest ahead. Fast ships outrun the field and fly.';
    case 'drop': return 'The track dives 100 m. The field presses you down at the bottom.';
    case 'tunnel': return 'Through the ring station. Pads on both sides.';
    case 'sweeper': return 'Banked sweeper: the bank turns the bend into downforce.';
    case 'esses': return 'S-bends. Stay on the inside of each one.';
    default: return null;
  }
}

export function sentence(state) {
  const { phase, count, zone, air, item, event, place, ships, lap, laps, brake } = state;
  if (phase === 'grid') return 'Four ships in orbit. Pick the opponents, then race.';
  if (phase === 'countdown') return count > 0 ? `${count}…` : 'Go!';
  if (phase === 'finished') return place === 1 ? 'You won. The field never let go.' : `You finished ${place} of ${ships}.`;
  if (event && event.age < 2) {
    const line = eventLine(event);
    if (line) return line;
  }
  if (air) return 'Airborne: no field under you, no steering grip.';
  if (lap === laps && zone === 'start') return 'Final lap.';
  const z = zoneLine(zone, brake);
  if (z) return z;
  if (item === 'shield') return 'Shield ready. Save it for an incoming bolt or a mine.';
  if (item === 'bolt') return 'Bolt ready. Line up behind a ship, then fire.';
  if (item === 'mine') return 'Mine ready. Drop it when a ship sits on your tail.';
  return place === 1 ? 'Leading. Hold your line and keep the throttle down.' : 'Glowing pads give an item. Speed pads throw you forward.';
}
