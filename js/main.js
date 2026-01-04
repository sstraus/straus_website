/**
 * Main entry point
 */
import { Terminal } from './core/Terminal.js';
import { $ } from './utils/dom.js';
import { domReady } from './utils/delay.js';
import { config } from './config.js';
import { windowControls } from './effects/WindowControls.js';

// Load all commands
import './commands/index.js';

async function init() {
  await domReady();

  const container = $('#terminal');

  if (!container) {
    console.error('Terminal container not found');
    return;
  }

  try {
    const terminalApp = new Terminal(container);

    // Expose for debugging and suggestion callbacks
    window.terminalApp = terminalApp;

    await terminalApp.init();

    // Initialize window controls (traffic lights)
    windowControls.init();

    if (config.debug) {
      console.log('Terminal initialized successfully');
    }
  } catch (err) {
    console.error('Failed to initialize terminal:', err);

    container.innerHTML = `
      <div class="terminal-line terminal-line--error">
        Failed to initialize terminal. Please refresh the page.
      </div>
    `;
  }
}

init();
