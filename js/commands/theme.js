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
    localStorage.setItem(THEME_KEY, newTheme);

    return { success: true };
  },
};

// Apply saved theme on load
export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
  }
}

commandRegistry.register(theme);
