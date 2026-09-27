/**
 * The refrigerant circuit in both seasons. No three.js, so node can test it.
 *
 * The four-way valve has one inlet from the compressor, one outlet back to it
 * and two ports to the exchangers. Inside, a slider connects the suction
 * outlet with one exchanger port; the hot gas fills the body and leaves by
 * the other. Moving the slider swaps the two exchangers: in winter the hot gas
 * goes to the plate (which condenses and heats the water) and the coil
 * outside evaporates; in summer the hot gas goes to the coil (which condenses
 * into the garden air) and the plate evaporates, chilling the water.
 */
import { REFRIGERANT } from './layout.js';

/** Which exchanger does what. */
export function roles(season) {
  return season === 'summer' ? { condenser: 'coil', evaporator: 'plate' } : { condenser: 'plate', evaporator: 'coil' };
}

/** The four runs between the valve and the exchangers carry the flow backwards in summer. */
export const REVERSIBLE = new Set(['hot gas', 'liquid', 'feed', 'suction']);

/**
 * The runs in flow order for a season, each with the end the refrigerant
 * enters by (`from`), the end it leaves by (`to`), whether it runs against
 * the drawing direction (`reverse`), its phase and the cycle temperature it
 * carries: 'discharge' (hot gas), 'condensing' (warm liquid), 'evaporating'
 * (cold two-phase mist) or 'suction' (cool vapour back to the compressor).
 */
export function circuit(season) {
  const summer = season === 'summer';
  const { condenser, evaporator } = roles(season);
  const runs = REFRIGERANT.map((run) => {
    const reverse = summer && REVERSIBLE.has(run.name);
    return { name: run.name, reverse, from: reverse ? run.to : run.from, to: reverse ? run.from : run.to };
  });
  // Walk the loop from the compressor outlet, following each run's `to` into the next run's `from`.
  // The valve is passed twice: first the hot gas leaves for an exchanger, then
  // the vapour from the other exchanger leaves for the accumulator.
  const ordered = [];
  let at = 'compressor';
  let valveVisits = 0;
  for (let i = 0; i < runs.length; i++) {
    if (at === 'reversing') valveVisits++;
    const leaves = (r) => at !== 'reversing' || (r.to === 'accumulator') === (valveVisits === 2);
    const next = runs.find((r) => r.from === at && !ordered.includes(r) && leaves(r));
    if (!next) throw new Error(`the ${season} circuit is broken after ${at}`);
    ordered.push(next);
    at = next.to;
  }
  if (at !== 'compressor') throw new Error(`the ${season} circuit does not close`);
  // The state follows from what the refrigerant last passed through.
  let state = { phase: 'gas', temperature: 'discharge' };
  return ordered.map((run) => {
    if (run.from === condenser) state = { phase: 'liquid', temperature: 'condensing' };
    else if (run.from === 'eev') state = { phase: 'mix', temperature: 'evaporating' };
    else if (run.from === evaporator) state = { phase: 'gas', temperature: 'suction' };
    return { ...run, ...state };
  });
}
