/**
 * CommandProcessor - Parses and routes commands
 */
import { commandRegistry } from '../commands/CommandRegistry.js';

export class CommandProcessor {
  /**
   * Process a command string
   * @param {string} input - Raw command input
   * @param {Object} context - Terminal context
   * @returns {Promise<Object>} - Command result
   */
  async process(input, context) {
    const { command, args } = this.parse(input);

    if (!command) {
      return { success: true };
    }

    const handler = commandRegistry.get(command);

    if (!handler) {
      return {
        error: true,
        message: `Command not found: ${command}. Type 'help' for available commands.`,
      };
    }

    try {
      const result = await handler.execute(args, context);
      return result || { success: true };
    } catch (err) {
      console.error(`Command error:`, err);
      return {
        error: true,
        message: err.message || 'An error occurred',
      };
    }
  }

  /**
   * Parse command string into command and arguments
   * @param {string} input
   * @returns {{command: string, args: string[]}}
   */
  parse(input) {
    const trimmed = input.trim();
    if (!trimmed) {
      return { command: '', args: [] };
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { command, args };
  }

  /**
   * Check if a command exists
   * @param {string} command
   * @returns {boolean}
   */
  exists(command) {
    return commandRegistry.has(command);
  }

  /**
   * Get all available commands
   * @returns {Array<{name: string, description: string}>}
   */
  getCommands() {
    return commandRegistry.getAll();
  }
}
