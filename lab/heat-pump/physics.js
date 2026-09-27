/**
 * Air-to-water heat pump, steady state. No three.js, so node can test it.
 *
 * The refrigerant must evaporate colder than the outside air (heat flows in)
 * and condense hotter than the water it heats (heat flows out). The ideal
 * (Carnot) COP for that lift is Tc / (Tc − Te) in kelvin; real units reach
 * about half of it, which reproduces EN 14511 ratings (≈3.8 at A7/W35,
 * ≈2.9 at A−7/W35).
 */
const KELVIN = 273.15;

export const model = {
  indoor: 20, // °C the house is kept at
  evaporatorApproach: 8, // K between outside air and evaporating refrigerant
  condenserApproach: 5, // K between condensing refrigerant and flow water
  secondLawEfficiency: 0.5, // fraction of the Carnot COP a real unit reaches
  houseLoss: 0.2, // kW per K of indoor-outdoor difference (a mid-size, fairly insulated house)
  waterDrop: 5, // K the water cools across the floor loops or radiators
  // Summer: the same circuit run backwards to cool the floor.
  summerIndoor: 26, // °C the house is kept at in summer
  summerHumidity: 55, // % relative humidity of the room air in summer
  chilledApproach: 5, // K between chilled water and evaporating refrigerant in the plate
  airCondenserApproach: 10, // K between outside air and condensing refrigerant in the coil
  waterRise: 3, // K the chilled water warms across the floor loops
  // Sun through the glazing and a hot roof: none at 20 °C, rising to 2.5 kW at 35 °C (an assumption, not a solar model).
  gainBase: 20, // °C outside where the solar and roof gains start
  gainPerK: 2.5 / 15, // kW per K of outside air above gainBase
  // Inverter: the compressor speed follows the load.
  capacityAtMax: 8.5, // kW of heat or cold the unit moves at full speed
  minHz: 20, // below this the compressor cannot run smoothly, so the unit cycles instead
  maxHz: 90,
};

/** R290 (propane) saturation pressure in bar absolute. Clausius-Clapeyron fit to the NIST tables, within 1 % from −20 to 60 °C. */
export function saturationPressure(celsius) {
  return Math.exp(9.883 - 2275 / (celsius + KELVIN));
}

/** Compressor frequency in Hz: proportional to the load, between the inverter's limits. */
export function compressorFrequency(loadKW) {
  return Math.min(model.maxHz, Math.max(model.minHz, (loadKW / model.capacityAtMax) * model.maxHz));
}

/** Dew point in °C (Magnus formula, within 0.4 K from −40 to 50 °C). */
export function dewPoint(celsius, humidity) {
  const g = Math.log(humidity / 100) + (17.62 * celsius) / (243.12 + celsius);
  return (243.12 * g) / (17.62 - g);
}

/** Summer gains through the glazing and the roof, in kW. */
export function solarGain(outside) {
  return model.gainPerK * Math.max(outside - model.gainBase, 0);
}

/** Hot gas leaving the compressor: typical superheat above condensing (approximate). */
const dischargeTemperature = (condensing, evaporating) => condensing + 20 + 0.4 * (condensing - evaporating - 40);

/**
 * Heating (winter). Besides the heating fields, every result carries the same
 * common fields as coolingPump(): mode, load (kW moved for the house),
 * air (kW exchanged with the outside air), efficiency (COP or EER), frequency.
 * @param {{ outside: number, flow: number }} temps outside air and flow water in °C
 * @returns powers in kW and cycle temperatures in °C
 */
export function heatPump({ outside, flow }) {
  const evaporating = outside - model.evaporatorApproach;
  const condensing = flow + model.condenserApproach;
  const tc = condensing + KELVIN;
  const te = evaporating + KELVIN;
  const carnot = tc / (tc - te);
  const cop = model.secondLawEfficiency * carnot;

  const heat = model.houseLoss * Math.max(model.indoor - outside, 2);
  const electricity = heat / cop;
  return {
    mode: 'heating',
    cop,
    carnot,
    heat,
    electricity,
    fromAir: heat - electricity,
    load: heat,
    air: heat - electricity,
    efficiency: cop,
    frequency: compressorFrequency(heat),
    evaporating,
    condensing,
    discharge: dischargeTemperature(condensing, evaporating),
    lowPressure: saturationPressure(evaporating),
    highPressure: saturationPressure(condensing),
    returnWater: flow - model.waterDrop,
  };
}

/**
 * Cooling (summer): the four-way valve reverses the circuit. Propane now
 * evaporates in the plate, below the chilled water, and condenses in the
 * outdoor coil, above the outside air. The ideal (Carnot) EER is
 * Te / (Tc − Te) in kelvin; the same second-law efficiency applies.
 * @param {{ outside: number, flow: number }} temps outside air and chilled flow water in °C
 */
export function coolingPump({ outside, flow }) {
  const evaporating = flow - model.chilledApproach;
  const condensing = outside + model.airCondenserApproach;
  const tc = condensing + KELVIN;
  const te = evaporating + KELVIN;
  const carnot = te / (tc - te);
  const eer = model.secondLawEfficiency * carnot;

  // Heat through the walls when the air is hotter than the room, plus sun and roof.
  const gain = solarGain(outside);
  const cooling = model.houseLoss * Math.max(outside - model.summerIndoor, 0) + gain;
  const electricity = cooling / eer;
  const rejected = cooling + electricity;
  return {
    mode: 'cooling',
    eer,
    carnot,
    cooling,
    gain,
    electricity,
    rejected,
    load: cooling,
    air: rejected,
    efficiency: eer,
    frequency: compressorFrequency(cooling),
    evaporating,
    condensing,
    discharge: dischargeTemperature(condensing, evaporating),
    lowPressure: saturationPressure(evaporating),
    highPressure: saturationPressure(condensing),
    returnWater: flow + model.waterRise,
  };
}
