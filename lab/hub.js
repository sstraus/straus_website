import { createPen } from './lib/sketch.js';
import * as sketches from './lib/sketches.js';
import { EXPERIMENTS } from './experiments.js';

const NS = 'http://www.w3.org/2000/svg';

function card(exp, index) {
  const el = document.createElement(exp.open ? 'a' : 'article');
  el.className = `card${exp.open ? '' : ' soon'}`;
  if (exp.open) el.href = `./${exp.slug}/`;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 260');
  svg.setAttribute('class', 'sketch');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Pen sketch: ${exp.title}`);
  const paper = document.createElementNS(NS, 'g');
  paper.setAttribute('class', 'paper');
  svg.appendChild(paper);
  const pen = createPen(paper, index * 97 + 13);
  sketches[exp.draw](pen);
  pen.finish();

  const body = document.createElement('div');
  body.className = 'card-body';
  body.innerHTML = `
    <span class="num">${String(index + 1).padStart(2, '0')}${exp.open ? '' : ' · on the drawing board'}</span>
    <h3></h3><p class="hook"></p><span class="tags"></span>`;
  body.querySelector('h3').textContent = exp.title;
  body.querySelector('.hook').textContent = exp.hook;
  body.querySelector('.tags').textContent = exp.tags;
  if (exp.open) body.insertAdjacentHTML('beforeend', '<span class="go" aria-hidden="true">Enter →</span>');

  el.append(svg, body);
  return el;
}

const lists = { true: document.getElementById('open'), false: document.getElementById('soon') };
EXPERIMENTS.forEach((exp, i) => lists[exp.open].appendChild(card(exp, i)));

// Draw each sketch the first time it is mostly on screen.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const observer = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('drawn');
    observer.unobserve(e.target);
  }
}, { threshold: 0.35 });
for (const svg of document.querySelectorAll('.sketch')) {
  if (reduced) svg.classList.add('drawn');
  else observer.observe(svg);
}

// Idle animations repaint the whole SVG every frame: run them only for sketches on screen.
const onScreen = new IntersectionObserver((entries) => {
  for (const e of entries) e.target.classList.toggle('off', !e.isIntersecting);
});
for (const svg of document.querySelectorAll('.sketch')) onScreen.observe(svg);

// No idle animation while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('paused', document.hidden);
});
