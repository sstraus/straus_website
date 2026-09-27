// Kinematics of the magnet stand. Pure JavaScript, units: centimetres.
// A retort rod carries a swivel boss head; a horizontal arm turns around the rod,
// a carriage slides along the arm and a vertical rod through the carriage holds the magnet.

// Bench heights shared by the scene and the tests.
export const BENCH = {
  coilTop: 7.4, // top face of the coil flange
  dishRadius: 4.5, // inner radius of the petri dish
  fluidLevel: 8.1, // resting surface of the fluid
  magnetRest: 17.5, // bottom face of the magnet when parked
  magnetGap: 3, // bottom face of the lowered magnet above the fluid
  magnetLimit: 4, // the magnet axis stays inside this radius
};

export const STAND = {
  rodX: -11,
  rodZ: -5.5,
  armY: 22, // height of the arm axis
  armLength: 18, // from the rod axis to the arm tip
  carriageHalf: 0.8, // half the carriage length along the arm
  rodClearance: 1.6, // the carriage cannot pass the boss head
  holderHeight: 1.8, // magnet bottom to the start of the vertical rod
  magnetRodLength: 14,
};

/** Arm yaw (rotation about +y that maps local +x onto the magnet) and carriage reach. */
export function armPose(x, z, stand = STAND) {
  const dx = x - stand.rodX;
  const dz = z - stand.rodZ;
  return { yaw: Math.atan2(-dz, dx), reach: Math.hypot(dx, dz) };
}

/** True when the carriage sits fully on the arm, clear of the boss head. */
export function carriageOnArm(reach, stand = STAND) {
  return reach - stand.carriageHalf >= stand.rodClearance && reach + stand.carriageHalf <= stand.armLength;
}

/** Vertical span of the magnet rod for a given magnet bottom height. */
export function magnetRodSpan(bottom, stand = STAND) {
  const low = bottom + stand.holderHeight;
  return { low, high: low + stand.magnetRodLength };
}

/** Clamp a point into a disc of radius r around the origin. */
export function clampToDisc(x, z, r) {
  const d = Math.hypot(x, z);
  if (d <= r) return { x, z };
  return { x: (x * r) / d, z: (z * r) / d };
}
