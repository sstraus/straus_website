/**
 * One pen sketch per experiment, drawn in a 400 × 260 viewBox. Coordinates are hand-placed:
 * each drawing is a design sketch of what the 3D scene shows, not a screenshot of it.
 * Groups with a class (rock, spin, pulse, rise, travel, flicker) get an idle animation in hub.css.
 */
import { seeded } from './sketch.js';

const TAU = Math.PI * 2;

export function tennisRacket(p) {
  const C = [185, 95], th = (35 * Math.PI) / 180;
  const u = [Math.sin(th), -Math.cos(th)], v = [Math.cos(th), Math.sin(th)];
  const at = (lx, ly) => [C[0] + v[0] * lx + u[0] * ly, C[1] + v[1] * lx + u[1] * ly];
  const cm = at(0, -40);

  p.line(...at(0, 108), ...at(0, -200), { tone: 'faint', dash: true });
  p.group('rock', () => {
    p.ellipse(...C, 58, 80, { rot: 35, width: 1.8 });
    p.ellipse(...C, 51, 73, { rot: 35, tone: 'faint' });
    for (let lx = -44; lx <= 44; lx += 11) {
      const ly = 73 * Math.sqrt(1 - (lx / 51) ** 2);
      p.line(...at(lx, -ly), ...at(lx, ly), { tone: 'faint', rough: 0.4, overshoot: 0 });
    }
    for (let ly = -66; ly <= 66; ly += 11) {
      const lx = 51 * Math.sqrt(1 - (ly / 73) ** 2);
      p.line(...at(-lx, ly), ...at(lx, ly), { tone: 'faint', rough: 0.4, overshoot: 0 });
    }
    p.smooth([at(-37, -61), at(-15, -95), at(-7, -120)]);
    p.smooth([at(37, -61), at(15, -95), at(7, -120)]);
    p.line(...at(-24, -80), ...at(24, -80), { tone: 'faint' });
    p.line(...at(-7, -120), ...at(-7, -190));
    p.line(...at(7, -120), ...at(7, -190));
    p.line(...at(-8, -190), ...at(8, -190));
    for (let ly = -126; ly > -186; ly -= 6) p.line(...at(-7, ly), ...at(7, ly - 5), { tone: 'faint', passes: 1, overshoot: 0 });
  }, { origin: cm });

  p.line(...at(-100, -40), ...at(100, -40), { tone: 'orange', dash: true, flow: true });
  p.arcArrow(...at(82, -40), 9, 24, { rot: 35, from: 0.5, to: 5.7, tone: 'orange' });
  p.dot(...cm, 2.8, { tone: 'orange' });
  p.text(262, 206, 'the middle axis', { tone: 'orange' });
  p.text(260, 22, 'handle axis: steady');
}

export function ferrofluid(p) {
  // Drawn in the order the bench loads: coil, dish and fluid, supply, stand, leads, spikes, field.
  const cx = 168;

  // Electromagnet: enamelled windings between two flanges.
  p.ellipse(cx, 212, 50, 11);
  p.line(cx - 50, 212, cx - 50, 246);
  p.line(cx + 50, 212, cx + 50, 246);
  p.ellipse(cx, 246, 50, 11, { from: 0, to: Math.PI });
  for (let y = 218; y <= 244; y += 3.4) {
    p.ellipse(cx, y, 50, 11, { from: 0.2, to: Math.PI - 0.2, tone: 'orange', passes: 1, rough: 0.3 });
  }

  // Glass dish with the black fluid.
  p.ellipse(cx, 150, 100, 25, { width: 1.6 });
  p.ellipse(cx, 150, 95, 22, { tone: 'faint' });
  p.line(cx - 100, 150, cx - 92, 176);
  p.line(cx + 100, 150, cx + 92, 176);
  p.ellipse(cx, 176, 92, 20, { from: 0.05, to: Math.PI - 0.05 });
  p.ellipse(cx, 157, 87, 18, { tone: 'faint', fill: '#07090d' });

  // Bench supply: display, current dial, binding posts.
  p.rect(298, 178, 88, 66);
  p.rect(307, 187, 42, 18, { tone: 'green' });
  p.text(311, 200, '2.60 A', { tone: 'green' });
  p.circle(366, 216, 12);
  p.line(366, 216, 373, 206, { tone: 'orange', overshoot: 0 });
  p.dot(313, 230, 3, { tone: 'red' });
  p.dot(329, 230, 3);

  // Retort stand: foot, rod, swivel arm and the magnet in its holder.
  p.line(12, 252, 60, 252);
  p.line(34, 252, 34, 24);
  p.rect(28, 26, 12, 12);
  p.line(40, 32, cx + 8, 32);
  p.line(cx, 32, cx, 62, { tone: 'faint' });
  p.rect(cx - 11, 62, 22, 13, { tone: 'purple' });
  p.text(cx + 18, 73, 'NdFeB', { tone: 'purple' });

  // Leads from the posts to the coil.
  p.smooth([[313, 233], [302, 252], [258, 258], [cx + 52, 238]], { tone: 'red', passes: 1 });
  p.smooth([[329, 233], [320, 258], [262, 266], [cx + 50, 244]], { passes: 1 });

  // Rosensweig spikes on a hexagonal lattice, tallest in the middle.
  const spikes = [];
  for (let j = -3; j <= 3; j++) {
    for (let i = -7; i <= 7; i++) {
      const x = cx + (i + (j & 1) * 0.5) * 13, y = 157 + j * 4.6;
      if (((x - cx) / 79) ** 2 + ((y - 157) / 15.5) ** 2 >= 1) continue;
      const s = 0.8 + (j + 3) * 0.05;
      const h = (8 + 30 * Math.exp(-(((x - cx) / 52) ** 2))) * s;
      spikes.push({ x, y, h, w: 5.4 * s });
    }
  }
  spikes.sort((a, b) => a.y - b.y);
  p.group('pulse', () => {
    for (const k of spikes) {
      p.shape([
        [k.x - k.w, k.y], [k.x - k.w * 0.28, k.y - k.h * 0.45], [k.x, k.y - k.h],
        [k.x + k.w * 0.28, k.y - k.h * 0.45], [k.x + k.w, k.y],
      ], { fill: '#06080c', rough: 0.35 });
    }
  }, { origin: [cx, 160] });

  // Field lines of the coil, last: they close outside the winding.
  const loop = (s, w, h) => p.smooth([
    [cx + s * 12, 206], [cx + s * 18, 120], [cx + s * (48 + w * 0.8), 74 - h],
    [cx + s * (102 + w * 0.8), 108 - h / 2], [cx + s * (96 + w * 0.5), 212], [cx + s * 46, 248],
  ], { tone: 'blue', dash: true, flow: true, passes: 1 });
  loop(-1, 0, 0);
  loop(1, 0, 0);
  loop(-1, 34, 24);
  loop(1, 34, 24);
  p.text(cx + 104, 64, 'B', { tone: 'blue' });
  p.text(cx - 30, 274, '860 turns', { tone: 'orange' });
}

export function doubleSlit(p) {
  p.line(22, 116, 92, 116);
  p.line(22, 144, 92, 144);
  p.ellipse(22, 130, 6, 14);
  p.ellipse(92, 130, 6, 14, { from: -Math.PI / 2, to: Math.PI / 2 });
  p.line(92, 122, 106, 127);
  p.line(92, 138, 106, 133);
  for (let x = 34; x < 84; x += 8) p.line(x, 118, x, 142, { tone: 'faint', passes: 1, overshoot: 0 });
  p.line(106, 130, 186, 130, { tone: 'blue', dash: true, flow: true, passes: 1 });
  p.group('travel', () => p.dot(108, 130, 2.6, { tone: 'blue' }));

  p.line(188, 40, 198, 32);
  p.line(196, 40, 206, 32);
  p.line(198, 32, 206, 32);
  p.line(206, 32, 206, 212);
  p.line(196, 220, 206, 212);
  for (const [y0, y1] of [[40, 112], [120, 140], [148, 220]]) p.rect(188, y0, 8, y1 - y0);

  p.group('pulse-soft', () => {
    for (const cy of [116, 144]) {
      for (let r = 18; r <= 126; r += 18) {
        p.ellipse(196, cy, r, r, { from: -0.85, to: 0.85, tone: 'purple', passes: 1, rough: 0.4 });
      }
    }
  });

  const skew = (x) => -((x - 318) * 12) / 48;
  p.poly([[318, 34], [366, 22], [366, 238], [318, 226]], { closed: true, width: 1.6 });
  p.line(366, 22, 372, 26);
  p.line(372, 26, 372, 240);
  p.line(366, 238, 372, 240);
  const rand = seeded(7);
  for (let n = 0; n < 700;) {
    const y = 42 + rand() * 176, x = 322 + rand() * 40;
    const I = Math.cos((Math.PI * (y - 130)) / 22) ** 2 * Math.exp(-(((y - 130) / 72) ** 2));
    if (rand() > I) continue;
    p.dot(x, y + skew(x), 0.9, { tone: n % 5 ? 'purple' : 'blue', step: 1.2 });
    n++;
  }

  p.text(22, 104, 'e⁻', { tone: 'blue' });
  p.text(104, 158, 'one at a time');
  p.text(342, 254, 'stripes', { tone: 'purple', anchor: 'middle' });
}

export function heatPump(p) {
  p.line(8, 212, 392, 212, { width: 1.5 });
  p.hatch([[8, 214], [392, 214], [392, 258], [8, 258]], { gap: 11, angle: -55 });

  p.rect(26, 100, 180, 112, { width: 1.6 });
  p.poly([[34, 212], [34, 108], [198, 108], [198, 212]], { tone: 'faint' });
  p.line(16, 106, 116, 40, { width: 1.6 });
  p.line(116, 40, 216, 106, { width: 1.6 });
  p.rect(140, 128, 40, 38);
  p.line(160, 128, 160, 166, { tone: 'faint' });
  p.line(140, 147, 180, 147, { tone: 'faint' });

  p.rect(52, 166, 56, 32);
  for (let x = 58; x <= 102; x += 5.5) p.line(x, 170, x, 194, { tone: 'faint', passes: 1, overshoot: 0 });
  p.line(56, 198, 56, 204);
  p.line(104, 198, 104, 204);
  p.circle(112, 170, 3);

  p.group('rise', () => {
    for (const x0 of [64, 80, 96]) {
      const pts = [];
      for (let y = 160; y >= 118; y -= 7) pts.push([x0 + 4 * Math.sin((160 - y) / 9 + x0), y]);
      p.smooth(pts, { tone: 'orange', passes: 1 });
    }
  });

  p.shape([[296, 208], [296, 230], [104, 230], [104, 204]], { tone: 'orange', dash: true, flow: true, sharp: true, passes: 1 });
  p.shape([[56, 204], [56, 240], [284, 240], [284, 208]], { tone: 'blue', dash: true, flow: true, sharp: true, passes: 1 });

  p.rect(246, 132, 110, 76, { width: 1.6 });
  p.poly([[246, 132], [260, 122], [370, 122], [356, 132]]);
  p.poly([[370, 122], [370, 198], [356, 208]]);
  for (let x = 358.5; x < 369; x += 2.6) {
    const d = ((x - 356) * 10) / 14;
    p.line(x, 132 - d, x, 208 - d, { tone: 'faint', passes: 1, overshoot: 0, rough: 0.3 });
  }
  p.rect(254, 208, 12, 4, { tone: 'faint' });
  p.rect(336, 208, 12, 4, { tone: 'faint' });
  p.circle(292, 170, 30);
  p.circle(292, 170, 21, { tone: 'faint' });
  p.circle(292, 170, 12, { tone: 'faint' });
  p.group('spin', () => {
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3;
      const pts = [0, 0.35, 0.7, 1].map((t) => {
        const r = 4 + t * 22, ang = a + t * 0.9;
        return [292 + r * Math.cos(ang), 170 + r * Math.sin(ang)];
      });
      p.smooth(pts, { width: 1.4 });
    }
    p.circle(292, 170, 4);
  }, { origin: [292, 170] });

  for (const y of [148, 176]) p.arrow(398, y, 378, y, { tone: 'blue' });
  p.text(398, 104, '−7 °C', { tone: 'blue', anchor: 'end' });
  p.text(56, 132, '21 °C', { tone: 'orange' });
  p.text(308, 112, 'R290 stays outside', { anchor: 'middle' });
}

export function skyscraper(p) {
  const tower = (x, w, sway, mass) => {
    const base = [x + w / 2, 222];
    const rot = (px, py, deg) => {
      const a = (deg * Math.PI) / 180, dx = px - base[0], dy = py - base[1];
      return [base[0] + dx * Math.cos(a) - dy * Math.sin(a), base[1] + dx * Math.sin(a) + dy * Math.cos(a)];
    };
    p.poly([rot(x, 222, sway), rot(x, 44, sway), rot(x + w, 44, sway), rot(x + w, 222, sway)], { tone: 'faint', dash: true });
    p.group(mass ? 'rock-small' : 'rock', () => {
      p.rect(x, 44, w, 178, { width: 1.6 });
      p.line(x + w / 2, 30, x + w / 2, 44);
      for (let y = 54; y < 222; y += 9) p.line(x, y, x + w, y, { tone: 'faint', passes: 1, overshoot: 0 });
      if (mass) {
        p.line(x + 16, 46, x + w / 2 - 4, 72, { tone: 'faint' });
        p.line(x + w - 16, 46, x + w / 2 + 4, 72, { tone: 'faint' });
        p.circle(x + w / 2, 80, 12, { tone: 'orange', width: 1.6 });
        p.ellipse(x + w / 2 - 3, 76, 5, 3, { from: 3.4, to: 5.2, tone: 'orange', passes: 1 });
        p.line(x + 4, 90, x + w / 2 - 10, 84, { tone: 'faint' });
        p.line(x + w - 4, 90, x + w / 2 + 10, 84, { tone: 'faint' });
      }
    }, { origin: base });
  };
  p.line(10, 222, 390, 222, { width: 1.5 });
  p.hatch([[10, 224], [390, 224], [390, 256], [10, 256]], { gap: 12, angle: -55 });
  tower(76, 56, -5, false);
  tower(262, 56, -1.2, true);
  for (const y of [70, 110, 150]) p.smooth([[8, y], [26, y - 5], [44, y + 3], [60, y - 2]], { tone: 'blue', passes: 1 });
  p.arrowHead(62, 108, 0, { tone: 'blue' });
  p.text(10, 56, 'wind', { tone: 'blue' });
  p.text(340, 84, '660 t', { tone: 'orange' });
  p.line(336, 81, 304, 80, { tone: 'faint', overshoot: 0 });
  p.text(104, 246, 'rigid', { anchor: 'middle' });
  p.text(290, 246, 'damped', { anchor: 'middle' });
}

export function ctMri(p) {
  const C = [170, 130];
  p.ellipse(204, 120, 92, 100, { from: -1.25, to: 1.25 });
  p.line(170, 30, 204, 20);
  p.line(170, 230, 204, 220);
  p.ellipse(...C, 92, 100, { width: 1.7 });
  p.ellipse(...C, 46, 50, { width: 1.4 });
  p.ellipse(204, 120, 46, 50, { from: 1.9, to: 4.4, tone: 'faint' });

  p.group('spin-slow', () => {
    p.rect(158, 38, 24, 14, { tone: 'orange' });
    p.ellipse(...C, 84, 91, { from: 1.15, to: 2.0, tone: 'orange', width: 1.6 });
    for (const a of [1.2, 1.4, 1.57, 1.74, 1.94]) {
      p.line(170, 54, 170 + 84 * Math.cos(a), 130 + 91 * Math.sin(a), { tone: 'orange', passes: 1, overshoot: 0, rough: 0.4 });
    }
  }, { origin: C });

  p.line(8, 158, 392, 146);
  p.line(8, 166, 392, 154);
  p.line(8, 158, 8, 166);
  p.circle(58, 148, 8);
  p.smooth([[68, 150], [110, 142], [170, 140], [240, 142], [300, 146]], { tone: 'faint' });

  p.arrow(292, 40, 330, 29, { tone: 'blue' });
  p.text(336, 32, 'B₀', { tone: 'blue' });
  p.text(186, 30, 'X-ray', { tone: 'orange' });
  p.text(170, 252, 'the patient never moves', { anchor: 'middle' });
}

export function brakes(p) {
  const C = [140, 130];
  p.circle(...C, 92, { width: 1.7 });
  p.circle(...C, 58, { tone: 'faint' });
  p.circle(...C, 30);
  p.group('spin', () => {
    for (let k = 0; k < 5; k++) p.circle(C[0] + 18 * Math.cos((k * TAU) / 5), C[1] + 18 * Math.sin((k * TAU) / 5), 3);
    for (let k = 0; k < 18; k++) {
      const a = (k * TAU) / 18;
      p.circle(C[0] + 75 * Math.cos(a), C[1] + 75 * Math.sin(a), 2.6, { passes: 1 });
    }
  }, { origin: C });

  p.group('pulse-soft', () => {
    for (let r = 66; r <= 88; r += 5.5) p.ellipse(...C, r, r, { from: -0.3, to: 0.9, tone: 'orange', passes: 1 });
  });
  const band = [];
  for (let a = -1.15; a <= -0.3; a += 0.05) band.push([C[0] + 102 * Math.cos(a), C[1] + 102 * Math.sin(a)]);
  for (let a = -0.3; a >= -1.15; a -= 0.05) band.push([C[0] + 60 * Math.cos(a), C[1] + 60 * Math.sin(a)]);
  p.shape(band, { closed: true, fill: '#0b0e13', width: 1.6 });
  p.circle(C[0] + 88 * Math.cos(-0.9), C[1] + 88 * Math.sin(-0.9), 4);
  p.circle(C[0] + 88 * Math.cos(-0.55), C[1] + 88 * Math.sin(-0.55), 4);

  p.group('rise', () => {
    for (const x0 of [214, 228]) {
      const pts = [];
      for (let y = 46; y >= 14; y -= 6) pts.push([x0 + 4 * Math.sin((46 - y) / 8 + x0), y]);
      p.smooth(pts, { tone: 'orange', passes: 1 });
    }
  });

  p.smooth([[236, 150], [260, 158], [284, 150]], { tone: 'green', dash: true, flow: true, passes: 1 });
  p.arrowHead(284, 150, -0.3, { tone: 'green' });
  p.rect(288, 116, 88, 56, { width: 1.6 });
  p.rect(302, 108, 14, 8);
  p.rect(348, 108, 14, 8);
  p.shape([[336, 124], [322, 146], [334, 146], [326, 164], [344, 138], [332, 138], [340, 124]], { tone: 'green', sharp: true, closed: true });
  p.text(244, 30, 'heat', { tone: 'orange' });
  p.text(332, 196, 'back to the battery', { tone: 'green', anchor: 'middle' });
}

export function engines(p) {
  p.line(52, 34, 52, 132, { width: 1.6 });
  p.line(118, 34, 118, 132, { width: 1.6 });
  p.line(46, 34, 124, 34, { width: 1.6 });
  p.line(85, 34, 85, 18);
  p.line(80, 18, 90, 18);
  p.group('flicker', () => {
    for (let k = 0; k < 9; k++) {
      const a = (k * TAU) / 9 + 0.3;
      p.line(85 + 5 * Math.cos(a), 52 + 4 * Math.sin(a), 85 + 22 * Math.cos(a), 52 + 12 * Math.sin(a), { tone: 'orange', passes: 1 });
    }
  });
  p.rect(56, 70, 58, 30);
  for (const y of [76, 82]) p.line(56, y, 114, y, { tone: 'faint', passes: 1, overshoot: 0 });
  p.circle(85, 90, 3);
  p.line(85, 90, 104, 184);
  p.line(79, 92, 98, 186, { tone: 'faint', passes: 1 });
  p.group('spin', () => {
    p.circle(85, 196, 30);
    p.circle(104, 184, 4);
    p.ellipse(85, 196, 22, 22, { from: 1.9, to: 4.4, tone: 'faint' });
  }, { origin: [85, 196] });
  p.dot(85, 196, 2.4);

  p.text(200, 136, 'vs', { anchor: 'middle' });

  const M = [300, 130];
  p.circle(...M, 78, { width: 1.7 });
  p.circle(...M, 60);
  for (let k = 0; k < 12; k++) {
    const a = (k * TAU) / 12;
    for (const s of [-0.12, 0.12]) {
      p.line(M[0] + 60 * Math.cos(a + s), M[1] + 60 * Math.sin(a + s), M[0] + 47 * Math.cos(a + s), M[1] + 47 * Math.sin(a + s), { passes: 1, overshoot: 0 });
    }
    p.ellipse(...M, 47, 47, { from: a - 0.12, to: a + 0.12, passes: 1 });
    const b = a + Math.PI / 12;
    p.ellipse(...M, 54, 54, { from: b - 0.1, to: b + 0.1, tone: 'orange', passes: 1 });
    p.ellipse(...M, 50, 50, { from: b - 0.1, to: b + 0.1, tone: 'orange', passes: 1 });
  }
  p.group('spin', () => {
    p.circle(...M, 38);
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8;
      p.ellipse(...M, 32, 32, { from: a - 0.3, to: a + 0.3, tone: k % 2 ? 'red' : 'blue', width: 2.2, passes: 1 });
    }
    p.circle(...M, 7);
  }, { origin: M });

  p.text(128, 58, 'fuel', { tone: 'orange' });
  p.text(300, 234, 'magnets', { tone: 'blue', anchor: 'middle' });
}

export function antigrav(p) {
  p.ellipse(90, 270, 80, 60, { from: 3.7, to: 5.4, tone: 'faint' });
  p.ellipse(90, 270, 70, 50, { from: 3.8, to: 5.3, tone: 'faint', passes: 1 });
  p.smooth([[20, 240], [120, 170], [200, 120], [250, 96], [300, 70]], { width: 1.7 });
  p.smooth([[380, 240], [300, 170], [258, 124], [262, 100], [306, 74]], { width: 1.7 });
  p.smooth([[40, 226], [130, 162], [204, 114], [254, 92], [301, 68]], { tone: 'blue', passes: 1 });
  p.smooth([[362, 228], [290, 162], [254, 120], [258, 96], [305, 70]], { tone: 'blue', passes: 1 });
  for (const [a, b] of [[[118, 206], [140, 196]], [[176, 168], [190, 160]], [[216, 138], [224, 132]], [[244, 118], [248, 114]]]) {
    p.line(...a, ...b, { tone: 'faint', passes: 1, overshoot: 0 });
  }
  p.ellipse(330, 50, 22, 26, { width: 1.4 });
  p.ellipse(330, 50, 17, 21, { tone: 'faint', passes: 1 });
  p.group('rock-small', () => {
    p.shape([[200, 158], [150, 196], [172, 204], [228, 204], [250, 196]], { closed: true, sharp: true, width: 1.8 });
    p.line(200, 158, 200, 200, { tone: 'faint' });
    p.shape([[192, 176], [200, 166], [208, 176]], { closed: true, sharp: true, tone: 'blue' });
    p.line(160, 194, 156, 180);
    p.line(240, 194, 244, 180);
    p.hatch([[172, 206], [228, 206], [236, 214], [164, 214]], { gap: 7, angle: 90, tone: 'blue' });
  }, { origin: [200, 190] });
  p.group('flicker', () => {
    for (const x of [178, 200, 222]) p.line(x, 204, x, 234, { tone: 'orange', passes: 1 });
  });
  for (const [x0, y0, x1, y1] of [[60, 140, 120, 118], [70, 110, 130, 96], [340, 140, 290, 122], [350, 112, 296, 100]]) {
    p.line(x0, y0, x1, y1, { tone: 'faint', dash: true, flow: true, passes: 1 });
  }
  p.text(110, 244, 'hover field', { tone: 'blue', anchor: 'middle' });
  p.text(362, 40, 'loop', { anchor: 'start' });
}

export function gpsIns(p) {
  for (const [x, y] of [[62, 40], [160, 24], [262, 36]]) {
    p.rect(x - 6, y - 5, 12, 10, { width: 1.4 });
    p.line(x - 22, y, x - 6, y, { tone: 'faint', passes: 1 });
    p.line(x + 6, y, x + 22, y, { tone: 'faint', passes: 1 });
    p.rect(x - 22, y - 4, 10, 8, { tone: 'faint', passes: 1 });
    p.rect(x + 12, y - 4, 10, 8, { tone: 'faint', passes: 1 });
    p.group('pulse-soft', () => p.line(x, y + 6, 112, 184, { tone: 'blue', dash: true, passes: 1 }));
  }
  p.line(10, 210, 390, 210, { width: 1.5 });
  p.hatch([[10, 212], [390, 212], [390, 250], [10, 250]], { gap: 12, angle: -55 });
  p.smooth([[200, 210], [226, 150], [280, 118], [334, 150], [360, 210]], { tone: 'faint' });
  p.line(236, 210, 236, 166);
  p.ellipse(284, 166, 48, 30, { from: Math.PI, to: TAU });
  p.line(332, 166, 332, 210);
  p.rect(96, 186, 32, 12, { width: 1.5 });
  p.line(102, 186, 108, 178);
  p.line(108, 178, 120, 178);
  p.line(120, 178, 124, 186);
  p.circle(104, 200, 4);
  p.circle(120, 200, 4);
  p.line(132, 202, 380, 202, { tone: 'faint', dash: true });
  p.group('pulse-soft', () => {
    p.smooth([[236, 202], [290, 196], [340, 180], [384, 158]], { tone: 'orange', width: 1.5 });
    p.arrowHead(384, 158, -0.47, { tone: 'orange' });
  });
  p.text(18, 110, 'GPS', { tone: 'blue' });
  p.text(392, 120, 'inertial drift', { tone: 'orange', anchor: 'end' });
  p.text(284, 240, 'no signal in here', { anchor: 'middle' });
}

export function euv(p) {
  const P = [196, 118];
  p.rect(180, 8, 32, 16, { width: 1.5 });
  p.line(196, 24, 196, 32);
  p.group('pulse-soft', () => {
    for (let y = 40; y <= 100; y += 12) p.dot(196, y, 2.2, { tone: 'blue' });
  });
  p.line(110, 250, P[0] - 3, P[1] + 6, { tone: 'red', width: 1.5 });
  p.group('flicker', () => {
    for (let k = 0; k < 10; k++) {
      const a = (k * TAU) / 10;
      p.line(P[0] + 4 * Math.cos(a), P[1] + 4 * Math.sin(a), P[0] + 14 * Math.cos(a), P[1] + 14 * Math.sin(a), { tone: 'orange', passes: 1 });
    }
  });
  p.ellipse(214, 118, 60, 92, { from: 1.95, to: 4.33, width: 1.8 });
  p.ellipse(220, 118, 60, 92, { from: 2.0, to: 4.28, tone: 'faint' });
  const IF = [292, 118];
  for (const y of [42, 80, 156, 194]) p.line(166, y, IF[0], IF[1], { tone: 'purple', passes: 1 });
  p.line(IF[0], IF[1], 332, 58, { tone: 'purple', width: 1.4 });
  p.line(316, 48, 350, 66, { width: 1.8 });
  p.line(334, 58, 336, 206, { tone: 'purple', width: 1.4 });
  p.rect(290, 208, 94, 12, { width: 1.5 });
  p.hatch([[292, 209], [382, 209], [382, 219], [292, 219]], { gap: 7, angle: 90 });
  p.text(220, 20, 'tin, 50,000 / s', { tone: 'blue' });
  p.text(110, 240, 'laser', { tone: 'red', anchor: 'end' });
  p.text(344, 142, '13.5 nm', { tone: 'purple' });
  p.text(337, 244, 'wafer', { anchor: 'middle' });
}

export function reactor(p) {
  p.line(60, 44, 60, 232, { width: 1.7 });
  p.line(340, 44, 340, 232, { width: 1.7 });
  p.line(60, 232, 340, 232, { width: 1.7 });
  p.hatch([[40, 44], [60, 44], [60, 252], [40, 252]], { gap: 8 });
  p.hatch([[340, 44], [360, 44], [360, 252], [340, 252]], { gap: 8 });
  p.smooth([[62, 60], [110, 56], [160, 62], [220, 56], [280, 62], [338, 58]], { tone: 'blue', passes: 1 });
  p.group('pulse-soft', () => {
    p.ellipse(200, 176, 82, 50, { tone: 'blue', passes: 1 });
    p.ellipse(200, 176, 66, 40, { tone: 'blue', passes: 1 });
  });
  p.rect(150, 142, 100, 68, { width: 1.6 });
  for (let x = 158; x <= 242; x += 8) p.line(x, 146, x, 206, { tone: 'faint', passes: 1, overshoot: 0 });
  for (const x of [172, 200, 228]) p.rect(x - 6, 16, 12, 10);
  p.group('pulse', () => {
    for (const x of [172, 200, 228]) {
      p.line(x, 26, x, 164, { tone: 'orange', width: 2.2 });
    }
  }, { origin: [200, 26] });
  p.text(244, 22, 'control rods', { tone: 'orange' });
  p.text(256, 136, 'core');
  p.text(334, 222, 'Cherenkov glow', { tone: 'blue', anchor: 'end' });
}

export function turbofan(p) {
  p.smooth([[40, 64], [70, 50], [150, 46], [260, 54], [336, 74]], { width: 1.7 });
  p.smooth([[40, 196], [70, 210], [150, 214], [260, 206], [336, 186]], { width: 1.7 });
  p.smooth([[110, 104], [180, 100], [262, 106], [346, 120]]);
  p.smooth([[110, 156], [180, 160], [262, 154], [346, 140]]);
  p.ellipse(110, 130, 10, 26, { from: 1.57, to: 4.71 });
  p.group('pulse-soft', () => {
    for (let y = 58; y <= 202; y += 12) p.line(78, y, 90, y + 8, { passes: 1 });
  });
  p.line(84, 54, 84, 206, { width: 1.5 });
  for (let k = 0; k < 8; k++) {
    const x = 124 + k * 9, h = 24 - k * 1.6;
    p.line(x, 130 - h, x, 130 + h, { tone: 'faint', passes: 1, overshoot: 0 });
  }
  p.group('flicker', () => {
    for (let k = 0; k < 7; k++) {
      const a = (k * TAU) / 7;
      p.line(214 + 4 * Math.cos(a), 130 + 4 * Math.sin(a), 214 + 14 * Math.cos(a), 130 + 10 * Math.sin(a), { tone: 'orange', passes: 1 });
    }
  });
  for (let x = 240; x <= 268; x += 7) p.line(x, 112, x, 148, { tone: 'faint', passes: 1, overshoot: 0 });
  for (const y of [78, 182]) {
    p.line(30, y, 372, y, { tone: 'blue', dash: true, flow: true, passes: 1 });
    p.arrowHead(372, y, 0, { tone: 'blue' });
  }
  p.smooth([[346, 130], [366, 128], [388, 132]], { tone: 'orange', dash: true, flow: true, passes: 1 });
  p.text(200, 30, 'bypass air: most of the thrust', { tone: 'blue', anchor: 'middle' });
  p.line(214, 144, 214, 226, { tone: 'faint', overshoot: 0 });
  p.text(214, 240, 'fire', { tone: 'orange', anchor: 'middle' });
}

export function battery(p) {
  p.rect(58, 44, 10, 176, { tone: 'orange', width: 1.5 });
  p.rect(332, 44, 10, 176, { width: 1.5 });
  p.line(58, 44, 342, 44, { tone: 'faint' });
  p.line(58, 220, 342, 220, { tone: 'faint' });
  p.hatch([[68, 48], [168, 48], [168, 216], [68, 216]], { gap: 10, angle: 0 });
  p.hatch([[232, 48], [332, 48], [332, 216], [232, 216]], { gap: 11, angle: 55 });
  p.line(200, 46, 200, 218, { dash: true });
  p.group('travel', () => {
    for (const [x, y] of [[160, 72], [166, 108], [158, 146], [164, 186]]) p.dot(x, y, 3, { tone: 'blue' });
  });
  p.smooth([[63, 44], [63, 20], [180, 16]]);
  p.smooth([[220, 16], [337, 20], [337, 44]]);
  p.circle(200, 16, 10, { tone: 'orange' });
  p.arrowHead(120, 18, 0);
  p.text(212, 62, 'Li⁺', { tone: 'blue' });
  p.text(118, 240, 'graphite', { anchor: 'middle' });
  p.text(200, 240, 'separator', { anchor: 'middle' });
  p.text(282, 240, 'cathode', { anchor: 'middle' });
}

export function scramjet(p) {
  for (const y of [40, 62, 84, 106]) p.line(8, y, 120, y - 6, { tone: 'blue', dash: true, flow: true, passes: 1 });
  p.arrowHead(120, 78, -0.05, { tone: 'blue' });
  p.shape([[20, 138], [150, 112], [330, 100], [384, 108], [384, 124], [300, 150], [236, 160], [236, 168], [150, 168]], { closed: true, width: 1.8, fill: '#0b0e13' });
  p.line(150, 168, 236, 168, { width: 1.6 });
  p.shape([[164, 186], [250, 186], [300, 204], [290, 208], [246, 196], [168, 196]], { closed: true, width: 1.6, fill: '#0b0e13' });
  p.line(20, 138, 164, 186, { tone: 'blue', width: 1.4, dash: true });
  p.line(164, 186, 188, 168, { tone: 'blue', dash: true });
  p.line(188, 168, 208, 186, { tone: 'blue', dash: true });
  p.line(208, 186, 226, 168, { tone: 'blue', dash: true });
  p.group('flicker', () => {
    for (let x = 232; x <= 262; x += 8) p.line(x, 184, x + 8, 170, { tone: 'orange', passes: 1 });
  });
  p.group('pulse-soft', () => {
    p.smooth([[250, 176], [300, 184], [350, 200], [392, 222]], { tone: 'orange', width: 1.5 });
    p.smooth([[250, 180], [296, 196], [340, 218], [380, 240]], { tone: 'orange', passes: 1 });
  });
  p.text(10, 26, 'Mach 6', { tone: 'blue' });
  p.text(70, 186, 'shock', { tone: 'blue', anchor: 'middle' });
  p.text(246, 76, 'fire in supersonic air', { tone: 'orange', anchor: 'middle' });
  p.line(246, 82, 246, 164, { tone: 'faint', overshoot: 0 });
  p.text(200, 240, 'no moving parts', { anchor: 'middle' });
}
