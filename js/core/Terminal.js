/**
 * Terminal - Main controller orchestrating all subsystems
 */
import { $ } from '../utils/dom.js';
import { OutputRenderer } from './OutputRenderer.js';
import { InputHandler } from './InputHandler.js';
import { CommandProcessor } from './CommandProcessor.js';
import { InitSequence } from '../effects/InitSequence.js';
import { HashRouter } from '../router/HashRouter.js';
import { ReaderWindow } from './ReaderWindow.js';
import { MetaManager } from '../seo/MetaManager.js';
import { resetPageTitle, setPageTitle } from '../utils/pageTitle.js';
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
    this.reader = new ReaderWindow({ onClose: () => this.onReaderClose() });

    this.input = new InputHandler({
      hiddenInput: this.hiddenInput,
      displayElement: this.displayElement,
      cursorElement: this.cursorElement,
      onSubmit: (cmd) => this.executeCommand(cmd),
    });

    this.ready = false;
    this.busy = false;
    // Incremented on every command so background effects can tell they are stale
    this.runId = 0;
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

    // Execute deep link command if present; it sends its own page_view
    if (initialCommand) {
      await this.executeCommand(initialCommand, { echo: false });
    } else {
      setPageTitle();
    }

    this.releaseInput();
  }

  /**
   * Hand the keyboard back to the prompt, unless the reader window owns it
   */
  releaseInput() {
    if (this.reader.isOpen || this.busy) return;
    this.input.enable();
    this.input.focus();
  }

  /**
   * The reader was closed: the URL and metadata describe the terminal again
   */
  onReaderClose() {
    this.router.clear();
    MetaManager.resetToDefault();
    resetPageTitle();
    this.releaseInput();
  }

  /**
   * Execute a command
   * @param {string} commandString
   * @param {Object} options
   */
  async executeCommand(commandString, options = {}) {
    const { echo = true } = options;

    // One command at a time: clicks and hash changes during a run are ignored
    if (this.busy) return;
    this.busy = true;
    this.runId++;

    // Disable input during execution
    this.input.disable();

    try {
      // Echo the command (unless suppressed)
      if (echo) {
        this.output.printCommand(commandString);
      }

      // Process the command
      const result = await this.processor.process(commandString, this);

      // Handle errors; a failed command must not become a shareable URL
      if (result.error) {
        this.output.error(result.message);
      } else {
        this.router.updateHash(commandString);
      }
    } finally {
      this.busy = false;
    }

    this.releaseInput();
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
