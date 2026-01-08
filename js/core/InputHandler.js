/**
 * InputHandler - Captures and processes user input
 */
import { $ } from '../utils/dom.js';
import { cursorManager } from '../effects/CursorManager.js';

export class InputHandler {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.hiddenInput - Hidden input element
   * @param {HTMLElement} options.displayElement - Element to show typed text
   * @param {HTMLElement} options.cursorElement - Cursor element
   * @param {Function} options.onSubmit - Callback when Enter is pressed
   */
  constructor(options) {
    this.hiddenInput = options.hiddenInput;
    this.displayElement = options.displayElement;
    this.cursorElement = options.cursorElement;
    this.onSubmit = options.onSubmit;

    this.history = [];
    this.historyIndex = -1;
    this.enabled = true;

    this.bindEvents();
    cursorManager.init(this.cursorElement);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Keyboard input
    this.hiddenInput.addEventListener('input', (e) => {
      if (!this.enabled) return;
      this.updateDisplay();
    });

    this.hiddenInput.addEventListener('keydown', (e) => {
      if (!this.enabled) return;

      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          this.submit();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.historyPrev();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.historyNext();
          break;
        case 'c':
          if (e.ctrlKey) {
            e.preventDefault();
            this.cancel();
          }
          break;
        case 'l':
          if (e.ctrlKey) {
            e.preventDefault();
            this.onSubmit('clear');
          }
          break;
        case 't':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.onSubmit('theme');
          }
          break;
      }
    });

    // Click anywhere on terminal to focus
    document.addEventListener('click', (e) => {
      if (e.target.closest('.terminal')) {
        this.focus();
      }
    });
  }

  /**
   * Update the display with current input value
   */
  updateDisplay() {
    this.displayElement.textContent = this.hiddenInput.value;
  }

  /**
   * Submit the current input
   */
  submit() {
    const command = this.hiddenInput.value.trim();

    if (command) {
      // Add to history
      if (this.history[this.history.length - 1] !== command) {
        this.history.push(command);
      }
      this.historyIndex = this.history.length;
    }

    // Clear input
    this.clear();

    // Callback with command
    if (this.onSubmit && command) {
      this.onSubmit(command);
    }
  }

  /**
   * Navigate to previous command in history
   */
  historyPrev() {
    if (this.history.length === 0) return;

    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.hiddenInput.value = this.history[this.historyIndex];
      this.updateDisplay();
    }
  }

  /**
   * Navigate to next command in history
   */
  historyNext() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.hiddenInput.value = this.history[this.historyIndex];
      this.updateDisplay();
    } else {
      this.historyIndex = this.history.length;
      this.hiddenInput.value = '';
      this.updateDisplay();
    }
  }

  /**
   * Cancel current input (Ctrl+C)
   */
  cancel() {
    this.clear();
    this.displayElement.textContent = '^C';
    setTimeout(() => {
      this.displayElement.textContent = '';
    }, 500);
  }

  /**
   * Clear the input
   */
  clear() {
    this.hiddenInput.value = '';
    this.displayElement.textContent = '';
  }

  /**
   * Focus the hidden input
   */
  focus() {
    this.hiddenInput.focus();
    cursorManager.setBlink();
  }

  /**
   * Blur the hidden input
   */
  blur() {
    this.hiddenInput.blur();
  }

  /**
   * Enable input
   */
  enable() {
    this.enabled = true;
    this.hiddenInput.disabled = false;
    cursorManager.show();
  }

  /**
   * Disable input
   */
  disable() {
    this.enabled = false;
    this.hiddenInput.disabled = true;
    cursorManager.hide();
  }

  /**
   * Get current input value
   * @returns {string}
   */
  getValue() {
    return this.hiddenInput.value;
  }

  /**
   * Set input value
   * @param {string} value
   */
  setValue(value) {
    this.hiddenInput.value = value;
    this.updateDisplay();
  }
}
