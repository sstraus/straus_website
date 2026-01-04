/**
 * about command - Display personal profile
 */
import { commandRegistry } from './CommandRegistry.js';
import { ContentLoader } from '../content/ContentLoader.js';
import { MarkdownParser } from '../content/MarkdownParser.js';

const about = {
  name: 'about',
  description: 'Learn about me',
  usage: 'about',
  aliases: ['me', 'profile', 'whoami'],

  async execute(args, terminal) {
    const { output } = terminal;

    output.print('Loading profile...', 'system');

    try {
      const markdown = await ContentLoader.load('/content/profile.md');
      const html = MarkdownParser.parse(markdown);

      // Clear the loading message and render content
      output.clear();
      output.renderHtml(html);
      output.newline();

      terminal.showSuggestions([
        { label: 'blog', command: 'blog' },
        { label: 'skills', command: 'skills' },
        { label: 'contact', command: 'contact' },
      ]);

      return { success: true };
    } catch (err) {
      return { error: true, message: `Failed to load profile: ${err.message}` };
    }
  },
};

commandRegistry.register(about);
