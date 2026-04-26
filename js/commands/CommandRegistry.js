/**
 * CommandRegistry - Registry for all available commands
 */

class CommandRegistryClass {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
  }

  /**
   * Register a command
   * @param {Object} command
   * @param {string} command.name
   * @param {string} command.description
   * @param {string} command.usage
   * @param {string[]} command.aliases
   * @param {Function} command.execute
   */
  register(command) {
    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  /**
   * Get a command by name or alias
   * @param {string} name
   * @returns {Object|null}
   */
  get(name) {
    // Check direct command
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }

    // Check aliases
    if (this.aliases.has(name)) {
      return this.commands.get(this.aliases.get(name));
    }

    return null;
  }

  /**
   * Check if command exists
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.commands.has(name) || this.aliases.has(name);
  }

  /**
   * Get all commands
   * @returns {Array<{name: string, description: string, usage: string}>}
   */
  getAll() {
    return Array.from(this.commands.values()).map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      usage: cmd.usage || cmd.name,
    }));
  }

  /**
   * Get command names for autocomplete
   * @returns {string[]}
   */
  getNames() {
    return Array.from(this.commands.keys());
  }
}

export const commandRegistry = new CommandRegistryClass();
