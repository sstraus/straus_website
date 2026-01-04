/**
 * OutputRenderer - Renders output to the terminal
 */
import { createElement, scrollToBottom, clearChildren } from '../utils/dom.js';
import { TypeWriter } from '../effects/TypeWriter.js';
import { delay } from '../utils/delay.js';
import { config } from '../config.js';

export class OutputRenderer {
  /**
   * @param {HTMLElement} outputContainer
   */
  constructor(outputContainer) {
    this.container = outputContainer;
    this.typewriter = new TypeWriter();
  }

  /**
   * Print a line of text (instant)
   * @param {string} text
   * @param {string} type - 'normal', 'system', 'error', 'success', 'info', 'command'
   */
  print(text, type = 'normal') {
    const line = createElement('div', {
      className: `terminal-line terminal-line--${type}`,
    }, text);

    this.container.appendChild(line);
    this.scrollToEnd();
  }

  /**
   * Print multiple lines
   * @param {string[]} lines
   * @param {string} type
   */
  printLines(lines, type = 'normal') {
    for (const line of lines) {
      this.print(line, type);
    }
  }

  /**
   * Type text with animation
   * @param {string} text
   * @param {string} type
   * @param {Object} options
   * @returns {Promise<void>}
   */
  async typewrite(text, type = 'normal', options = {}) {
    const line = createElement('div', {
      className: `terminal-line terminal-line--${type}`,
    });

    this.container.appendChild(line);

    await this.typewriter.type(text, line, options);
    this.scrollToEnd();
  }

  /**
   * Type multiple lines with animation
   * @param {string[]} lines
   * @param {string} type
   * @returns {Promise<void>}
   */
  async typewriteLines(lines, type = 'normal') {
    for (const line of lines) {
      await this.typewrite(line, type);
      await delay(config.delays.lineBreak);
    }
  }

  /**
   * Print the command echo (shows what user typed)
   * @param {string} command
   */
  printCommand(command) {
    const line = createElement('div', { className: 'command-echo' },
      createElement('span', { className: 'prompt-symbol' }),
      createElement('span', { className: 'command-text' }, command)
    );

    this.container.appendChild(line);
    this.scrollToEnd();
  }

  /**
   * Render HTML content (for markdown)
   * @param {string} html
   * @param {string} className
   */
  renderHtml(html, className = 'md-content') {
    const wrapper = createElement('div', { className });
    wrapper.innerHTML = html;
    this.container.appendChild(wrapper);
    this.scrollToEnd();
  }

  /**
   * Print ASCII art
   * @param {string[]} lines
   * @param {string} style - 'portrait' (white) or 'logo' (orange)
   */
  printAscii(lines, style = 'portrait') {
    const className = style === 'logo'
      ? 'terminal-line terminal-line--ascii-logo'
      : 'terminal-line terminal-line--ascii';
    const container = createElement('div', { className });
    container.innerHTML = lines.join('\n');
    this.container.appendChild(container);
    this.scrollToEnd();
  }

  /**
   * Print ASCII art with hover image
   * @param {string[]} lines
   * @param {string} imageSrc - path to image
   */
  printAsciiWithImage(lines, imageSrc) {
    const wrapper = createElement('div', { className: 'ascii-image-wrapper' });
    const ascii = createElement('div', { className: 'terminal-line terminal-line--ascii ascii-content' });
    ascii.innerHTML = lines.join('\n');
    const img = createElement('img', {
      className: 'ascii-hover-image',
      src: imageSrc,
      alt: 'Profile photo'
    });
    wrapper.appendChild(ascii);
    wrapper.appendChild(img);
    this.container.appendChild(wrapper);
    this.scrollToEnd();
  }

  /**
   * Print a divider line
   */
  printDivider() {
    this.print('─'.repeat(50), 'divider');
  }

  /**
   * Print suggestions
   * @param {Array<{label: string, command: string}>} suggestions
   * @param {Function} onClick
   */
  printSuggestions(suggestions, onClick) {
    const container = createElement('div', { className: 'suggestions' });

    for (const { label, command } of suggestions) {
      const btn = createElement('button', {
        className: 'suggestion',
        onClick: () => onClick(command),
      }, label);

      container.appendChild(btn);
    }

    this.container.appendChild(container);
    this.scrollToEnd();
  }

  /**
   * Print an error message
   * @param {string} message
   */
  error(message) {
    this.print(`Error: ${message}`, 'error');
  }

  /**
   * Print a success message
   * @param {string} message
   */
  success(message) {
    this.print(message, 'success');
  }

  /**
   * Clear all output
   */
  clear() {
    clearChildren(this.container);
  }

  /**
   * Scroll to the end of output
   */
  scrollToEnd() {
    scrollToBottom(this.container);
  }

  /**
   * Print empty line
   */
  newline() {
    this.print('');
  }
}
