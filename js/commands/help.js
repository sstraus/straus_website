/**
 * help command - Display available commands
 */
import { commandRegistry } from './CommandRegistry.js';

const help = {
  name: 'help',
  description: 'Show available commands',
  usage: 'help [command]',
  aliases: ['?', 'h'],

  async execute(args, terminal) {
    const { output } = terminal;

    if (args.length > 0) {
      const cmdName = args[0].toLowerCase();

      // Special case: help fake - show only fake commands
      if (cmdName === 'fake') {
        const allCommands = commandRegistry.getAll();
        const fakeCommands = allCommands.filter(cmd => {
          const fullCmd = commandRegistry.get(cmd.name);
          return fullCmd?.fake;
        });

        output.newline();
        output.print('Fake terminal commands (for fun):', 'info');
        output.newline();

        for (const cmd of fakeCommands) {
          const padding = ' '.repeat(Math.max(0, 12 - cmd.name.length));
          output.print(`  ${cmd.name}${padding}${cmd.description}`);
        }

        output.newline();
        output.print('These are joke commands that simulate a real terminal.', 'system');
        output.newline();

        return { success: true };
      }

      // Show help for specific command
      const cmd = commandRegistry.get(cmdName);

      if (!cmd) {
        return { error: true, message: `Unknown command: ${cmdName}` };
      }

      output.newline();
      output.print(`Command: ${cmd.name}`, 'info');
      output.print(`  ${cmd.description}`);
      if (cmd.usage) {
        output.print(`  Usage: ${cmd.usage}`, 'system');
      }
      if (cmd.aliases) {
        output.print(`  Aliases: ${cmd.aliases.join(', ')}`, 'system');
      }
      output.newline();

      return { success: true };
    }

    // Show only real commands (not fake)
    const allCommands = commandRegistry.getAll();
    const realCommands = allCommands.filter(cmd => {
      const fullCmd = commandRegistry.get(cmd.name);
      return !fullCmd?.fake;
    });

    output.newline();
    output.print('Available commands:', 'info');
    output.newline();

    for (const cmd of realCommands) {
      const padding = ' '.repeat(Math.max(0, 12 - cmd.name.length));
      output.print(`  ${cmd.name}${padding}${cmd.description}`);
    }

    output.newline();
    output.print('Type "help fake" for fun terminal commands.', 'system');
    output.newline();

    terminal.showSuggestions([
      { label: 'about', command: 'about' },
      { label: 'blog', command: 'blog' },
      { label: 'skills', command: 'skills' },
      { label: 'contact', command: 'contact' },
    ]);

    return { success: true };
  },
};

commandRegistry.register(help);
