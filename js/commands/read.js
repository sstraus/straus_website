/**
 * read command - Read a blog article
 */
import { commandRegistry } from './CommandRegistry.js';
import { ArticleIndex } from '../content/ArticleIndex.js';
import { ContentLoader } from '../content/ContentLoader.js';
import { MarkdownParser } from '../content/MarkdownParser.js';
import { createElement } from '../utils/dom.js';
import { scrollToTopTrick } from '../utils/scrollTrick.js';
import { config } from '../config.js';

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
      let article = await ArticleIndex.findBySlug(slug);
      let isArchive = false;

      // Check archive if not found in main index
      if (!article) {
        article = await ArticleIndex.findArchiveBySlug(slug);
        isArchive = true;
      }

      if (!article) {
        return {
          error: true,
          message: `Article not found: ${slug}\nUse "blog" to see available articles.`,
        };
      }

      const basePath = isArchive ? config.paths.archive : config.paths.blog;
      const markdown = await ContentLoader.load(`${basePath}/${article.file}`);
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

      // Standard blog footer
      output.newline();
      output.printDivider();
      output.newline();
      const footer = '*Questions? [Reach out on X](https://x.com/StefanoStraus).*';
      output.renderHtml(MarkdownParser.parse(footer));
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

      // Trigger the scroll-to-top trick (don't await - runs in background)
      scrollToTopTrick(output);

      return { success: true };
    } catch (err) {
      return { error: true, message: `Failed to load article: ${err.message}` };
    }
  },
};

commandRegistry.register(read);
