/**
 * skills command - Display tech stack
 */
import { commandRegistry } from './CommandRegistry.js';
import { ContentLoader } from '../content/ContentLoader.js';
import { MarkdownParser } from '../content/MarkdownParser.js';

const skills = {
  name: 'skills',
  description: 'View my tech stack',
  usage: 'skills',
  aliases: ['tech', 'stack'],

  async execute(args, terminal) {
    const { output } = terminal;

    output.print('Loading skills...', 'system');

    try {
      const markdown = await ContentLoader.load('/content/skills.md');
      const html = MarkdownParser.parse(markdown);

      output.clear();
      output.renderHtml(html);
      output.newline();

      terminal.showSuggestions([
        { label: 'about', command: 'about' },
        { label: 'blog', command: 'blog' },
        { label: 'contact', command: 'contact' },
      ]);

      return { success: true };
    } catch (err) {
      return { error: true, message: `Failed to load skills: ${err.message}` };
    }
  },
};

commandRegistry.register(skills);
