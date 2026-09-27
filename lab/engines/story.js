/**
 * The live sentence, free of three.js so node can test it. One idea at a time, in plain words:
 * a non-engineer must get the story in ten seconds.
 *
 * `state`: { rpm, view: 'both' | 'engine' | 'motor', exploded, beat } where `beat` is a counter
 * that the page advances every few seconds, so the running machines tell their story in turns.
 */
import { ENGINE, engineEfficiency, motorEfficiency, movingPartCount } from './physics.js';

const pct = (x) => Math.round(x * 100);

const engineBeats = [
  () => 'The cylinders fire in the order 1-3-4-2, one every half turn.',
  ({ rpm }) => `At ${Math.round(rpm)} rpm the engine fires ${Math.round((rpm / 60) * 2)} times a second.`,
  () => 'The cams turn at half speed: each valve opens every other turn.',
  ({ rpm }) => `Only ${pct(engineEfficiency(rpm))}% of the fuel turns the shaft. The rest is heat.`,
];

const motorBeats = [
  () => 'The coils switch on in turn, and the magnets chase them round.',
  ({ rpm }) => `The motor turns ${pct(motorEfficiency(rpm))}% of its power into motion.`,
  () => 'One moving part: the rotor. No valves, no pistons, no sparks.',
];

/** The one live sentence. */
export function sentence({ rpm, view, exploded, beat }) {
  if (exploded) {
    if (view === 'engine') return `The engine has ${movingPartCount('engine')} parts that move each time it turns.`;
    if (view === 'motor') return 'The motor has one part that moves: the rotor with its magnets.';
    return `Engine: ${movingPartCount('engine')} moving parts. Motor: ${movingPartCount('motor')}, the rotor.`;
  }
  const engine = view !== 'motor';
  const motor = view !== 'engine';
  if (rpm < 1) {
    if (!motor) return 'At standstill the engine gives no push at all. It needs revs.';
    return 'At standstill the motor already pushes 250 Nm. The engine has none.';
  }
  if (rpm < ENGINE.idleRpm && engine) {
    return motor ? 'Below 800 rpm the engine stalls. The motor pulls from zero.' : 'Below 800 rpm the engine cannot keep itself turning.';
  }
  const beats = [];
  // Both machines on screen: their stories alternate.
  const longest = Math.max(engine ? engineBeats.length : 0, motor ? motorBeats.length : 0);
  for (let i = 0; i < longest; i++) {
    if (engine && engineBeats[i]) beats.push(engineBeats[i]);
    if (motor && motorBeats[i]) beats.push(motorBeats[i]);
  }
  return beats[((beat % beats.length) + beats.length) % beats.length]({ rpm });
}
