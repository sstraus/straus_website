/**
 * The physics of the bench, free of three.js so node can test it.
 *
 * Engine: a 2.0 litre inline four-stroke petrol, square bore and stroke, firing order 1-3-4-2,
 * double overhead cams with four valves per cylinder. Angles are radians. The cycle phase of a
 * cylinder runs over two crank turns: 0 is the top at the start of intake, 2π the firing top.
 *
 * Motor: a permanent-magnet synchronous motor with 12 tooth coils and 8 magnet poles, driven with
 * the current a quarter pole pitch ahead of the magnets (maximum torque per ampere).
 *
 * Torque and efficiency curves are representative of the two machine classes at full load, not
 * measurements of one product. The essay says so.
 */

export const TAU = Math.PI * 2;
const CYCLE = 2 * TAU;
const DEG = Math.PI / 180;

export const ENGINE = {
  cylinders: 4,
  bore: 0.086, // m
  stroke: 0.086, // m
  rod: 0.143, // m, centre to centre
  compressionRatio: 10.5,
  firingOrder: [1, 3, 4, 2],
  idleRpm: 800,
  redlineRpm: 6500,
  maxValveLift: 0.009, // m
};

export const MOTOR = {
  slots: 12,
  poles: 8,
  peakTorque: 250, // Nm, from standstill to base speed
  baseRpm: 3800,
  maxRpm: 12000,
};

const wrap = (angle, period) => ((angle % period) + period) % period;
const wrapPi = (angle) => wrap(angle + Math.PI, TAU) - Math.PI;
const smooth = (x) => x * x * (3 - 2 * x);

// ---------- slider-crank ----------

const CRANK_RADIUS = ENGINE.stroke / 2;

/** Height of the piston pin above the crank axis, m. */
export function pistonHeight(angle) {
  const s = Math.sin(angle);
  return CRANK_RADIUS * Math.cos(angle) + Math.sqrt(ENGINE.rod ** 2 - (CRANK_RADIUS * s) ** 2);
}

/** Travel from the top as a fraction of the stroke, 0 at the top and 1 at the bottom. */
export function pistonTravel(angle) {
  return (CRANK_RADIUS + ENGINE.rod - pistonHeight(angle)) / ENGINE.stroke;
}

// ---------- firing order ----------

/**
 * Cycle offset of each cylinder: the cylinder at position k in the firing order fires k half
 * turns after cylinder 1. Offsets that differ by one turn share a crank throw, so 1 and 4 move
 * together and 2 and 3 move opposite to them.
 */
const OFFSET = [0, 0, 0, 0];
ENGINE.firingOrder.forEach((cylinder, k) => { OFFSET[cylinder - 1] = wrap(TAU - k * Math.PI, CYCLE); });

/** Cycle phase of cylinder 1–4 at a crank angle, in [0, 4π). */
export function cylinderPhase(cylinder, crank) {
  return wrap(crank + OFFSET[cylinder - 1], CYCLE);
}

/** Crank throw angle of a cylinder in the crankshaft frame: 0 or π. */
export function throwAngle(cylinder) {
  return wrap(OFFSET[cylinder - 1], TAU);
}

const STROKES = ['intake', 'compression', 'power', 'exhaust'];

export function strokeOf(phase) {
  return STROKES[Math.floor(wrap(phase, CYCLE) / Math.PI)];
}

/** The cylinder (1–4) in its power stroke at a crank angle. There is always exactly one. */
export function firingCylinder(crank) {
  for (let c = 1; c <= ENGINE.cylinders; c++) if (strokeOf(cylinderPhase(c, crank)) === 'power') return c;
  return null;
}

// ---------- valves and cams ----------

/** Cycle degrees. Intake opens 10° before the top and closes 50° after the bottom; exhaust mirrors it. */
export const VALVE_TIMING = {
  intake: { open: -10, close: 230 },
  exhaust: { open: 490, close: 730 },
};

const lift = (u) => (u > 0 && u < 1 ? Math.sin(Math.PI * u) ** 2 : 0);

/** Valve lift as a fraction of the full lift, from the cycle phase. */
export function valveLift(phase, valve) {
  const { open, close } = VALVE_TIMING[valve];
  const duration = (close - open) * DEG;
  return lift(wrap(phase - open * DEG, CYCLE) / duration);
}

/** The follower (bucket) sits straight under the camshaft. Angles as the crank: from +y towards +z. */
export const CAM_FOLLOWER = Math.PI;

/** Cam angle for a crank angle: the belt turns the cams at half speed, in the same direction. */
export const camAngle = (crank) => crank / 2;

/** Angle of a lobe nose in the camshaft frame, so that it meets the follower at full lift. */
export function lobeAngle(cylinder, valve) {
  const { open, close } = VALVE_TIMING[valve];
  const centre = ((open + close) / 2) * DEG;
  const crankAtCentre = centre - OFFSET[cylinder - 1];
  return wrap(CAM_FOLLOWER - camAngle(crankAtCentre), TAU);
}

/** Lift that a lobe at `lobe` gives at a crank angle. Every lobe has the same profile. */
export function camLift(lobe, crank) {
  const half = ((VALVE_TIMING.intake.close - VALVE_TIMING.intake.open) * DEG) / 4; // cam turns half as far
  const offset = wrapPi(lobe + camAngle(crank) - CAM_FOLLOWER);
  return lift((offset + half) / (2 * half));
}

// ---------- pressure, temperature and flame ----------

const P_INTAKE = 0.95; // bar, manifold at full throttle
const P_EXHAUST = 1.1; // bar, back pressure
const T_INTAKE = 330; // K, the fresh charge after it touched the hot port
const N_POLY = 1.3; // compression and expansion exponent, with the heat lost to the walls
const HEAT = 3.7; // pressure gain of complete combustion over the motored cycle
const SPARK = 345 * DEG; // 15° before the firing top
const BURN = 45 * DEG; // burn duration (Wiebe, a = 5, m = 2)
const BLOWDOWN = 18 * DEG;
const IVC = VALVE_TIMING.intake.close * DEG;
const EVO = VALVE_TIMING.exhaust.open * DEG;

const volume = (phase) => 1 / (ENGINE.compressionRatio - 1) + pistonTravel(phase); // swept volume = 1
const V_IVC = volume(IVC);

/** Fraction of the charge burned (Wiebe function). */
function burned(phase) {
  if (phase <= SPARK) return 0;
  return 1 - Math.exp(-5 * ((phase - SPARK) / BURN) ** 3);
}

function closedPressure(phase) {
  const motored = P_INTAKE * (V_IVC / volume(phase)) ** N_POLY;
  return motored * (1 + HEAT * burned(phase));
}
const P_EVO = closedPressure(EVO);

/** Absolute pressure in a cylinder, bar, at full throttle. */
export function cylinderPressure(phase) {
  const p = wrap(phase, CYCLE);
  if (p < IVC) {
    // The end of the exhaust stroke bleeds into the intake while both valves are open.
    const k = smooth(Math.min(1, p / (40 * DEG)));
    return P_EXHAUST + (P_INTAKE - P_EXHAUST) * k;
  }
  if (p < EVO) return closedPressure(p);
  return P_EXHAUST + (P_EVO - P_EXHAUST) * Math.exp(-(p - EVO) / BLOWDOWN);
}

/** Gas temperature, K: ideal gas while the valves are shut, isentropic blowdown after. */
export function gasTemperature(phase) {
  const p = wrap(phase, CYCLE);
  if (p < IVC) return T_INTAKE;
  if (p < EVO) return T_INTAKE * (cylinderPressure(p) / P_INTAKE) * (volume(p) / V_IVC);
  const tEvo = T_INTAKE * (P_EVO / P_INTAKE) * (volume(EVO) / V_IVC);
  return tEvo * (cylinderPressure(p) / P_EVO) ** ((N_POLY - 1) / N_POLY);
}

const burnRate = (y) => y * y * Math.exp(-5 * y ** 3);
const PEAK_RATE = burnRate((2 / 15) ** (1 / 3));

/** Brightness of the flame, 0–1: the burn rate, so it lights at the spark and fades as the charge is used up. */
export function burnGlow(phase) {
  const p = wrap(phase, CYCLE);
  if (p <= SPARK || p >= EVO) return 0;
  return burnRate((p - SPARK) / BURN) / PEAK_RATE;
}

/** Ideal Otto efficiency, the ceiling that no real engine reaches. */
export function ottoEfficiency(compressionRatio = ENGINE.compressionRatio, gamma = 1.4) {
  return 1 - compressionRatio ** (1 - gamma);
}

// ---------- torque, efficiency, power, heat (full load) ----------

export const engineRuns = (rpm) => rpm >= ENGINE.idleRpm;

/** Full-throttle torque, Nm. Below idle the engine cannot keep itself turning. */
export function engineTorque(rpm) {
  if (!engineRuns(rpm)) return 0;
  return 200 - 50 * ((Math.min(rpm, ENGINE.redlineRpm) - 4000) / 3000) ** 2;
}

/** Brake efficiency at full throttle: fuel energy that reaches the shaft. */
export function engineEfficiency(rpm) {
  if (!engineRuns(rpm)) return 0;
  return 0.34 - 0.035 * ((rpm - 3000) / 2500) ** 2;
}

/** Full-current torque, Nm: flat to base speed, then constant power. */
export function motorTorque(rpm) {
  return MOTOR.peakTorque * Math.min(1, MOTOR.baseRpm / Math.max(rpm, 1e-9));
}

/** Motor losses, kW: copper (current squared), iron (speed^1.5) and bearings and air (speed²). */
function motorLosses(rpm, torque) {
  const copper = 3.5 * (torque / MOTOR.peakTorque) ** 2;
  const iron = 1.6 * (rpm / 6000) ** 1.5;
  const friction = 0.3 * (rpm / 6000) ** 2;
  return copper + iron + friction;
}

/** Electrical energy that reaches the shaft at full current. Zero at standstill: all of it is heat. */
export function motorEfficiency(rpm) {
  const out = shaftPower(rpm, motorTorque(rpm));
  return out / (out + motorLosses(rpm, motorTorque(rpm)));
}

/** Motor heat, kW, at a speed: the losses themselves, so it is right at standstill too. */
export function motorHeat(rpm) {
  return motorLosses(rpm, motorTorque(rpm));
}

/** Shaft power, kW. */
export function shaftPower(rpm, torque) {
  return (torque * rpm * TAU) / 60 / 1000;
}

/** Heat for a shaft power (kW) at an efficiency: input minus output. */
export function wasteHeat(power, efficiency) {
  return efficiency > 0 ? power / efficiency - power : 0;
}

// ---------- the rotating field ----------

const POLE_PAIRS = MOTOR.poles / 2;

/** The current axis leads the north pole by a quarter of an electrical turn. */
export function fieldLead() {
  return Math.PI / 2 / POLE_PAIRS;
}

/**
 * Current in the coil on tooth k, from −1 to 1, for a rotor angle (radians, north pole of magnet 0).
 * Tooth k sits at k·30°, which is k·120° electrical, so the teeth take the phases A, B, C in turn.
 */
export function toothCurrent(k, rotor) {
  return Math.cos(POLE_PAIRS * rotor + Math.PI / 2 - (k * TAU) / 3);
}

// ---------- moving parts ----------

/** Every part that moves when the shaft turns, as drawn on the bench. */
export const MOVING_PARTS = {
  engine: [
    { name: 'Crankshaft', count: 1 },
    { name: 'Flywheel', count: 1 },
    { name: 'Crank pulley', count: 1 },
    { name: 'Timing belt', count: 1 },
    { name: 'Tensioner pulley', count: 1 },
    { name: 'Water pump pulley', count: 1 },
    { name: 'Cam pulleys', count: 2 },
    { name: 'Camshafts', count: 2 },
    { name: 'Pistons', count: 4 },
    { name: 'Piston rings', count: 12 },
    { name: 'Gudgeon pins', count: 4 },
    { name: 'Connecting rods', count: 4 },
    { name: 'Valves', count: 16 },
    { name: 'Valve springs', count: 16 },
    { name: 'Spring retainers', count: 16 },
    { name: 'Bucket tappets', count: 16 },
  ],
  motor: [
    { name: 'Rotor with magnets and shaft', count: 1 },
  ],
};

export function movingPartCount(kind) {
  return MOVING_PARTS[kind].reduce((sum, part) => sum + part.count, 0);
}
