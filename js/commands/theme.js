/**
 * theme command - Toggle between light and dark themes
 */
import { commandRegistry } from './CommandRegistry.js';

const THEME_KEY = 'straus-terminal-theme';

const theme = {
  name: 'theme',
  description: 'Toggle between light and dark themes',
  usage: 'theme [light|dark]',
  aliases: [],

  async execute(args, terminal) {
    const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    let newTheme;

    // If argument provided, use it; otherwise toggle
    if (args.length > 0) {
      const requested = args[0].toLowerCase();
      if (requested !== 'light' && requested !== 'dark') {
        terminal.output.error(`Invalid theme: ${requested}. Use 'light' or 'dark'.`);
        return { error: true };
      }
      newTheme = requested;
    } else {
      newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    }

    // Apply theme
    if (newTheme === 'light') {
      document.body.classList.add('light-theme');
      terminal.output.success('Switched to light theme');
    } else {
      document.body.classList.remove('light-theme');
      terminal.output.success('Switched to dark theme');
    }

    // Save preference
    try {
      localStorage.setItem(THEME_KEY, newTheme);
    } catch (e) {
      terminal.output.print('Note: Theme preference could not be saved (storage unavailable)', 'system');
    }

    return { success: true };
  },
};

// Apply saved theme on load and cleanup loading class
export function initTheme() {
  // Remove the loading class from html (applied by inline script)
  document.documentElement.classList.remove('light-theme-loading');

  // Apply theme to body (works now that DOM is ready)
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    }
  } catch (e) {
    // localStorage not available, use default theme
  }
}

commandRegistry.register(theme);
