/**
 * blog command - List blog articles
 */
import { commandRegistry } from './CommandRegistry.js';
import { ArticleIndex } from '../content/ArticleIndex.js';
import { createElement } from '../utils/dom.js';

const blog = {
  name: 'blog',
  description: 'Browse blog articles',
  usage: 'blog',
  aliases: ['articles', 'posts'],

  async execute(args, terminal) {
    const { output } = terminal;

    output.print('Loading articles...', 'system');

    try {
      const articles = await ArticleIndex.getAll();

      if (articles.length === 0) {
        output.clear();
        output.print('No articles yet. Check back soon!', 'info');
        output.newline();

        terminal.showSuggestions([
          { label: 'about', command: 'about' },
          { label: 'skills', command: 'skills' },
        ]);

        return { success: true };
      }

      output.clear();
      output.print('Blog Articles', 'info');
      output.printDivider();
      output.newline();

      // Create article list
      for (const article of articles) {
        const item = createElement('div', { className: 'blog-item' });

        const title = createElement('span', {
          className: 'blog-item-title',
          onClick: () => terminal.runCommand(`read ${article.slug}`),
        }, article.title);

        const date = createElement('span', {
          className: 'blog-item-date',
        }, article.date);

        const desc = createElement('div', {
          className: 'blog-item-desc',
        }, article.description || '');

        item.appendChild(title);
        item.appendChild(date);
        if (article.description) {
          item.appendChild(desc);
        }

        output.container.appendChild(item);
      }

      output.newline();
      output.print('Click a title or use "read <slug>" to read an article.', 'system');
      output.newline();

      // Build suggestions from first 3 articles
      const suggestions = articles.slice(0, 3).map(a => ({
        label: a.slug,
        command: `read ${a.slug}`,
      }));

      suggestions.push({ label: 'about', command: 'about' });

      terminal.showSuggestions(suggestions);

      return { success: true };
    } catch (err) {
      return { error: true, message: `Failed to load articles: ${err.message}` };
    }
  },
};

commandRegistry.register(blog);
