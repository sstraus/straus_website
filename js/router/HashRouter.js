/**
 * HashRouter - Hash-based URL routing
 */
export class HashRouter {
  /**
   * @param {Terminal} terminal
   */
  constructor(terminal) {
    this.terminal = terminal;
    this.hashChangeHandler = null;
    this.bindEvents();
  }

  /**
   * Bind hashchange event
   */
  bindEvents() {
    this.hashChangeHandler = () => {
      if (this.terminal.isReady()) {
        const command = this.parseCurrentHash();
        if (command) {
          this.terminal.executeCommand(command, { echo: true });
        }
      }
    };
    window.addEventListener('hashchange', this.hashChangeHandler);
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (this.hashChangeHandler) {
      window.removeEventListener('hashchange', this.hashChangeHandler);
      this.hashChangeHandler = null;
    }
  }

  /**
   * Parse the current URL hash into a command
   * @returns {string|null}
   */
  parseCurrentHash() {
    const hash = window.location.hash.slice(1); // Remove #
    if (!hash) return null;

    // Parse hash format: command/arg1/arg2
    const parts = hash.split('/').filter(p => p);

    if (parts.length === 0) return null;

    const command = parts[0];
    const args = parts.slice(1).join(' ');

    return args ? `${command} ${args}` : command;
  }

  /**
   * Update the URL hash based on command
   * @param {string} command
   */
  updateHash(command) {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    // Only update hash for navigation commands
    const navCommands = ['about', 'blog', 'read', 'skills', 'contact'];

    if (!navCommands.includes(cmd)) {
      return;
    }

    // Build hash
    let hash = cmd;
    if (args.length > 0) {
      hash += '/' + args.join('/');
    }

    // Update without triggering hashchange
    const newUrl = `${window.location.pathname}#${hash}`;
    window.history.replaceState(null, '', newUrl);
  }

  /**
   * Navigate to a hash
   * @param {string} hash
   */
  navigate(hash) {
    window.location.hash = hash;
  }

  /**
   * Clear the hash
   */
  clear() {
    window.history.replaceState(null, '', window.location.pathname);
  }
}
