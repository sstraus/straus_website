/**
 * blog command - List blog articles
 */
import { commandRegistry } from './CommandRegistry.js';
import { ArticleIndex } from '../content/ArticleIndex.js';
import { createElement } from '../utils/dom.js';
import { setPageTitle } from '../utils/pageTitle.js';
import { MetaManager } from '../seo/MetaManager.js';

// Calculate how many articles fit based on terminal height
function calculatePageSize(terminal) {
  const terminalEl = document.getElementById('terminal');
  if (!terminalEl) return 5;

  const terminalHeight = terminalEl.clientHeight;
  // Overhead: header+divider ~60px, pagination ~35px, help text ~25px, suggestions ~45px, prompt ~35px, margins ~50px
  const overhead = 250;
  const availableHeight = terminalHeight - overhead;
  // Each article with description ~60px (title+date+desc), archive ~30px, use conservative estimate
  const articleHeight = 65;
  const pageSize = Math.max(5, Math.floor(availableHeight / articleHeight));
  return pageSize;
}

const blog = {
  name: 'blog',
  description: 'Browse blog articles',
  usage: 'blog [page]',
  aliases: ['articles', 'posts'],

  async execute(args, terminal) {
    const { output } = terminal;

    // Parse page number from args
    const page = Math.max(1, parseInt(args[0], 10) || 1);

    // Calculate dynamic page size
    const PAGE_SIZE = calculatePageSize(terminal);

    output.print('Loading articles...', 'system');

    try {
      // Load both main and archive articles
      const mainArticles = await ArticleIndex.getAll();
      const archiveArticles = await ArticleIndex.getArchive();

      // Combine and sort by date (newest first)
      const allArticles = [
        ...mainArticles.map(a => ({ ...a, isArchive: false })),
        ...archiveArticles.map(a => ({ ...a, isArchive: true })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      if (allArticles.length === 0) {
        output.clear();
        output.print('No articles yet. Check back soon!', 'info');
        output.newline();

        terminal.showSuggestions([
          { label: 'about', command: 'about' },
          { label: 'skills', command: 'skills' },
        ]);

        return { success: true };
      }

      // Pagination
      const totalPages = Math.ceil(allArticles.length / PAGE_SIZE);
      const currentPage = Math.min(page, totalPages);
      const startIdx = (currentPage - 1) * PAGE_SIZE;
      const pageArticles = allArticles.slice(startIdx, startIdx + PAGE_SIZE);

      // Update page title for GA tracking
      setPageTitle('Blog');

      // Update meta tags for SEO
      MetaManager.updateBlogListingMeta();

      output.clear();
      output.print(`Blog Articles — Page ${currentPage}/${totalPages}`, 'info');
      output.printDivider();
      output.newline();

      // Create article list
      let archiveSeparatorShown = false;
      // Check if previous pages already had archive articles
      const prevArticles = allArticles.slice(0, startIdx);
      const archiveAlreadyStarted = prevArticles.some(a => a.isArchive);
      if (archiveAlreadyStarted) archiveSeparatorShown = true;

      for (const article of pageArticles) {
        // Show archive separator before first archive article
        if (article.isArchive && !archiveSeparatorShown) {
          const separator = createElement('div', {
            className: 'blog-archive-separator',
          }, '— Archive 2005–2022 —');
          output.container.appendChild(separator);
          archiveSeparatorShown = true;
        }

        const itemClass = article.isArchive ? 'blog-item blog-item-archive' : 'blog-item';
        const item = createElement('div', { className: itemClass });

        const title = createElement('span', {
          className: 'blog-item-title',
          onClick: () => terminal.runCommand(`read ${article.slug}`),
        }, article.title);

        const date = createElement('span', {
          className: 'blog-item-date',
        }, article.date);

        item.appendChild(title);
        item.appendChild(date);

        if (!article.isArchive && article.description) {
          const desc = createElement('div', {
            className: 'blog-item-desc',
          }, article.description);
          item.appendChild(desc);
        }

        output.container.appendChild(item);
      }

      output.newline();

      // Pagination controls
      if (totalPages > 1) {
        const pagination = createElement('div', { className: 'blog-pagination' });

        if (currentPage > 1) {
          const prev = createElement('span', {
            className: 'blog-page-link',
            onClick: () => terminal.runCommand(`blog ${currentPage - 1}`),
          }, '← prev');
          pagination.appendChild(prev);
        }

        const pageInfo = createElement('span', {
          className: 'blog-page-info',
        }, ` ${currentPage} / ${totalPages} `);
        pagination.appendChild(pageInfo);

        if (currentPage < totalPages) {
          const next = createElement('span', {
            className: 'blog-page-link',
            onClick: () => terminal.runCommand(`blog ${currentPage + 1}`),
          }, 'next →');
          pagination.appendChild(next);
        }

        output.container.appendChild(pagination);
        output.newline();
      }

      output.print('Click a title or use "read <slug>" to read an article.', 'system');
      output.newline();

      // Build suggestions from current page articles
      const suggestions = pageArticles.slice(0, 3).map(a => ({
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
