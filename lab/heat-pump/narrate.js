/** The live sentence: what the heat pump does right now, in one or two short lines. */
const num = (v, digits = 1) => `<span class="num">${v.toFixed(digits)}</span>`;

function winter({ p, outside, flow, mode, open, thermal }) {
  if (thermal) {
    return mode === 'floor'
      ? `The whole floor is the heater, fed with only ${num(flow, 0)} °C water. The wall is warm inside and cold outside: the drop happens in the <b>insulation</b>.`
      : `The radiator runs at ${num(flow, 0)} °C and heats mostly by a <span class="warm">plume of warm air</span>. The window stays the coldest surface in the room.`;
  }
  if (open) {
    return `Propane boils at ${num(p.evaporating, 0)} °C in the coil, the compressor squeezes it from ${num(p.lowPressure)} to ${num(p.highPressure)} bar at ${num(p.frequency, 0)} Hz, and it condenses at ${num(p.condensing, 0)} °C in the plate, into the water.`;
  }
  if (outside <= -15) {
    return `At ${num(outside, 0)} °C the air still gives up heat: the refrigerant boils at ${num(p.evaporating, 0)} °C. The compressor runs near full speed, ${num(p.frequency, 0)} Hz, and ${num(p.electricity)} kW buys ${num(p.load)} kW.`;
  }
  const share = Math.round((p.air / p.load) * 100);
  return `<span class="blue">${share}%</span> of the heat comes from the garden air, the rest from the ${num(p.electricity)} kW of electricity. The colder it is, the harder the compressor lifts.`;
}

function summer({ p, outside, flow, open, thermal, dew }) {
  if (thermal) {
    return `The floor is now the cooler, fed with ${num(flow, 0)} °C water and kept above the ${num(dew, 0)} °C dew point. The window and the outer wall are the <span class="warm">warm</span> side.`;
  }
  if (open) {
    return `The cycle runs backwards: propane boils at ${num(p.evaporating, 0)} °C in the plate and chills the water, the compressor lifts it to ${num(p.highPressure)} bar, and it condenses at ${num(p.condensing, 0)} °C in the coil outside.`;
  }
  return `It is ${num(outside, 0)} °C outside. The pump moves heat out of the house and throws it into the garden: ${num(p.electricity)} kW moves ${num(p.load)} kW, EER ${num(p.efficiency)}.`;
}

export function narrate(live) {
  return live.season === 'summer' ? summer(live) : winter(live);
}
