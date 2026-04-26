/**
 * clear command - Clear the terminal
 */
import { commandRegistry } from './CommandRegistry.js';

const clear = {
  name: 'clear',
  description: 'Clear the terminal screen',
  usage: 'clear',
  aliases: ['cls', 'c'],

  async execute(args, terminal) {
    terminal.clear();

    terminal.showSuggestions([
      { label: 'help', command: 'help' },
      { label: 'about', command: 'about' },
      { label: 'blog', command: 'blog' },
    ]);

    return { success: true };
  },
};

commandRegistry.register(clear);
