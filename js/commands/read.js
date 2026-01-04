/**
 * read command - Read a blog article
 */
import { commandRegistry } from './CommandRegistry.js';
import { ArticleIndex } from '../content/ArticleIndex.js';
import { ContentLoader } from '../content/ContentLoader.js';
import { MarkdownParser } from '../content/MarkdownParser.js';
import { createElement } from '../utils/dom.js';

const read = {
  name: 'read',
  description: 'Read a blog article',
  usage: 'read <article-slug>',
  aliases: ['article', 'view', 'open'],

  async execute(args, terminal) {
    const { output } = terminal;

    if (args.length === 0) {
      output.newline();
      output.print('Usage: read <article-slug>', 'info');
      output.print('Use "blog" to see available articles.', 'system');
      output.newline();

      terminal.showSuggestions([
        { label: 'blog', command: 'blog' },
      ]);

      return { success: true };
    }

    const slug = args[0].toLowerCase();

    output.print('Loading article...', 'system');

    try {
      const article = await ArticleIndex.findBySlug(slug);

      if (!article) {
        return {
          error: true,
          message: `Article not found: ${slug}\nUse "blog" to see available articles.`,
        };
      }

      const markdown = await ContentLoader.load(`/content/blog/${article.file}`);
      const html = MarkdownParser.parse(markdown);

      output.clear();

      // Article header
      output.print(article.title, 'info');

      // Meta info
      const meta = createElement('div', { className: 'article-meta' });

      const dateSpan = createElement('span', { className: 'date' }, article.date);
      meta.appendChild(dateSpan);

      if (article.tags && article.tags.length > 0) {
        const tagsSpan = createElement('span', { className: 'tags' });
        for (const tag of article.tags) {
          tagsSpan.appendChild(createElement('span', { className: 'tag' }, tag));
        }
        meta.appendChild(tagsSpan);
      }

      output.container.appendChild(meta);
      output.printDivider();
      output.newline();

      // Article content
      output.renderHtml(html);
      output.newline();

      // Find related articles (same tags)
      const related = await ArticleIndex.findRelated(article, 2);
      const suggestions = [
        { label: 'blog', command: 'blog' },
        { label: 'about', command: 'about' },
      ];

      if (related.length > 0) {
        for (const rel of related) {
          suggestions.unshift({ label: rel.slug, command: `read ${rel.slug}` });
        }
      }

      terminal.showSuggestions(suggestions);

      return { success: true };
    } catch (err) {
      return { error: true, message: `Failed to load article: ${err.message}` };
    }
  },
};

commandRegistry.register(read);
