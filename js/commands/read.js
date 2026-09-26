/**
 * read command - Read a blog article
 */
import { commandRegistry } from './CommandRegistry.js';
import { ArticleIndex } from '../content/ArticleIndex.js';
import { ContentLoader } from '../content/ContentLoader.js';
import { MarkdownParser } from '../content/MarkdownParser.js';
import { createElement } from '../utils/dom.js';
import { setPageTitle } from '../utils/pageTitle.js';
import { MetaManager } from '../seo/MetaManager.js';
import { config } from '../config.js';

const FOOTER = '*Questions? [Reach out on X](https://x.com/StefanoStraus).*\n\n*Most of this was still written by a human. For now.*';

/**
 * Estimated reading time at ~200 words per minute (same as the static pages)
 * @param {string} markdown
 * @returns {number}
 */
function readingMinutes(markdown) {
  return Math.max(1, Math.round(markdown.trim().split(/\s+/).length / 200));
}

/**
 * Build the article element shown in the reader window
 * @param {Object} article - Index entry
 * @param {string} markdown - Article source
 * @param {Object[]} related - Related index entries
 * @param {Function} onRelated - Called with a related entry when clicked
 * @returns {HTMLElement}
 */
function buildArticle(article, markdown, related, onRelated) {
  // The header renders the title, so drop the leading "# Title" of the source
  const body = MarkdownParser.removeFrontmatter(markdown).replace(/^\s*# .+\n/, '');
  const tags = (article.tags || []).map(tag => createElement('span', { className: 'tag' }, `#${tag}`));

  const el = createElement('article', { className: 'reader-article' },
    createElement('header', {},
      createElement('h1', {}, article.title),
      createElement('div', { className: 'reader-meta' },
        createElement('time', { datetime: article.date }, article.date),
        ' · ',
        createElement('span', {}, `${readingMinutes(body)} min read`),
        ...tags
      )
    )
  );

  const content = createElement('div');
  content.innerHTML = MarkdownParser.parse(body);
  el.appendChild(content);

  const footer = createElement('footer', { className: 'reader-footer' });
  footer.innerHTML = MarkdownParser.parse(FOOTER);

  if (related.length > 0) {
    const nav = createElement('nav', { className: 'reader-related', 'aria-label': 'Related articles' },
      createElement('h2', {}, 'Related')
    );
    for (const rel of related) {
      nav.appendChild(createElement('a', {
        href: `#read/${rel.slug}`,
        onClick: (e) => { e.preventDefault(); onRelated(rel); },
      }, rel.title));
    }
    footer.appendChild(nav);
  }

  el.appendChild(footer);
  return el;
}

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
      const related = await ArticleIndex.findRelated(article, 2);

      // Update page title for GA tracking
      setPageTitle(article.title);

      // Update meta tags and structured data for SEO
      MetaManager.updateArticleMeta(article);

      output.print(`Opening ${article.slug}.md in Reader...`, 'system');

      const onRelated = (rel) => terminal.runCommand(`read ${rel.slug}`);
      terminal.reader.open(`${article.slug}.md`, buildArticle(article, markdown, related, onRelated));

      // Left in the terminal for when the reader is closed
      const suggestions = related.map(rel => ({ label: rel.slug, command: `read ${rel.slug}` }));
      suggestions.push({ label: 'blog', command: 'blog' }, { label: 'about', command: 'about' });
      terminal.showSuggestions(suggestions);

      return { success: true };
    } catch (err) {
      return { error: true, message: `Failed to load article: ${err.message}` };
    }
  },
};

commandRegistry.register(read);
