// The DOM side of the game: the one control (tap, click or space), the tiles, the coach, the grade
// that pops after a landing, the start and end cards, and the essay.

const $ = (id) => document.getElementById(id);
const BEST = 'lab.mars-rover.best';

export function readBest() {
  try {
    return Number(localStorage.getItem(BEST)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(metres) {
  try {
    localStorage.setItem(BEST, String(Math.round(metres)));
  } catch {
    // Private mode: the best score lives for this visit only.
  }
}

/**
 * The only control. A press anywhere on the scene jumps; on the start and end cards the button
 * drives. `jump()` and `start()` are called on the press itself, so a tap on a phone never waits for
 * the browser's click delay.
 */
export function bindInput({ jump, start, phase }) {
  const essay = $('essay');
  const onScene = (e) => !e.target.closest('button, .card, .essay, a, nav');
  const press = () => {
    if (essay.classList.contains('open')) return;
    if (phase() === 'run') jump();
    else start();
  };
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!onScene(e)) return;
    e.preventDefault();
    press();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      press();
    } else if (e.code === 'Enter' && phase() !== 'run') {
      start();
    } else if (e.code === 'Escape') {
      toggleEssay(false);
    }
  });
  $('go').addEventListener('click', start);
  $('again').addEventListener('click', start);
  const toggleEssay = (open) => {
    essay.classList.toggle('open', open);
    essay.setAttribute('aria-hidden', String(!open));
  };
  $('about-open').addEventListener('click', () => toggleEssay(true));
  $('about-close').addEventListener('click', () => toggleEssay(false));
}

export function createHud() {
  const shown = {};
  const show = (id, value) => {
    if (shown[id] !== value) $(id).textContent = shown[id] = value;
  };
  const grade = $('grade');
  let best = readBest();
  $('best-start').textContent = best ? `Best: ${best} m` : '';

  return {
    render(game, line) {
      show('t-distance', String(Math.round(game.distance)));
      show('t-speed', String(Math.round(Math.hypot(game.rover.vx, game.rover.vy) * 3.6)));
      show('t-hull', String(Math.round(game.hull)));
      $('tile-hull').style.setProperty('--hull', game.hull.toFixed(0));
      $('tile-hull').classList.toggle('low', game.hull < 35);
      show('sentence', line);
    },
    /** The word over the rover after a landing: Perfect, Safe or Hard, with what it did. */
    landing(result, streak) {
      const text = { perfect: 'Perfect', good: 'Safe', hard: 'Hard hit' }[result.grade];
      const note = result.grade === 'perfect'
        ? (streak > 1 ? `×${streak} · faster` : 'faster')
        : result.grade === 'hard' ? `hull −${Math.round(result.damage)} %` : '';
      grade.className = `grade ${result.grade}`;
      grade.innerHTML = `${text}${note ? `<small>${note}</small>` : ''}`;
      void grade.offsetWidth; // restart the animation
      grade.classList.add('show');
    },
    phase(phase, game) {
      $('start').hidden = phase !== 'ready';
      $('over').hidden = phase !== 'over';
      document.body.classList.toggle('carded', phase !== 'run');
      if (phase === 'over') {
        best = Math.max(best, Math.round(game.distance));
        writeBest(best);
        $('over-reason').textContent = game.reason === 'hull' ? 'The hull gave out' : game.reason === 'flipped' ? 'Rolled over' : 'Hit the ground hard';
        $('over-distance').textContent = String(Math.round(game.distance));
        $('over-best').textContent = `${best} m`;
        $('over-streak').textContent = String(game.bestStreak);
        $('over-time').textContent = `${Math.round(game.time)} s`;
        $('best-start').textContent = `Best: ${best} m`;
      }
    },
  };
}
