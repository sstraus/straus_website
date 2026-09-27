// The page around the scene: tiles, the live sentence, the start and finish cards, the essay, the
// sound buttons and the portrait card. DOM writes only happen when a value changes.
import { formatTime, ordinal } from './race.js';
import { ITEM_NAME } from './story.js';

const $ = (id) => document.getElementById(id);

export function createUI({ names, colors }) {
  const cache = new Map();
  const put = (id, text) => {
    if (cache.get(id) === text) return;
    cache.set(id, text);
    $(id).textContent = text;
  };

  const essay = $('essay');
  const toggleEssay = (open) => {
    essay.classList.toggle('open', open);
    essay.setAttribute('aria-hidden', String(!open));
  };
  $('about-open').addEventListener('click', () => toggleEssay(!essay.classList.contains('open')));
  $('about-close').addEventListener('click', () => toggleEssay(false));

  let level = 'pro';
  const levels = [...document.querySelectorAll('#difficulty button')];
  for (const b of levels) {
    b.addEventListener('click', () => {
      level = b.dataset.level;
      levels.forEach((x) => x.classList.toggle('active', x === b));
    });
  }

  const card = (id, open) => {
    $(id).classList.toggle('open', open);
    $(id).setAttribute('aria-hidden', String(!open));
  };

  let lastItem = null;
  return {
    get level() { return level; },
    onRace(fn) { $('race').addEventListener('click', fn); },
    onAgain(fn) { $('again').addEventListener('click', fn); },

    setPhase(phase) {
      document.body.classList.remove('phase-grid', 'phase-race', 'phase-done');
      document.body.classList.add(`phase-${phase}`);
      card('grid-card', phase === 'grid');
      if (phase !== 'done') card('finish-card', false);
    },

    tiles({ speed, lap, laps, place, ships, time, item }) {
      put('t-speed', String(Math.round(speed * 3.6)));
      put('t-lap', String(lap));
      put('t-laps', String(laps));
      put('t-place', String(place));
      put('t-ships', String(ships));
      put('t-time', formatTime(time));
      put('t-item', item ? ITEM_NAME[item] : '–');
      if (item !== lastItem) {
        const tile = $('tile-item');
        tile.classList.toggle('has', !!item);
        tile.classList.remove('flash');
        if (item) { void tile.offsetWidth; tile.classList.add('flash'); }
        document.body.classList.toggle('armed', !!item);
        lastItem = item;
      }
    },

    sentence(text) { put('sentence', text); },

    // entries: race entries sorted by place; `me` is the player's ship.
    finish(entries, me) {
      const mine = entries.find((e) => e.ship === me);
      put('finish-title', mine.place === 1 ? 'You won' : `You finished ${ordinal(mine.place)}`);
      put('finish-best', `Your best lap: ${formatTime(mine.best)}. Total: ${formatTime(mine.finish)}.`);
      $('finish-table').innerHTML = entries.map((e) => {
        const i = e.ship.id;
        const time = e.finish !== null ? formatTime(e.finish) : 'on track';
        return `<tr class="${e.ship === me ? 'me' : ''}"><td>${ordinal(e.place)}</td>`
          + `<td><span class="swatch" style="background:#${colors[i].getHexString()}"></span>${names[i]}</td>`
          + `<td>${formatTime(e.best)}</td><td>${time}</td></tr>`;
      }).join('');
      cache.delete('finish-table');
      card('finish-card', true);
    },

    bindAudio(audio) {
      const mute = $('mute'), music = $('music');
      mute.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.state.muted); });
      music.addEventListener('click', () => { audio.unlock(); audio.setMusic(!audio.state.music); });
      audio.onChange((s) => {
        mute.setAttribute('aria-pressed', String(s.muted));
        music.setAttribute('aria-pressed', String(s.music));
      });
    },

    perf(text) { put('perf', text); },
  };
}
