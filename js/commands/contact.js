/**
 * contact command - Display contact information
 */
import { commandRegistry } from './CommandRegistry.js';
import { ContentLoader } from '../content/ContentLoader.js';
import { MarkdownParser } from '../content/MarkdownParser.js';

const contact = {
  name: 'contact',
  description: 'Get in touch',
  usage: 'contact',
  aliases: ['email', 'social'],

  async execute(args, terminal) {
    const { output } = terminal;

    output.print('Loading contact info...', 'system');

    try {
      const markdown = await ContentLoader.load('/content/contact.md');
      const html = MarkdownParser.parse(markdown);

      // Clear the loading message and render content
      output.clear();
      output.renderHtml(html);
      output.newline();

      terminal.showSuggestions([
        { label: 'about', command: 'about' },
        { label: 'blog', command: 'blog' },
        { label: 'skills', command: 'skills' },
      ]);

      return { success: true };
    } catch (err) {
      return { error: true, message: `Failed to load contact info: ${err.message}` };
    }
  },
};

commandRegistry.register(contact);
