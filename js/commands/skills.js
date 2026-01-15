/**
 * skills command - Display tech stack
 */
import { commandRegistry } from './CommandRegistry.js';
import { ContentLoader } from '../content/ContentLoader.js';
import { MarkdownParser } from '../content/MarkdownParser.js';
import { scrollToTopTrick } from '../utils/scrollTrick.js';
import { setPageTitle } from '../utils/pageTitle.js';
import { MetaManager } from '../seo/MetaManager.js';
import { config } from '../config.js';

const skills = {
  name: 'skills',
  description: 'View my tech stack',
  usage: 'skills',
  aliases: ['tech', 'stack'],

  async execute(args, terminal) {
    const { output } = terminal;

    output.print('Loading skills...', 'system');

    try {
      const markdown = await ContentLoader.load(`${config.paths.content}/skills.md`);
      const html = MarkdownParser.parse(markdown);

      // Update page title for GA tracking
      setPageTitle('Skills');

      // Reset meta tags to default
      MetaManager.resetToDefault();

      output.clear();
      output.renderHtml(html);
      output.newline();

      terminal.showSuggestions([
        { label: 'about', command: 'about' },
        { label: 'blog', command: 'blog' },
        { label: 'contact', command: 'contact' },
      ]);

      // Trigger scroll-to-top trick if content is long
      scrollToTopTrick(output);

      return { success: true };
    } catch (err) {
      return { error: true, message: `Failed to load skills: ${err.message}` };
    }
  },
};

commandRegistry.register(skills);
