/**
 * Terminal - Main controller orchestrating all subsystems
 */
import { $ } from '../utils/dom.js';
import { OutputRenderer } from './OutputRenderer.js';
import { InputHandler } from './InputHandler.js';
import { CommandProcessor } from './CommandProcessor.js';
import { InitSequence } from '../effects/InitSequence.js';
import { HashRouter } from '../router/HashRouter.js';
import { ContentLoader } from '../content/ContentLoader.js';
import { config } from '../config.js';

export class Terminal {
  /**
   * @param {HTMLElement} container - Terminal container element
   */
  constructor(container) {
    this.container = container;
    this.outputContainer = $('#terminal-output', container);
    this.hiddenInput = $('#hidden-input', container);
    this.displayElement = $('#input-display', container);
    this.cursorElement = $('#cursor', container);

    // Initialize subsystems
    this.output = new OutputRenderer(this.outputContainer);
    this.processor = new CommandProcessor();
    this.router = new HashRouter(this);

    this.input = new InputHandler({
      hiddenInput: this.hiddenInput,
      displayElement: this.displayElement,
      cursorElement: this.cursorElement,
      onSubmit: (cmd) => this.executeCommand(cmd),
    });

    this.ready = false;
  }

  /**
   * Initialize the terminal
   */
  async init() {
    // Disable input during initialization
    this.input.disable();

    // Check if landing directly on blog content (list or post)
    const initialCommand = this.router.parseCurrentHash();
    const isDirectBlogAccess = initialCommand && (
      initialCommand.startsWith('read ') ||
      initialCommand === 'blog'
    );

    // Skip init sequence for direct blog content access
    if (!isDirectBlogAccess) {
      await InitSequence.run(this.output);
    }

    // Mark as ready
    this.ready = true;

    // Execute deep link command if present
    if (initialCommand) {
      await this.executeCommand(initialCommand, { echo: false });
    }

    // Enable input and show prompt
    this.input.enable();
    this.input.focus();
  }

  /**
   * Execute a command
   * @param {string} commandString
   * @param {Object} options
   */
  async executeCommand(commandString, options = {}) {
    const { echo = true } = options;

    // Disable input during execution
    this.input.disable();

    // Echo the command (unless suppressed)
    if (echo) {
      this.output.printCommand(commandString);
    }

    // Process the command
    const result = await this.processor.process(commandString, this);

    // Handle errors
    if (result.error) {
      this.output.error(result.message);
    }

    // Update URL hash
    this.router.updateHash(commandString);

    // Re-enable input
    this.input.enable();
    this.input.focus();
  }

  /**
   * Execute a command from a suggestion click
   * @param {string} command
   */
  runCommand(command) {
    this.executeCommand(command);
  }

  /**
   * Show suggestions
   * @param {Array<{label: string, command: string}>} suggestions
   */
  showSuggestions(suggestions) {
    this.output.printSuggestions(suggestions, (cmd) => this.runCommand(cmd));
  }

  /**
   * Clear the terminal
   */
  clear() {
    this.output.clear();
    // Clear content cache to free memory
    ContentLoader.clearCache();
  }

  /**
   * Print a new line
   */
  newline() {
    this.output.newline();
  }

  /**
   * Check if terminal is ready
   * @returns {boolean}
   */
  isReady() {
    return this.ready;
  }
}
