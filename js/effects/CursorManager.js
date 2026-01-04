/**
 * CursorManager - Manages cursor visibility and state
 */
import { $ } from '../utils/dom.js';

export class CursorManager {
  constructor() {
    this.cursorElement = null;
    this.state = 'blink'; // 'blink', 'typing', 'hidden'
  }

  /**
   * Initialize with cursor element
   * @param {HTMLElement} element
   */
  init(element) {
    this.cursorElement = element;
    this.setBlink();
  }

  /**
   * Set cursor to blinking state
   */
  setBlink() {
    if (!this.cursorElement) return;
    this.state = 'blink';
    this.cursorElement.className = 'cursor';
  }

  /**
   * Set cursor to typing state (solid)
   */
  setTyping() {
    if (!this.cursorElement) return;
    this.state = 'typing';
    this.cursorElement.className = 'cursor cursor--typing';
  }

  /**
   * Hide cursor
   */
  hide() {
    if (!this.cursorElement) return;
    this.state = 'hidden';
    this.cursorElement.className = 'cursor cursor--hidden';
  }

  /**
   * Show cursor (returns to blink state)
   */
  show() {
    this.setBlink();
  }

  /**
   * Get current state
   * @returns {string}
   */
  getState() {
    return this.state;
  }
}

export const cursorManager = new CursorManager();
