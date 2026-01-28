/**
 * WindowControls - Mac window button functionality
 */
import { $ } from '../utils/dom.js';

class WindowControls {
  constructor() {
    this.window = null;
    this.titlebar = null;
    this.closeBtn = null;
    this.minimizeBtn = null;
    this.expandBtn = null;
    this.isFullscreen = false;
    this.isMinimized = false;
    this.restoreTimer = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
  }

  /**
   * Initialize window controls
   */
  init() {
    this.window = $('.mac-window');
    this.titlebar = $('.window-titlebar');
    this.closeBtn = $('.traffic-light--close');
    this.minimizeBtn = $('.traffic-light--minimize');
    this.expandBtn = $('.traffic-light--expand');

    if (!this.window) return;

    // Check if mobile - already fullscreen via CSS
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (this.isMobile) {
      this.isFullscreen = true;
    }

    this.bindEvents();
  }

  /**
   * Bind click events to traffic lights
   */
  bindEvents() {
    // Red button - reset/restart to home
    this.closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.reset();
    });

    // Yellow button - minimize for 5 seconds then restore
    this.minimizeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimize();
    });

    // Green button - toggle fullscreen
    this.expandBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFullscreen();
    });

    // ESC to exit fullscreen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isFullscreen) {
        this.toggleFullscreen();
      }
    });

    // Drag events on titlebar
    this.titlebar?.addEventListener('mousedown', (e) => this.startDrag(e));
    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', () => this.stopDrag());
  }

  /**
   * Red button - reset to home page
   */
  reset() {
    // Clear any pending restore timer
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }
    // Clear hash and reload to restart
    window.location.hash = '';
    window.location.reload();
  }

  /**
   * Yellow button - minimize window
   */
  minimize() {
    if (this.isMinimized) return;

    this.isMinimized = true;
    this.window.classList.add('mac-window--minimized');

    // Clear any existing timer
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
    }

    // Wait for animation to complete, then hide
    setTimeout(() => {
      this.window.style.visibility = 'hidden';
      this.window.classList.remove('mac-window--minimized');
    }, 300);

    // Restore after 5 seconds
    this.restoreTimer = setTimeout(() => {
      this.restore();
    }, 5000);
  }

  /**
   * Restore minimized window
   */
  restore() {
    if (!this.isMinimized) return;

    this.window.style.visibility = 'visible';
    this.window.classList.add('mac-window--restoring');

    setTimeout(() => {
      this.window.classList.remove('mac-window--restoring');
      this.isMinimized = false;

      // Show a funny joke
      const jokes = [
        "Miss me? I was just taking a quick power nap. Even terminals need beauty sleep!",
        "I'm back! Did you think clicking yellow would get rid of me that easily?",
        "Plot twist: I was never really gone. I was just hiding behind the pixels.",
        "5 seconds felt like 5 milliseconds to me. Perks of being a terminal!",
        "Did you enjoy staring at that blue background? Yeah, I didn't think so.",
        "I considered staying minimized, but I heard you needed help. You're welcome.",
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];

      if (window.terminalApp?.output) {
        window.terminalApp.output.newline();
        window.terminalApp.output.print(`> ${joke}`, 'system');
        window.terminalApp.output.newline();
      }
    }, 300);
  }

  /**
   * Green button - toggle fullscreen
   */
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen) {
      this.window.classList.add('mac-window--fullscreen');
    } else {
      this.window.classList.remove('mac-window--fullscreen');
    }
  }

  /**
   * Start dragging the window
   */
  startDrag(e) {
    // Don't drag if clicking on traffic lights, fullscreen, or mobile
    if (e.target.closest('.traffic-lights') || this.isFullscreen || this.isMobile) {
      return;
    }

    this.isDragging = true;
    this.window.classList.add('mac-window--dragging');

    // Calculate offset from mouse to window top-left
    const rect = this.window.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;

    // Switch to absolute positioning on first drag
    if (!this.window.classList.contains('mac-window--positioned')) {
      this.window.classList.add('mac-window--positioned');
      this.window.style.left = `${rect.left}px`;
      this.window.style.top = `${rect.top}px`;
    }

    e.preventDefault();
  }

  /**
   * Handle drag movement
   */
  drag(e) {
    if (!this.isDragging) return;

    const newX = e.clientX - this.dragOffset.x;
    const newY = e.clientY - this.dragOffset.y;

    // Keep window within viewport bounds
    const maxX = window.innerWidth - this.window.offsetWidth;
    const maxY = window.innerHeight - this.window.offsetHeight;

    this.window.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
    this.window.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
  }

  /**
   * Stop dragging
   */
  stopDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.window.classList.remove('mac-window--dragging');
  }
}

export const windowControls = new WindowControls();
