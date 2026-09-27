// DOM side of the bench: controls, tiles, torque chart, live sentence, pinned labels, tooltip and card.
import * as THREE from 'three/webgpu';
import {
  ENGINE, MOTOR, TAU, engineTorque, motorTorque, engineEfficiency, motorEfficiency, shaftPower, wasteHeat,
  motorHeat, movingPartCount, cylinderPressure, gasTemperature,
} from './physics.js';
import { sentence } from './story.js';

const $ = (id) => document.getElementById(id);
const MAX_RPM = ENGINE.redlineRpm; // the slider and the chart end at the red line

/** Everything the tiles, the card and the story need, from the shaft speed. */
export function readout(rpm) {
  const engineRunning = rpm >= ENGINE.idleRpm;
  const te = engineTorque(rpm);
  const tm = motorTorque(rpm);
  const ee = engineEfficiency(rpm);
  const em = motorEfficiency(rpm);
  const pe = shaftPower(rpm, te);
  const pm = shaftPower(rpm, tm);
  return {
    rpm, engineRunning, te, tm, ee, em, pe, pm,
    he: wasteHeat(pe, ee),
    hm: motorHeat(rpm),
  };
}

const fixed = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(0) : x.toFixed(1));

export function bindControls(state, { onView, onExplode, onSlow, onCloseCard }) {
  const slider = $('rpm');
  const viewButtons = [...document.querySelectorAll('#views button')];
  const essay = $('essay');
  const shown = {};
  const show = (id, value, prop = 'textContent') => {
    if (shown[id] !== value) $(id)[prop] = shown[id] = value;
  };
  const chart = createChart($('torque-chart'));

  const ui = {
    setRpm(rpm) {
      state.rpmTarget = THREE.MathUtils.clamp(Math.round(rpm / 50) * 50, 0, MAX_RPM);
      ui.sync();
    },
    sync() {
      slider.value = state.rpmTarget;
      slider.style.setProperty('--fill', `${(state.rpmTarget / MAX_RPM) * 100}%`);
      $('slow').setAttribute('aria-pressed', String(state.slow));
      $('slow').textContent = state.slow ? '1/100×' : '1/10×';
      $('explode').setAttribute('aria-pressed', String(state.exploded));
      viewButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
    },
    render(r) {
      show('rpm-value', `${Math.round(r.rpm)} rpm`);
      show('t-te', r.engineRunning ? r.te.toFixed(0) : '0');
      show('t-tm', r.tm.toFixed(0));
      show('t-ee', r.engineRunning ? (r.ee * 100).toFixed(0) : '0');
      show('t-em', (r.em * 100).toFixed(0));
      show('t-he', r.engineRunning ? fixed(r.he) : '0');
      show('t-hm', fixed(r.hm));
      show('sentence', sentence({ rpm: r.rpm, view: state.mode, exploded: state.exploded, beat: state.beat }));
      chart.draw(r.rpm);
    },
  };

  const toggleEssay = (open) => {
    essay.classList.toggle('open', open);
    essay.setAttribute('aria-hidden', String(!open));
  };
  slider.addEventListener('input', () => ui.setRpm(Number(slider.value)));
  viewButtons.forEach((b) => b.addEventListener('click', () => { onCloseCard(); onView(b.dataset.view); }));
  $('slow').addEventListener('click', () => onSlow(!state.slow));
  $('explode').addEventListener('click', () => onExplode(!state.exploded));
  $('about-open').addEventListener('click', () => toggleEssay(true));
  $('about-close').addEventListener('click', () => toggleEssay(false));

  // Silent desktop shortcuts: nothing on screen mentions them.
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.key.startsWith('Arrow')) return;
    const key = e.key.toLowerCase();
    if (key === 'arrowright' || key === 'arrowup') ui.setRpm(state.rpmTarget + 250);
    else if (key === 'arrowleft' || key === 'arrowdown') ui.setRpm(state.rpmTarget - 250);
    else if (key === '0') ui.setRpm(0);
    else if (key === 'i') ui.setRpm(ENGINE.idleRpm);
    else if (key === 'c') ui.setRpm(2500);
    else if (key === 'r') ui.setRpm(6000);
    else if (key === 's') onSlow(!state.slow);
    else if (key === 'e' || key === 'x') onExplode(!state.exploded);
    else if (key === '1') onView('both');
    else if (key === '2') onView('engine');
    else if (key === '3') onView('motor');
    else if (key === '?') toggleEssay(!essay.classList.contains('open'));
    else if (key === 'escape') { toggleEssay(false); onCloseCard(); }
    else return;
    e.preventDefault();
  });
  ui.sync();
  return ui;
}

// ---------- torque against speed, both machines, with the current speed marked ----------
function createChart(canvas) {
  const ctx = canvas.getContext('2d');
  const top = 270; // Nm
  let last = null;
  let size = '';
  const curve = (fn, w, h, pad) => {
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const rpm = (i / 160) * MAX_RPM;
      const x = pad.l + (rpm / MAX_RPM) * (w - pad.l - pad.r);
      const y = pad.t + (1 - fn(rpm) / top) * (h - pad.t - pad.b);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  return {
    draw(rpm) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const key = `${w}x${h}@${devicePixelRatio}`;
      const r = Math.round(rpm / 10) * 10;
      if (key === size && r === last) return;
      if (key !== size) {
        canvas.width = Math.round(w * devicePixelRatio);
        canvas.height = Math.round(h * devicePixelRatio);
        size = key;
      }
      last = r;
      const pad = { l: 4, r: 4, t: 6, b: 12 };
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(201, 209, 217, 0.12)';
      ctx.beginPath();
      ctx.moveTo(pad.l, h - pad.b + 0.5);
      ctx.lineTo(w - pad.r, h - pad.b + 0.5);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#58a6ff';
      curve(motorTorque, w, h, pad);
      ctx.strokeStyle = '#ffa657';
      curve(engineTorque, w, h, pad);
      const x = pad.l + (r / MAX_RPM) * (w - pad.l - pad.r);
      ctx.strokeStyle = 'rgba(240, 246, 252, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, pad.t - 4);
      ctx.lineTo(x + 0.5, h - pad.b);
      ctx.stroke();
      for (const [fn, fill] of [[motorTorque, '#58a6ff'], [engineTorque, '#ffa657']]) {
        const y = pad.t + (1 - fn(r) / top) * (h - pad.t - pad.b);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#6e7681';
      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillText('0', pad.l, h);
      ctx.textAlign = 'right';
      ctx.fillText(`${MAX_RPM} rpm`, w - pad.r, h);
      ctx.textAlign = 'center';
      ctx.fillText('torque', w / 2, h);
    },
  };
}

// ---------- live facts about each part: tooltip line and spec card ----------

const ENGINE_PARTS = new Set(['block', 'head', 'crank', 'piston', 'rod', 'valve', 'cam', 'belt', 'spark', 'flywheel', 'manifold', 'sump']);
export const isEnginePart = (part) => ENGINE_PARTS.has(part);

const PEAK_PRESSURE = Math.max(...Array.from({ length: 720 }, (_, i) => cylinderPressure((i * Math.PI) / 360)));
const PEAK_TEMPERATURE = Math.max(...Array.from({ length: 720 }, (_, i) => gasTemperature((i * Math.PI) / 360)));
const CROWN_AREA = Math.PI * (ENGINE.bore / 2) ** 2;

export function partInfo(part, live, pointerType = 'mouse') {
  const r = live.readout;
  const more = pointerType === 'mouse' ? 'click for details' : 'tap again for details';
  const rpm = Math.round(r.rpm);
  const run = r.engineRunning;
  const kw = (x) => `${x.toFixed(x < 10 ? 1 : 0)} kW`;
  const info = {
    block: {
      tip: 'Cylinder block', kicker: 'Engine', title: 'Cylinder block', accent: 'var(--orange)',
      rows: [['Cylinders', '4 in line'], ['Bore × stroke', '86 × 86 mm'], ['Displacement', '1998 cm³'], ['Block', 'aluminium, iron liners']],
      note: 'Cut open down the middle: the red faces are the cut. The water jacket round the liners carries away part of the waste heat.',
    },
    head: {
      tip: 'Cylinder head', kicker: 'Engine', title: 'Cylinder head', accent: 'var(--orange)',
      rows: [['Valves', '4 per cylinder'], ['Compression', `${ENGINE.compressionRatio} : 1`], ['Peak pressure', `${PEAK_PRESSURE.toFixed(0)} bar`], ['Peak gas temperature', `${Math.round(PEAK_TEMPERATURE - 273)} °C`]],
      note: 'The chambers, the valve seats and the spark plugs. The exhaust half of the head is cut away to show the valve train.',
    },
    crank: {
      tip: `Crankshaft ${run ? `${rpm} rpm` : 'stopped'}`, kicker: 'Engine', title: 'Crankshaft', accent: 'var(--orange)',
      rows: [['Speed', run ? `${rpm} rpm` : 'stalled'], ['Torque', `${r.te.toFixed(0)} Nm`], ['Power', kw(r.pe)], ['Main bearings', '5']],
      note: 'Pistons 1 and 4 move together, 2 and 3 opposite. The firing order 1-3-4-2 gives one push every half turn.',
    },
    piston: {
      tip: 'Piston', kicker: 'Engine · 4 of them', title: 'Pistons', accent: 'var(--orange)',
      rows: [['Mean speed', `${((2 * ENGINE.stroke * (run ? rpm : 0)) / 60).toFixed(1)} m/s`], ['Peak force on the crown', `${((PEAK_PRESSURE * 1e5 * CROWN_AREA) / 1000).toFixed(0)} kN`], ['Rings', '3 each']],
      note: 'Each piston stops and reverses twice per turn. At the red line that is more than 400 times a second.',
    },
    rod: {
      tip: 'Connecting rod', kicker: 'Engine · 4 of them', title: 'Connecting rods', accent: 'var(--orange)',
      rows: [['Length', `${ENGINE.rod * 1000} mm`], ['Rod / crank radius', (ENGINE.rod / (ENGINE.stroke / 2)).toFixed(1)], ['Largest angle', `${(Math.asin(ENGINE.stroke / 2 / ENGINE.rod) * 180 / Math.PI).toFixed(1)}°`]],
      note: 'They turn the up-and-down push of the pistons into rotation of the crank.',
    },
    valve: {
      tip: 'Valves and springs', kicker: 'Engine · 16 of each', title: 'Valves, springs, buckets', accent: 'var(--orange)',
      rows: [['Lift', `${ENGINE.maxValveLift * 1000} mm`], ['Intake open', '10° before top to 50° after bottom'], ['Exhaust open', '50° before bottom to 10° after top'], ['Openings per second', `${run ? Math.round(rpm / 120) : 0} each`]],
      note: 'The exhaust valve heads glow as a hint of their heat: they run near 700 °C, hot enough to glow faintly in the dark.',
    },
    cam: {
      tip: `Camshaft ${run ? `${Math.round(rpm / 2)} rpm` : 'stopped'}`, kicker: 'Engine · 2 of them', title: 'Camshafts', accent: 'var(--orange)',
      rows: [['Speed', `${run ? Math.round(rpm / 2) : 0} rpm (half the crank)`], ['Lobes', '8 per shaft'], ['Drive', 'toothed belt, 2 : 1']],
      note: 'Each valve must open once every two turns of the crank, so the cams turn at half speed.',
    },
    belt: {
      tip: 'Timing belt', kicker: 'Engine', title: 'Timing belt', accent: 'var(--orange)',
      rows: [['Ratio', '2 : 1'], ['Belt speed', `${(((run ? rpm : 0) / 60) * TAU * 0.0215).toFixed(1)} m/s`], ['Tooth pitch', '9.5 mm']],
      note: 'It keeps the valves in step with the pistons. The small pulleys are the tensioner and the water pump.',
    },
    spark: {
      tip: 'Spark plugs and coils', kicker: 'Engine · 4 of them', title: 'Ignition', accent: 'var(--orange)',
      rows: [['Sparks per second', run ? String(Math.round((rpm / 60) * 2)) : '0'], ['Spark', '15° before the top'], ['Burn', 'about 45° of crank']],
      note: 'The flash you see is the burn: it starts at the spark and is over well before the piston reaches the bottom.',
    },
    flywheel: {
      tip: 'Flywheel', kicker: 'Engine', title: 'Flywheel', accent: 'var(--orange)',
      rows: [['Ring gear', '132 teeth'], ['Diameter', '280 mm']],
      note: 'Its inertia carries the crank through the strokes that push nothing. The starter motor turns the ring gear.',
    },
    manifold: {
      tip: 'Intake manifold', kicker: 'Engine', title: 'Intake manifold', accent: 'var(--orange)',
      rows: [['Throttle', 'wide open'], ['Pressure', '0.95 bar'], ['Runners', '4']],
      note: 'Air comes in through the throttle body and is shared out to the four intake ports.',
    },
    sump: {
      tip: 'Oil pan', kicker: 'Engine', title: 'Oil pan', accent: 'var(--orange)',
      rows: [['Oil', 'about 4 litres']],
      note: 'Oil keeps a film between the moving metal parts, and carries part of the heat away.',
    },
    housing: {
      tip: `Motor housing · ${kw(r.hm)} of heat`, kicker: 'Motor', title: 'Housing', accent: 'var(--blue)',
      rows: [['Cooling', 'water jacket'], ['Heat to remove', kw(r.hm)], ['Engine, same speed', run ? kw(r.he) : '—']],
      note: 'A wedge is cut away. The water channel between the two walls takes the heat from the coils and the iron.',
    },
    stator: {
      tip: 'Stator', kicker: 'Motor', title: 'Stator', accent: 'var(--blue)',
      rows: [['Teeth', String(MOTOR.slots)], ['Iron', 'stacked thin steel sheets'], ['Moving parts', '0']],
      note: 'Thin insulated sheets instead of solid iron: a solid core would heat up with the changing field.',
    },
    coil: {
      tip: 'Coils', kicker: 'Motor', title: 'Coils', accent: 'var(--blue)',
      rows: [['Coils', `${MOTOR.slots}, one per tooth`], ['Phases', '3'], ['Current', `${Math.round((r.tm / MOTOR.peakTorque) * 100)}% of full`]],
      note: 'The colour is the direction of the current. The pattern turns round the motor, and the magnets follow it.',
    },
    rotor: {
      tip: `Rotor ${rpm} rpm`, kicker: 'Motor · the one moving part', title: 'Rotor', accent: 'var(--blue)',
      rows: [['Speed', `${rpm} rpm`], ['Torque', `${r.tm.toFixed(0)} Nm`], ['Power', kw(r.pm)], ['Magnets', `${MOTOR.poles} NdFeB, north red, south blue`]],
      note: 'Full push from standstill: the current, not the speed, makes the torque.',
    },
    inverter: {
      tip: 'Inverter', kicker: 'Motor', title: 'Inverter', accent: 'var(--blue)',
      rows: [['Converts', 'battery DC to 3-phase AC'], ['Frequency', `${Math.round((r.rpm / 60) * (MOTOR.poles / 2))} Hz`]],
      note: 'It sets the current in each coil many thousand times a second. Its own losses, 1 to 3 %, are not in the motor figure.',
    },
    cables: {
      tip: 'Phase cables', kicker: 'Motor', title: 'Phase cables', accent: 'var(--blue)',
      rows: [['Phases', '3'], ['Colour', 'orange: high voltage']],
      note: 'One cable per phase, from the inverter to the busbar rings behind the coils.',
    },
  }[part];
  return { ...info, tip: `<b>${info.tip}</b><small>${more}</small>` };
}

export function createTooltip() {
  const tip = $('object-tip');
  let timer = null;
  return {
    show(html, x, y, hideAfter = 0) {
      if (tip.innerHTML !== html) tip.innerHTML = html;
      tip.classList.add('visible');
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      // Beside the pointer, never off screen, never under the finger.
      const left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8);
      const top = y - h - 18 > 8 ? y - h - 18 : y + 18;
      tip.style.transform = `translate(${left}px, ${top}px)`;
      clearTimeout(timer);
      if (hideAfter) timer = setTimeout(() => tip.classList.remove('visible'), hideAfter);
    },
    hide() {
      clearTimeout(timer);
      tip.classList.remove('visible');
    },
  };
}

export function createCard(live) {
  const el = $('card');
  const rowsEl = $('card-rows');
  const card = {
    current: null,
    onClose: null,
    open(part) {
      card.current = part;
      const info = partInfo(part, live);
      el.style.setProperty('--card-accent', info.accent);
      $('card-kicker').textContent = info.kicker;
      $('card-title').textContent = info.title;
      $('card-note').textContent = info.note;
      rowsEl.innerHTML = info.rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      el.classList.add('open');
      el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('card-open');
    },
    refresh() {
      if (!card.current) return;
      const values = rowsEl.querySelectorAll('dd');
      partInfo(card.current, live).rows.forEach(([, v], i) => {
        if (values[i] && values[i].textContent !== v) values[i].textContent = v;
      });
    },
    close() {
      if (!card.current) return;
      card.current = null;
      el.classList.remove('open');
      el.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('card-open');
      card.onClose?.();
    },
  };
  $('card-close').addEventListener('click', () => card.close());
  return card;
}

// Three small labels pinned to 3D points, shown only inside the free band of the screen.
export function createChips() {
  const layer = $('chips');
  const make = (html, dot) => {
    const el = document.createElement('div');
    el.className = 'chip';
    el.innerHTML = html;
    el.style.setProperty('--dot', dot);
    layer.appendChild(el);
    return el;
  };
  const engine = make(`Engine <small>${movingPartCount('engine')} moving parts</small>`, 'var(--orange)');
  const motor = make(`Motor <small>${movingPartCount('motor')} moving part</small>`, 'var(--blue)');
  const firing = make('<span></span> <small></small>', '#ffd08a');
  const firingName = firing.querySelector('span');
  const firingNote = firing.querySelector('small');
  const v = new THREE.Vector3();
  let firingText = '';
  // The machine whose part has its tooltip open: its tag steps aside.
  let hidden = null;
  let timer = null;

  // A chip sits centred above its point, so the point can be chosen in clear air over the part.
  const place = (el, camera, point, band, visible = true) => {
    v.copy(point).project(camera);
    const x = ((v.x + 1) / 2) * window.innerWidth;
    const y = ((1 - v.y) / 2) * window.innerHeight;
    const half = el.offsetWidth / 2;
    const show = visible && el !== hidden && v.z < 1 && x - half > band.left + 4 && x + half < band.right - 4 && y - 30 > band.top && y < band.bottom;
    el.style.opacity = show ? 1 : 0;
    if (!show) return;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  };
  return {
    /** points: world positions; fire: { cylinder, fast } or null. */
    update(camera, band, points, fire) {
      place(engine, camera, points.engine, band);
      place(motor, camera, points.motor, band);
      if (fire) {
        const text = fire.fast ? 'Fires 1-3-4-2|one every half turn' : `Cylinder ${fire.cylinder}|fires`;
        if (text !== firingText) {
          const [a, b] = text.split('|');
          firingName.textContent = a;
          firingNote.textContent = b;
          firingText = text;
        }
      }
      place(firing, camera, points.firing, band, Boolean(fire));
    },
    focus(part, ms = 0) {
      clearTimeout(timer);
      hidden = part ? (isEnginePart(part) ? engine : motor) : null;
      if (hidden && ms) timer = setTimeout(() => { hidden = null; }, ms);
    },
  };
}
