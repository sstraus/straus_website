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
      // Show help for specific command
      const cmdName = args[0].toLowerCase();
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

    // Show all commands
    const commands = commandRegistry.getAll();

    output.newline();
    output.print('Available commands:', 'info');
    output.newline();

    for (const cmd of commands) {
      const padding = ' '.repeat(Math.max(0, 12 - cmd.name.length));
      output.print(`  ${cmd.name}${padding}${cmd.description}`);
    }

    output.newline();
    output.print('Type "help <command>" for more information.', 'system');
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
