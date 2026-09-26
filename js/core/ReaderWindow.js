/**
 * ReaderWindow - Article reader opened as a second window on top of the terminal
 */
import { createElement } from '../utils/dom.js';
import { currentTheme, setTheme } from '../utils/theme.js';

export class ReaderWindow {
  /**
   * @param {Object} options
   * @param {Function} options.onClose - Called after the window is closed
   */
  constructor({ onClose }) {
    this.onClose = onClose;
    this.overlay = null;
    this.handleKeydown = this.handleKeydown.bind(this);
    this.updateProgress = this.updateProgress.bind(this);
  }

  /**
   * @returns {boolean}
   */
  get isOpen() {
    return this.overlay !== null;
  }

  /**
   * Show an article. Replaces the content when the window is already open.
   * @param {string} title - Window title (file name)
   * @param {HTMLElement} content - Article element
   */
  open(title, content) {
    if (!this.isOpen) {
      this.build();
    }

    this.titleEl.textContent = title;
    this.overlay.querySelector('[role="dialog"]').setAttribute('aria-label', title);
    this.scrollEl.replaceChildren(
      content,
      createElement('div', { className: 'reader-hint' }, 'esc · close')
    );
    this.scrollEl.scrollTop = 0;
    this.updateProgress();
    this.scrollEl.focus({ preventScroll: true });
  }

  /**
   * Close the window and hand control back to the terminal
   */
  close() {
    if (!this.isOpen) return;

    window.removeEventListener('keydown', this.handleKeydown, true);
    this.overlay.remove();
    this.overlay = null;
    document.body.classList.remove('reader-open');
    this.onClose();
  }

  /**
   * Create the window DOM and attach listeners
   */
  build() {
    const close = () => this.close();

    this.titleEl = createElement('div', { className: 'reader-title' });
    this.themeBtn = createElement('button', {
      className: 'reader-tool',
      type: 'button',
      onClick: () => this.toggleTheme(),
    });
    this.progressBar = createElement('div', { className: 'reader-progress-bar' });
    this.scrollEl = createElement('div', { className: 'reader-scroll', tabindex: '-1' });
    this.scrollEl.addEventListener('scroll', this.updateProgress, { passive: true });

    const titlebar = createElement('div', { className: 'reader-titlebar' },
      createElement('div', { className: 'traffic-lights' },
        createElement('button', {
          className: 'traffic-light traffic-light--close',
          type: 'button',
          'aria-label': 'Close article',
          onClick: close,
        }),
        createElement('span', { className: 'traffic-light traffic-light--idle', 'aria-hidden': 'true' }),
        createElement('span', { className: 'traffic-light traffic-light--idle', 'aria-hidden': 'true' })
      ),
      createElement('button', { className: 'reader-tool reader-back', type: 'button', onClick: close }, '← back'),
      this.titleEl,
      this.themeBtn
    );

    const win = createElement('div', {
      className: 'reader-window reader',
      role: 'dialog',
      'aria-modal': 'true',
    },
      titlebar,
      createElement('div', { className: 'reader-progress' }, this.progressBar),
      this.scrollEl
    );

    this.overlay = createElement('div', { className: 'reader-overlay' }, win);
    // Clicking the dimmed terminal behind the window closes it
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) close();
    });

    // Capture phase so Escape does not also reach the terminal window controls
    window.addEventListener('keydown', this.handleKeydown, true);

    this.updateThemeButton();
    document.body.classList.add('reader-open');
    document.body.appendChild(this.overlay);
  }

  /**
   * Escape or q closes the window, like quitting a pager
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    const isQuit = e.key === 'Escape' || (e.key === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey);
    if (!isQuit) return;

    e.preventDefault();
    e.stopPropagation();
    this.close();
  }

  toggleTheme() {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    this.updateThemeButton();
  }

  updateThemeButton() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    this.themeBtn.textContent = next === 'light' ? '☀︎' : '☾';
    this.themeBtn.setAttribute('aria-label', `Switch to ${next} theme`);
  }

  /**
   * Reflect the scroll position in the progress bar
   */
  updateProgress() {
    const { scrollTop, scrollHeight, clientHeight } = this.scrollEl;
    const max = scrollHeight - clientHeight;
    const ratio = max > 0 ? scrollTop / max : 1;
    this.progressBar.style.transform = `scaleX(${ratio})`;
  }
}
