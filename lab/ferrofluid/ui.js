// DOM side of the bench: controls, live sentence, pinned labels, tooltip and spec card.
import * as THREE from 'three/webgpu';
import { LAYOUT } from './diorama.js';
import { hexSpacing, spikeCount } from './physics.js';

const $ = (id) => document.getElementById(id);
const mt = (b) => (Math.abs(b) * 1000).toFixed(1);

export function bindControls(state, { maxCurrent, onPreset, onView, onDrive, onCloseCard }) {
  const slider = $('current');
  const presetButtons = [...document.querySelectorAll('#presets button')];
  const viewButtons = [...document.querySelectorAll('#views button')];
  const drive = $('drive');
  const essay = $('essay');
  const shown = {};
  const show = (id, value, prop = 'textContent') => {
    if (shown[id] !== value) $(id)[prop] = shown[id] = value;
  };

  const ui = {
    setTarget(amps) {
      state.target = THREE.MathUtils.clamp(amps, 0, maxCurrent);
      state.preset = null;
      ui.sync();
    },
    sync() {
      slider.value = state.target;
      slider.style.setProperty('--fill', `${(state.target / maxCurrent) * 100}%`);
      presetButtons.forEach((b) => b.classList.toggle('active', b.dataset.preset === state.preset));
    },
    markView(name) {
      viewButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    },
    render(r) {
      show('t-field', mt(r.bCentre));
      show('t-ratio', String(Math.round(r.ratio * 100)));
      show('t-count', String(r.count));
      $('t-ratio').closest('.tile').classList.toggle('hot', r.ratio >= 1);
      $('t-count').closest('.tile').classList.toggle('hot', r.count > 0);
      show('current-value', `${state.current.toFixed(2)} A`);
      show('sentence', r.text, 'innerHTML');
    },
  };

  const setDrive = (ac) => {
    drive.textContent = ac ? 'AC' : 'DC';
    drive.setAttribute('aria-pressed', String(ac));
    onDrive(ac);
  };
  const toggleEssay = (open) => {
    essay.classList.toggle('open', open);
    essay.setAttribute('aria-hidden', String(!open));
  };

  presetButtons.forEach((b) => b.addEventListener('click', () => onPreset(b.dataset.preset)));
  slider.addEventListener('input', () => ui.setTarget(Number(slider.value)));
  drive.addEventListener('click', () => setDrive(!state.ac));
  viewButtons.forEach((b) => b.addEventListener('click', () => { onCloseCard(); onView(b.dataset.view); }));
  $('about-open').addEventListener('click', () => toggleEssay(true));
  $('about-close').addEventListener('click', () => toggleEssay(false));

  // Silent desktop shortcuts: nothing on screen mentions them.
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.key.startsWith('Arrow')) return;
    const key = e.key.toLowerCase();
    if (key === 'arrowright' || key === 'arrowup') ui.setTarget(state.target + 0.1);
    else if (key === 'arrowleft' || key === 'arrowdown') ui.setTarget(state.target - 0.1);
    else if (key === 'm') onPreset(state.magnetDown ? 'forest' : 'magnet');
    else if (key === 'a') setDrive(!state.ac);
    else if (key === '1') onView('hero');
    else if (key === '2') onView('top');
    else if (key === '3') onView('low');
    else if (key === '4') onView('inside');
    else if (key === '?' || key === 'i') toggleEssay(!essay.classList.contains('open'));
    else if (key === 'escape') { toggleEssay(false); onCloseCard(); }
    else return;
    e.preventDefault();
  });
  return ui;
}

// ---------- what is happening right now ----------
// spikeMm: spike height in mm per unit amplitude.
export function describe(model, state, live, spikeMm) {
  const bCentre = Math.abs(model.sample(state.magnetX / 100, state.magnetZ / 100).field);
  const ratio = bCentre / live.bc;
  const amplitude = model.maxAmplitude() - model.floor;
  const height = Math.max(amplitude, 0) * spikeMm;
  const count = spikeCount(model.activeArea(0.3), live.lambda);
  const spacing = (hexSpacing(live.lambda) * 1000).toFixed(1);
  let text;
  if (state.view === 'inside') {
    text = Math.abs(state.bCoil) > 0
      ? `Inside the coil the field lines run straight through the core, fan out over the dish and close back around the outside. <b>${mt(state.bCoil)} mT</b> reach the fluid.`
      : `The coil is cut open. Turn the current up to see its field lines: through the core, out over the dish, back down outside the winding.`;
  } else if (state.magnetT > 0.05 && state.magnetDown) {
    text = count > 0
      ? `Under the magnet: <b>${mt(bCentre)} mT</b> and <b>${count} spikes</b>. Drag it and the mound follows a moment later, because the oil is viscous.`
      : `Under the magnet the field is <b>${mt(bCentre)} mT</b>, ${Math.round(ratio * 100)}% of the threshold. Drag it across the dish to pull the surface along.`;
  } else if (amplitude > 0.3 && ratio < 1) {
    text = `Below the threshold at <b>${mt(bCentre)} mT</b> and the spikes are still standing. The transition is <span class="c-purple">hysteretic</span>: lower the current a little more to flatten them.`;
  } else if (amplitude > 0.3) {
    text = `Magnetic pressure beats surface tension. <b>${count} spikes</b>, <b>${height.toFixed(1)} mm</b> tall and <span class="c-blue">${spacing} mm</span> apart, lock into a hexagonal lattice.`;
  } else if (ratio >= 1) {
    text = `Past the threshold: <b>${mt(bCentre)}</b> against <span class="c-blue">${mt(live.bc)} mT</span>. Ripples grow, slowly at first, because this close to the onset the instability has almost no push.`;
  } else if (Math.abs(state.bCoil) > 0) {
    text = `At <b>${mt(bCentre)} mT</b> the field is ${Math.round(ratio * 100)}% of the threshold. Gravity and surface tension still win, so the liquid stays a <span class="c-blue">flat black mirror</span>.`;
  } else {
    text = `The coil is off. The ferrofluid is a flat black mirror. It needs <span class="c-orange">${mt(live.bc)} mT</span> before it does anything at all.`;
  }
  if (state.ac) text = `AC at <b>${live.acHz} Hz</b>: ${text}`;
  return { bCentre, ratio, height, count, text };
}

// ---------- live facts about each part: tooltip line and spec card ----------
export function partInfo(part, live, pointerType = 'mouse') {
  const { state } = live;
  const more = pointerType === 'mouse' ? 'click for details' : 'tap again for details';
  const amps = state.current.toFixed(2);
  const volts = live.volts().toFixed(1);
  const watts = (state.current * live.volts()).toFixed(1);
  const drive = state.ac ? `AC ${live.acHz} Hz` : 'DC';
  if (part === 'magnet') {
    const gap = (live.magnetGap() * 1000).toFixed(0);
    const field = mt(live.magnetField());
    return {
      tip: `<b>NdFeB magnet</b> ${gap} mm up · ${field} mT at the fluid<small>drag to move it · ${more}</small>`,
      kicker: 'Permanent magnet', accent: 'var(--purple)', title: 'NdFeB N42 disc',
      rows: [['Size', 'Ø20 × 15 mm'], ['Remanence', '1.3 T'], ['Above the fluid', `${gap} mm`], ['Field at the fluid', `${field} mT`]],
      note: 'Drag it across the dish. The surface bulges under it, and spikes grow wherever the total field passes the threshold.',
    };
  }
  if (part === 'fluid') {
    const r = state.readout;
    return {
      tip: `<b>Ferrofluid</b> ${r ? Math.round(r.ratio * 100) : 0}% of the threshold · λ<sub>c</sub> ${(live.lambda * 1000).toFixed(1)} mm<small>tap for a ripple · ${more}</small>`,
      kicker: 'Ferrofluid', accent: 'var(--blue)', title: 'Oil and 10 nm magnetite',
      rows: [
        ['Density', '1210 kg/m³'], ['Surface tension', '25 mN/m'], ['Susceptibility χ', '1.6'],
        ['Critical field', `${mt(live.bc)} mT`], ['Spike spacing', `${(hexSpacing(live.lambda) * 1000).toFixed(1)} mm`],
        ['Spikes now', String(r ? r.count : 0)],
      ],
      note: 'Tap the surface to send a ripple through the pattern.',
    };
  }
  if (part === 'coil') {
    const field = mt(state.bCoil);
    return {
      tip: `<b>Electromagnet</b> ${amps} A · ${field} mT at the dish<small>${more}</small>`,
      kicker: 'Electromagnet', accent: 'var(--orange)', title: `${live.coil.turns} turns on soft iron`,
      rows: [
        ['Wire', `Ø${live.coil.wireMm} mm enamelled Cu`], ['Resistance', `${live.coil.ohms} Ω`],
        ['Current', `${amps} A ${drive}`], ['Field at the dish', `${field} mT`], ['Heat', `${watts} W`],
      ],
      note: `An almost uniform vertical field over the dish, ${(live.coilGain * 1000).toFixed(1)} mT per ampere.`,
    };
  }
  // knob and supply
  return {
    tip: `<b>Current knob</b> ${amps} A · ${volts} V<small>drag to turn · ${more}</small>`,
    kicker: 'Bench supply', accent: 'var(--green)', title: 'Constant-current source',
    rows: [
      ['Set', `${state.target.toFixed(2)} A`], ['Output', `${amps} A ${drive}`], ['Voltage', `${volts} V`],
      ['Power', `${watts} W`], ['Limits', `${live.maxCurrent} A · 30 V`],
    ],
    note: 'Turn the knob or use the slider. The output ramps at 1.2 A/s, like a real supply.',
  };
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
export function createChips(live) {
  const layer = $('chips');
  const make = (html, dot) => {
    const el = document.createElement('div');
    el.className = 'chip';
    el.innerHTML = html;
    el.style.setProperty('--dot', dot);
    layer.appendChild(el);
    return el;
  };
  const knob = make('Current <small></small>', 'var(--orange)');
  const knobValue = knob.querySelector('small');
  const dish = make(`λ<sub>c</sub> <small>${(live.lambda * 1000).toFixed(1)} mm</small>`, 'var(--blue)');
  const magnet = make('Magnet <small>drag me</small>', 'var(--purple)');
  const dishPoint = new THREE.Vector3(LAYOUT.dishRadius * 0.75, LAYOUT.fluidLevel + 1.4, LAYOUT.dishRadius * 0.75);
  const v = new THREE.Vector3();
  const world = new THREE.Vector3();
  let lastAmps = '';
  // The part whose tooltip is open: its tag steps aside, so the part never carries two labels.
  const owner = { knob, supply: knob, fluid: dish, magnet };
  let hidden = null;
  let timer = null;

  const place = (el, camera, point, band) => {
    v.copy(point).project(camera);
    const x = ((v.x + 1) / 2) * window.innerWidth;
    const y = ((1 - v.y) / 2) * window.innerHeight;
    const show = el !== hidden && v.z < 1 && x > band.left + 8 && x < band.right - 90 && y > band.top + 12 && y < band.bottom - 12;
    el.style.opacity = show ? 1 : 0;
    if (!show) return;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };
  return {
    update(camera, diorama, band) {
      const amps = `${live.state.current.toFixed(2)} A`;
      if (amps !== lastAmps) knobValue.textContent = lastAmps = amps;
      diorama.supply.knob.getWorldPosition(world);
      place(knob, camera, world.add(v.set(1.4, 3.2, 0)), band);
      place(dish, camera, dishPoint, band);
      diorama.magnet.getWorldPosition(world);
      place(magnet, camera, world.add(v.set(2, 0.4, 0)), band); // beside the magnet, not above it
    },
    focus(part, ms = 0) {
      clearTimeout(timer);
      hidden = owner[part] ?? null;
      if (hidden && ms) timer = setTimeout(() => { hidden = null; }, ms);
    },
  };
}
