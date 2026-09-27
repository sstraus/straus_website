// Pickups, bolts, magnetic mines and shields. Pure: ships are the objects from physics.js, and
// every effect is a change of their fields (speed, thrustCut, wobble, mineDrag), so a hit costs
// time through the same physics as everything else.

import { gapS, wrapS } from './track.js';
import { SHIP } from './physics.js';

export const ITEMS = ['bolt', 'mine', 'shield'];

export const ITEM = {
  boltSpeed: 320,      // m/s along the track
  boltLife: 1.5,       // s
  boltHoming: 30,      // m/s of sideways correction toward the target
  boltRadius: 2.6,     // m, sideways reach of a hit
  boltSlow: 0.5,       // speed kept after a bolt hit
  boltCut: 0.6,        // s without thrust
  boltWobble: 0.6,     // s of yaw wobble
  mineLife: 25,        // s
  mineRadius: 4,       // m
  mineArm: 1.2,        // s before the mine can catch the ship that dropped it
  mineDrag: 1.8,       // s of pull-back
  shield: 4,           // s
  immune: 1.8,         // s after any hit
  padCooldown: 4,      // s a pickup pad stays dark after it gave an item
};

// The draw depends on the position: the leader gets more mines and shields to defend, the last
// ship gets more bolts to catch up. `place` is 0 for the leader and 1 for the last ship.
export function itemWeights(place) {
  const p = Math.max(0, Math.min(1, place));
  return { bolt: 0.2 + 0.4 * p, mine: 0.45 - 0.35 * p, shield: 0.35 - 0.05 * p };
}

export function drawItem(place, rand) {
  const w = itemWeights(place);
  let x = rand() * (w.bolt + w.mine + w.shield);
  for (const k of ITEMS) { x -= w[k]; if (x < 0) return k; }
  return 'shield';
}

export function createItems() {
  return { bolts: [], mines: [], padCool: new Map() };   // padCool: pad -> seconds until lit again
}

export const padReady = (state, pad) => !state.padCool.has(pad);

export function equip(ship) {
  ship.item = null;
  ship.shield = 0;
  ship.immune = 0;
  return ship;
}

// A pickup pad gives an item only to a ship that holds none, and only while it is lit; a pad that
// gave an item goes dark for padCooldown seconds.
export function pickup(state, ship, pad, place, rand, events = null) {
  if (ship.item || !padReady(state, pad)) return false;
  state.padCool.set(pad, ITEM.padCooldown);
  ship.item = drawItem(place, rand);
  if (events) events.push({ type: 'item', ship, item: ship.item });
  return true;
}

// The first ship ahead within the bolt's reach, or null.
// A ship that flew off the track is out of play until it is put back.
const inPlay = (o) => !(o.off > 0);

export function boltTarget(ship, ships, track) {
  let best = null, bestGap = ITEM.boltSpeed * ITEM.boltLife;
  for (const o of ships) {
    if (o === ship || !inPlay(o)) continue;
    const g = gapS(track, ship.s, o.s);
    if (g > 0 && g < bestGap) { best = o; bestGap = g; }
  }
  return best;
}

export function useItem(state, ship, ships, track, events = null) {
  const kind = ship.item;
  if (!kind) return false;
  ship.item = null;
  if (kind === 'bolt') {
    state.bolts.push({
      owner: ship, target: boltTarget(ship, ships, track),
      s: wrapS(track, ship.s + SHIP.halfL + 0.5), d: ship.d, h: ship.h, life: ITEM.boltLife,
    });
  } else if (kind === 'mine') {
    state.mines.push({ owner: ship, s: wrapS(track, ship.s - SHIP.halfL - 2), d: ship.d, age: 0 });
  } else {
    ship.shield = ITEM.shield;
  }
  if (events) events.push({ type: 'use', ship, item: kind });
  return true;
}

// A bolt or a mine reaches a ship. Returns what happened: 'immune', 'shield' or 'hit'.
export function strike(ship, kind, mine = null, events = null) {
  if (ship.immune > 0) return 'immune';
  if (ship.shield > 0) {
    ship.shield = 0;
    if (events) events.push({ type: 'shieldHit', ship, item: kind });
    return 'shield';
  }
  if (kind === 'bolt') {
    ship.vx *= ITEM.boltSlow;
    ship.vy *= ITEM.boltSlow;
    ship.thrustCut = ITEM.boltCut;
    ship.wobble = ITEM.boltWobble;
  } else {
    ship.mineDrag = ITEM.mineDrag;
    ship.minePullD = mine ? mine.d : ship.d;
  }
  ship.immune = ITEM.immune;
  if (events) events.push({ type: 'hit', ship, item: kind });
  return 'hit';
}

export function updateItems(state, ships, track, dt, events = null) {
  for (const [pad, t] of state.padCool) {
    if (t <= dt) state.padCool.delete(pad); else state.padCool.set(pad, t - dt);
  }
  for (const ship of ships) {
    ship.shield = Math.max(0, ship.shield - dt);
    ship.immune = Math.max(0, ship.immune - dt);
  }

  for (let i = state.bolts.length - 1; i >= 0; i--) {
    const b = state.bolts[i];
    const ds = ITEM.boltSpeed * dt;
    if (b.target && !inPlay(b.target)) b.target = null;
    if (b.target) {
      const want = b.target.d - b.d;
      b.d += Math.sign(want) * Math.min(Math.abs(want), ITEM.boltHoming * dt);
      b.h += (b.target.h - b.h) * Math.min(1, 6 * dt);
    }
    let hit = null;
    for (const o of ships) {
      if (o === b.owner || !inPlay(o)) continue;
      const g = gapS(track, b.s, o.s);
      if (g > -SHIP.halfL && g <= ds && Math.abs(o.d - b.d) < ITEM.boltRadius) { hit = o; break; }
    }
    b.s = wrapS(track, b.s + ds);
    b.life -= dt;
    if (hit) {
      const result = strike(hit, 'bolt', null, events);
      if (events) events.push({ type: 'boltEnd', bolt: b, ship: hit, result });
      state.bolts.splice(i, 1);
    } else if (b.life <= 0) {
      if (events) events.push({ type: 'boltEnd', bolt: b, ship: null, result: 'miss' });
      state.bolts.splice(i, 1);
    }
  }

  for (let i = state.mines.length - 1; i >= 0; i--) {
    const m = state.mines[i];
    m.age += dt;
    let hit = null;
    for (const o of ships) {
      if (o === m.owner && m.age < ITEM.mineArm) continue;
      if (o.h > 3 || !inPlay(o)) continue;          // jumped over it, or flew off
      if (Math.hypot(gapS(track, m.s, o.s), o.d - m.d) < ITEM.mineRadius) { hit = o; break; }
    }
    if (hit) {
      const result = strike(hit, 'mine', m, events);
      if (result === 'immune') continue;              // the mine stays for the next ship
      if (events) events.push({ type: 'mineEnd', mine: m, ship: hit, result });
      state.mines.splice(i, 1);
    } else if (m.age >= ITEM.mineLife) {
      if (events) events.push({ type: 'mineEnd', mine: m, ship: null, result: 'expired' });
      state.mines.splice(i, 1);
    }
  }
}
