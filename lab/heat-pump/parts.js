/**
 * What the user can point at: a pick sphere, a short tooltip with a live
 * number, and a spec card. `when` limits a part to the closed or open unit,
 * to an emitter, or to the season changeover ('show').
 * `s` is the live state: { p (physics.js output), season, outside, inside, flow,
 * mode, wall, floor, window, radiator, soil, dew, valve (0 winter … 1 summer seat) }.
 */
const kW = (v) => `${v.toFixed(1)} kW`;
const deg = (v) => `${Math.round(v)} °C`;
const bar = (v) => `${v.toFixed(1)} bar`;
const summer = (s) => s.season === 'summer';
const airflow = (s) => (s.p.air / (1.2 * 1.005 * 5)) * 3600; // m³/h for a 5 K change of the air
const flowRate = (s) => (s.p.load / (4.18 * Math.abs(s.flow - s.p.returnWater))) * 3600; // L/h
const m3h = (s) => `${Math.round(airflow(s)).toLocaleString('en-US')} m³/h`;
const efficiency = (s) => [summer(s) ? 'EER' : 'COP', s.p.efficiency.toFixed(2)];
/** Which exchanger the hot gas goes to, from the slider position. */
const hotGasTo = (s) => (s.valve > 0.5 ? 'the coil outside' : 'the plate');

export const PARTS = {
  unit: {
    title: 'Outdoor unit', when: 'closed', position: [2.22, 0.78, -0.5], radius: 0.55, view: 'unit',
    text: 'A monoblock: the whole refrigerant circuit is sealed inside this box, so only water and power go to the house. In winter it pulls heat out of the garden air; in summer the same circuit runs backwards and throws the heat of the house into the garden. The summer load includes an assumed gain from the sun through the glazing and a hot roof: 0 kW at 20 °C, rising to 2.5 kW at 35 °C.',
    tip: (s) => `Outdoor unit · ${kW(s.p.electricity)} in`,
    rows: (s) => (summer(s)
      ? [['Heat out of the house', kW(s.p.load)], ['of which sun and roof', kW(s.p.gain)], ['Electricity', kW(s.p.electricity)], ['Into the garden', kW(s.p.air)], efficiency(s)]
      : [['Heat into the house', kW(s.p.load)], ['Electricity', kW(s.p.electricity)], ['From the air', kW(s.p.air)], efficiency(s)]),
  },
  coil: {
    title: 'Outdoor coil', when: 'open', position: [2.05, 0.8, -0.7], radius: 0.3, view: 'unit',
    text: 'Aluminium fins on copper tubes. In winter propane boils inside at a temperature below the outside air, so heat flows from the air into it even on a freezing day; under 5 °C the fins frost up. In summer the valve sends the hot gas here instead: it condenses above the air temperature and the fan carries its heat away.',
    tip: (s) => (summer(s) ? `Coil · R290 condenses at ${deg(s.p.condensing)}` : `Coil · R290 boils at ${deg(s.p.evaporating)}`),
    rows: (s) => [
      ['Air', deg(s.outside)],
      [summer(s) ? 'Condensing' : 'Boiling', deg(summer(s) ? s.p.condensing : s.p.evaporating)],
      ['Pressure', bar(summer(s) ? s.p.highPressure : s.p.lowPressure)],
      ['Air through', m3h(s)],
    ],
  },
  fan: {
    title: 'Fan', when: 'always', position: [2.44, 0.8, -0.7], radius: 0.27, view: 'unit',
    text: 'A slow, large fan with swept blades keeps the noise down, and the inverter slows it further when the load is small. In winter the air leaves about 5 K colder than it came in; in summer about 5 K warmer.',
    tip: (s) => `Fan · ${m3h(s)}`,
    rows: (s) => [['Air in', deg(s.outside)], ['Air out', deg(s.outside + (summer(s) ? 5 : -5))], ['Air through', m3h(s)]],
  },
  compressor: {
    title: 'Compressor', when: 'open', position: [2.33, 0.53, -0.22], radius: 0.1, view: 'machine',
    text: 'An inverter-driven rotary compressor. Squeezing the propane vapour raises its pressure and its temperature: this is where the electricity goes in, and what lifts the heat uphill. Its speed follows the load, from 20 to 90 revolutions a second; below 20 Hz it cannot run smoothly, so the unit switches on and off instead.',
    tip: (s) => `Compressor · ${Math.round(s.hz)} Hz`,
    rows: (s) => [['Speed', `${Math.round(s.hz)} Hz`], ['Load', kW(s.p.load)], ['Suction', bar(s.p.lowPressure)], ['Discharge', bar(s.p.highPressure)], ['Hot gas', deg(s.p.discharge)]],
  },
  reversing: {
    title: 'Four-way valve', when: 'open', position: [2.33, 0.84, -0.22], radius: 0.06, view: 'machine',
    text: 'The hot gas from the compressor fills the valve body. Inside, a slider joins the suction port with one exchanger and leaves the other exchanger open to the hot gas. A small pilot solenoid moves the slider, pushed by the pressure difference, so it only switches with the compressor slowed down. That one move turns the heater into a cooler.',
    tip: (s) => `Four-way valve · hot gas to ${hotGasTo(s)}`,
    rows: (s) => [['Mode', summer(s) ? 'Cooling' : 'Heating'], ['Hot gas to', hotGasTo(s)], ['Hot gas in', deg(s.p.discharge)]],
  },
  portPlate: {
    title: 'Port to the plate', when: 'show', position: [2.29, 0.9, -0.22], radius: 0.02, view: 'valve',
    text: 'This port leads to the plate exchanger inside the unit.',
    tip: (s) => (s.valve > 0.5 ? 'To the plate · cold vapour back' : 'To the plate · hot gas out'),
    rows: () => [],
  },
  portCoil: {
    title: 'Port to the coil', when: 'show', position: [2.37, 0.9, -0.22], radius: 0.02, view: 'valve',
    text: 'This port leads to the outdoor coil.',
    tip: (s) => (s.valve > 0.5 ? 'To the coil · hot gas out' : 'To the coil · cold vapour back'),
    rows: () => [],
  },
  eev: {
    title: 'Expansion valve', when: 'open', position: [2.08, 0.43, -0.28], radius: 0.05, view: 'machine',
    text: 'A stepper motor sets a needle in a tiny orifice. The warm liquid from the condenser squeezes through, its pressure collapses, and it flashes to a cold mist that feeds the evaporator. It sits between the two exchangers, so it works in both seasons: in summer the liquid simply comes from the coil and the mist goes to the plate.',
    tip: (s) => `Valve · ${bar(s.p.highPressure)} → ${bar(s.p.lowPressure)}`,
    rows: (s) => [
      ['From', summer(s) ? 'the coil' : 'the plate'],
      ['In', `${bar(s.p.highPressure)}, ${deg(s.p.condensing)}`],
      ['Out', `${bar(s.p.lowPressure)}, ${deg(s.p.evaporating)}`],
      ['To', summer(s) ? 'the plate' : 'the coil'],
    ],
  },
  plate: {
    title: 'Plate heat exchanger', when: 'open', position: [2.15, 0.61, -0.09], radius: 0.12, view: 'machine',
    text: 'Thin stainless plates brazed together, propane on one side and the house water on the other; the two never touch. In winter hot propane condenses here and warms the water. In summer the cold mist boils here and chills the water.',
    tip: (s) => (summer(s) ? `Evaporator · R290 boils at ${deg(s.p.evaporating)}` : `Condenser · ${deg(s.p.condensing)}`),
    rows: (s) => [
      [summer(s) ? 'Boiling' : 'Condensing', deg(summer(s) ? s.p.evaporating : s.p.condensing)],
      ['Water in', deg(s.p.returnWater)],
      ['Water out', deg(s.flow)],
      [summer(s) ? 'Cold' : 'Heat', kW(s.p.load)],
    ],
  },
  pump: {
    title: 'Circulation pump', when: 'open', position: [2.18, 0.39, 0], radius: 0.06, view: 'machine',
    text: 'A variable-speed pump on the return pushes the water round the house and back through the plate exchanger.',
    tip: (s) => `Pump · ${Math.round(flowRate(s))} L/h`,
    rows: (s) => [['Water', `${Math.round(flowRate(s))} L/h`], ['ΔT', `${Math.round(Math.abs(s.flow - s.p.returnWater))} K`]],
  },
  vessel: {
    title: 'Expansion vessel', when: 'open', position: [2.38, 0.45, -0.05], radius: 0.06, view: 'machine',
    text: 'Water expands when it warms. A rubber membrane with a nitrogen cushion behind it takes up the extra volume, so the pressure stays near 1.5 bar.',
    tip: () => 'Expansion vessel · 8 L',
    rows: () => [['Pre-charge', '1.0 bar'], ['System', '1.5 bar']],
  },
  inverter: {
    title: 'Inverter', when: 'open', position: [2.2, 1.13, -0.1], radius: 0.1, view: 'machine',
    text: 'Turns the 230 V mains into a variable frequency for the compressor motor. The frequency follows the load of the house, so the unit runs slowly for hours instead of starting and stopping.',
    tip: (s) => `Inverter · ${Math.round(s.hz)} Hz`,
    rows: (s) => [['Frequency', `${Math.round(s.hz)} Hz`], ['Power', kW(s.p.electricity)], ['Current', `${(s.p.electricity * 1000 / 230).toFixed(1)} A`]],
  },
  twin: {
    title: 'Pre-insulated twin pipe', when: 'always', position: [1.15, -0.66, 0], radius: 0.16, view: 'underground',
    text: 'Flow and return in one jacket, foamed in PUR, laid on sand below the frost line. The cut shows the two carriers inside. A yellow tape 30 cm above warns the next person with a spade.',
    tip: (s) => `Twin pipe · ${deg(s.flow)} out, ${deg(s.p.returnWater)} back`,
    rows: (s) => [['Flow', deg(s.flow)], ['Return', deg(s.p.returnWater)], ['Depth', '0.66 m'], ['Soil there', deg(s.soil)]],
  },
  sleeve: {
    title: 'Wall sleeve', when: 'always', position: [-0.2, -0.66, 0], radius: 0.13, view: 'underground',
    text: 'The twin pipe enters through a sleeve cast in the foundation, sealed against ground water by an EPDM ring.',
    tip: () => 'Sleeve · sealed with EPDM',
    rows: () => [['Sleeve', 'Ø 220 mm'], ['Seal', 'EPDM ring']],
  },
  power: {
    title: 'Power supply', when: 'always', position: [0.05, 1.41, -0.12], radius: 0.13, view: 'underground',
    text: 'A dedicated breaker in the house, a lockable isolator on the wall, then a cable in a buried duct to the unit. The yellow pulses show the current.',
    tip: (s) => `Power · ${kW(s.p.electricity)}`,
    rows: (s) => [['Power', kW(s.p.electricity)], ['Current', `${(s.p.electricity * 1000 / 230).toFixed(1)} A`]],
  },
  manifold: {
    title: 'Manifold', when: 'always', position: [-0.55, 0.72, -0.27], radius: 0.24, view: 'room',
    text: 'The flow arrives on the top bar and leaves to each circuit through a flow meter; the water comes back to the lower bar and returns to the unit.',
    tip: (s) => `Manifold · ${deg(s.flow)} / ${deg(s.p.returnWater)}`,
    rows: (s) => [['Flow bar', deg(s.flow)], ['Return bar', deg(s.p.returnWater)], ['Water', `${Math.round(flowRate(s))} L/h`]],
  },
  floor: {
    title: 'Underfloor loop', when: 'floor', position: [-2.2, 0.1, -0.5], radius: 0.45, view: 'room',
    text: 'One PE-X loop clipped to the insulation board every 15 cm, buried in screed. A big surface needs only 35 °C water to heat, which keeps the COP high. In summer the same loop cools with 18 °C water; it must stay above the dew point of the room air, or water condenses on the floor.',
    tip: (s) => `Floor · ${s.floor.toFixed(1)} °C on the surface`,
    rows: (s) => (summer(s)
      ? [['Water', `${deg(s.flow)} → ${deg(s.p.returnWater)}`], ['Floor surface', `${s.floor.toFixed(1)} °C`], ['Dew point', `${s.dew.toFixed(1)} °C at ${deg(s.inside)}, 55 %`], ['Condensation', s.floor > s.dew ? 'none, above the dew point' : 'RISK']]
      : [['Water', `${deg(s.flow)} → ${deg(s.p.returnWater)}`], ['Floor surface', `${s.floor.toFixed(1)} °C`], ['Pitch', '150 mm']]),
  },
  radiator: {
    title: 'Radiator, type 22', when: 'radiator', position: [-2.05, 0.6, -3.1], radius: 0.4, view: 'room',
    text: 'Two steel panels with convector fins between them, on two wall brackets. Thermostatic valve on the flow, lockshield on the return, bleed screw at the top. Most of its heat rises as a plume of warm air. It does not cool: chilled water in a radiator would drip with condensate.',
    tip: (s) => `Radiator · ${kW(s.radiator)}`,
    rows: (s) => [['Water', `${deg(s.flow)} → ${deg(s.p.returnWater)}`], ['Output', kW(s.radiator)], ['Size', '600 × 1000 mm']],
  },
  wall: {
    title: 'Wall build-up', when: 'always', position: [-0.2, 2.2, 0], radius: 0.25, view: 'room',
    text: 'Plaster, a 25 cm clay block, 14 cm of EPS insulation and a thin render. Almost all the temperature drop happens across the insulation, in winter and in summer alike: switch on the thermal view to see it.',
    tip: (s) => `Wall · U ${s.wall.U.toFixed(2)} W/m²K`,
    rows: (s) => [['U-value', `${s.wall.U.toFixed(2)} W/m²K`], ['Inner face', `${s.wall.temps[0].toFixed(1)} °C`], ['Outer face', `${s.wall.temps.at(-1).toFixed(1)} °C`]],
  },
  window: {
    title: 'Window', when: 'always', position: [-2.05, 1.62, -3.45], radius: 0.45, view: 'room',
    text: 'Triple glazing set in the insulation layer. In winter still the coldest surface in the room, which is why radiators traditionally sit under windows; in summer the warmest.',
    tip: (s) => `Glass · ${s.window.toFixed(1)} °C inside`,
    rows: (s) => [['U-value', '0.8 W/m²K'], ['Inner glass', `${s.window.toFixed(1)} °C`]],
  },
};

/** Parts that carry a label on screen, at most three at a time. The changeover stages bring their own. */
export const TAGS = {
  closed: ['unit', 'twin', 'emitter'],
  open: ['compressor', 'coil', 'plate'],
};
