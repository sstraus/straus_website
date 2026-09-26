/**
 * theme command - Toggle between light and dark themes
 */
import { commandRegistry } from './CommandRegistry.js';
import { currentTheme, setTheme } from '../utils/theme.js';

const theme = {
  name: 'theme',
  description: 'Toggle between light and dark themes',
  usage: 'theme [light|dark]',
  aliases: [],

  async execute(args, terminal) {
    let newTheme;

    // If argument provided, use it; otherwise toggle
    if (args.length > 0) {
      const requested = args[0].toLowerCase();
      if (requested !== 'light' && requested !== 'dark') {
        return { error: true, message: `Invalid theme: ${requested}. Use 'light' or 'dark'.` };
      }
      newTheme = requested;
    } else {
      newTheme = currentTheme() === 'dark' ? 'light' : 'dark';
    }

    const saved = setTheme(newTheme);
    terminal.output.success(`Switched to ${newTheme} theme`);

    if (!saved) {
      terminal.output.print('Note: Theme preference could not be saved (storage unavailable)', 'system');
    }

    return { success: true };
  },
};

commandRegistry.register(theme);
