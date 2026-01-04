/**
 * TypeWriter - Character-by-character typing animation
 */
import { delay } from '../utils/delay.js';
import { config } from '../config.js';

export class TypeWriter {
  /**
   * @param {Object} options
   * @param {number} options.speed - Base typing speed in ms
   * @param {boolean} options.humanize - Add random variance
   */
  constructor(options = {}) {
    this.speed = options.speed || config.typeSpeed.normal;
    this.humanize = options.humanize !== false;
    this.aborted = false;
  }

  /**
   * Type text into a container element
   * @param {string} text - Text to type
   * @param {HTMLElement} container - Container element
   * @param {Object} options
   * @returns {Promise<void>}
   */
  async type(text, container, options = {}) {
    this.aborted = false;
    const speed = options.speed || this.speed;

    for (let i = 0; i < text.length; i++) {
      if (this.aborted) break;

      const char = text[i];
      container.textContent += char;

      // Variable speed for more natural feel
      let charDelay = speed;
      if (this.humanize) {
        charDelay = this.getCharDelay(char, speed);
      }

      await delay(charDelay);
    }
  }

  /**
   * Type text and append to container with a new span
   * @param {string} text
   * @param {HTMLElement} container
   * @param {string} className
   * @returns {Promise<HTMLElement>}
   */
  async typeLine(text, container, className = '') {
    const span = document.createElement('span');
    if (className) span.className = className;
    container.appendChild(span);

    await this.type(text, span);

    return span;
  }

  /**
   * Get variable delay based on character
   * @param {string} char
   * @param {number} baseSpeed
   * @returns {number}
   */
  getCharDelay(char, baseSpeed) {
    // Pause longer after punctuation
    if ('.!?'.includes(char)) {
      return baseSpeed * 4;
    }
    if (',;:'.includes(char)) {
      return baseSpeed * 2;
    }
    // Slight variation
    return baseSpeed + (Math.random() * baseSpeed * 0.5);
  }

  /**
   * Stop typing animation
   */
  abort() {
    this.aborted = true;
  }

  /**
   * Instantly display text (skip animation)
   * @param {string} text
   * @param {HTMLElement} container
   */
  instant(text, container) {
    container.textContent += text;
  }
}

/**
 * Singleton instance for quick access
 */
export const typewriter = new TypeWriter();
