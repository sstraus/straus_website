#!/usr/bin/env node
/**
 * Generate static HTML pages for blog posts (SEO)
 *
 * Creates blog/{slug}/index.html for each article so search engines
 * can crawl and index the content. They share css/reader.css with the
 * terminal reader window and link to the terminal view at /#read/{slug}.
 *
 * Usage: node scripts/generate-blog-pages.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'blog');
const ATTACHMENTS_DIR = path.join(ROOT, 'content/blog/attachments');
const BASE_URL = 'https://straus.it';

// Site version, used to cache-bust the shared reader stylesheet
const VERSION = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf-8')
  .match(/version:\s*'([^']+)'/)[1];

// Load marked from vendor (same pattern as generate-feed.js)
const markedCode = fs.readFileSync(path.join(ROOT, 'vendor/marked.min.js'), 'utf-8');
const markedModule = {};
(function(exports) {
  eval(markedCode);
})(markedModule);
const { marked } = markedModule;

// Load blog index
const index = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'content/blog/index.json'), 'utf-8')
);

// Remove YAML frontmatter from markdown (same as generate-feed.js)
function removeFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  return match ? markdown.slice(match[0].length) : markdown;
}

// Remove the leading "# Title" heading: the template renders its own <h1>,
// keeping it in the body would produce two H1s on the page (bad for SEO)
function removeLeadingH1(markdown) {
  return markdown.replace(/^\s*# .+\n/, '');
}

// Estimated reading time at ~200 words per minute
function readingTime(markdown) {
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

// Escape HTML for attribute values
function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

// Generate one static page. prev = older post, next = newer post (for internal linking)
function generatePage(article, prev, next) {
  const mdPath = path.join(ROOT, 'content/blog', article.file);
  const rawMarkdown = fs.readFileSync(mdPath, 'utf-8');
  const markdown = removeLeadingH1(removeFrontmatter(rawMarkdown));
  const html = marked.parse(markdown);

  const url = `${BASE_URL}/blog/${article.slug}/`;
  const description = escapeAttr(article.description || article.title);
  const title = escapeAttr(article.title);
  const image = `${BASE_URL}/img/profile.jpg`;
  const tags = article.tags || [];
  const minutes = readingTime(markdown);

  const articleMeta = [
    `  <meta property="article:published_time" content="${article.date}">`,
    `  <meta property="article:author" content="${BASE_URL}">`,
    ...tags.map(t => `  <meta property="article:tag" content="${escapeAttr(t)}">`),
  ].join('\n');

  const tagChips = tags
    .map(t => `<span class="tag">#${escapeAttr(t)}</span>`)
    .join(' ');

  const prevLink = prev
    ? `<a class="post-nav-link prev" href="/blog/${prev.slug}/" rel="prev"><span>&larr; Older</span>${escapeAttr(prev.title)}</a>`
    : '<span></span>';
  const nextLink = next
    ? `<a class="post-nav-link next" href="/blog/${next.slug}/" rel="next"><span>Newer &rarr;</span>${escapeAttr(next.title)}</a>`
    : '<span></span>';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description || article.title,
    url,
    image,
    author: {
      '@type': 'Person',
      name: 'Stefano Straus',
      url: BASE_URL,
    },
    datePublished: article.date,
    dateModified: article.date,
    publisher: {
      '@type': 'Person',
      name: 'Stefano Straus',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    keywords: tags.join(', '),
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en" class="reader">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <!-- Same theme preference as the terminal; applied before paint -->
  <script>
    try {
      if (localStorage.getItem('straus-terminal-theme') === 'light') {
        document.documentElement.classList.add('light-theme');
      }
    } catch (e) {}
  </script>
  <title>${title} | Stefano Straus</title>
  <meta name="description" content="${description}">
  <meta name="author" content="Stefano Straus">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="Stefano Straus" href="/feed.xml">

  <!-- Open Graph -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:alt" content="Stefano Straus">
  <meta property="og:site_name" content="Stefano Straus">
${articleMeta}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@StefanoStraus">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">

  <!-- Structured Data -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <link rel="stylesheet" href="/css/reader.css?v=${VERSION}">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: var(--rd-sans);
      max-width: calc(680px + 2.5rem); margin: 0 auto; padding: 0 1.25rem 3rem;
    }
    a { color: var(--rd-link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .site-nav {
      display: flex; gap: 1.25rem; align-items: baseline;
      padding: 1.25rem 0; margin-bottom: 3rem;
      border-bottom: 1px solid var(--rd-rule);
      font-family: var(--rd-mono); font-size: 0.95rem;
    }
    .site-nav .brand { font-weight: 700; color: var(--rd-head); }
    .theme-toggle {
      margin-left: auto; font-size: 1rem; color: var(--rd-soft);
      background: none; border: 1px solid var(--rd-rule); border-radius: 6px;
      padding: 0.1rem 0.55rem; cursor: pointer;
    }
    .terminal-link {
      margin-top: 3rem; padding: 0.875rem 1.25rem;
      background: var(--rd-surface); border: 1px solid var(--rd-rule);
      border-radius: 6px; font-family: var(--rd-mono); font-size: 0.95rem;
    }
    .terminal-link::before { content: '$ '; color: var(--rd-soft); }
    .post-nav {
      display: flex; justify-content: space-between; gap: 1rem;
      margin-top: 1.5rem;
    }
    .post-nav-link {
      display: block; max-width: 48%; line-height: 1.4;
    }
    .post-nav-link span {
      display: block; font-family: var(--rd-mono); font-size: 0.85rem;
      color: var(--rd-soft); margin-bottom: 0.25rem;
    }
    .post-nav-link.next { text-align: right; margin-left: auto; }
    .site-footer {
      margin-top: 3rem; padding-top: 1.25rem;
      border-top: 1px solid var(--rd-rule);
      font-family: var(--rd-mono); font-size: 0.9rem; color: var(--rd-soft);
      display: flex; gap: 1.25rem;
    }
  </style>
</head>
<body>
  <nav class="site-nav">
    <a class="brand" href="/">stefano@straus.it:~$</a>
    <a href="/#blog">blog</a>
    <a href="/feed.xml">rss</a>
    <button class="theme-toggle" type="button" aria-label="Toggle light and dark theme">&#9680;</button>
  </nav>
  <article class="reader-article">
    <header>
      <h1>${article.title}</h1>
      <div class="reader-meta">
        <time datetime="${article.date}">${formatDate(article.date)}</time> · <span>${minutes} min read</span>
        ${tagChips}
      </div>
    </header>
${html}
  </article>
  <div class="terminal-link">
    Read this in the <a href="/#read/${article.slug}">terminal view</a>
  </div>
  <nav class="post-nav" aria-label="Post navigation">
    ${prevLink}
    ${nextLink}
  </nav>
  <footer class="site-footer">
    <a href="/">&larr; straus.it</a>
    <span>&copy; Stefano Straus</span>
  </footer>
  <script>
    document.querySelector('.theme-toggle').addEventListener('click', function () {
      var light = document.documentElement.classList.toggle('light-theme');
      try { localStorage.setItem('straus-terminal-theme', light ? 'light' : 'dark'); } catch (e) {}
    });
  </script>
</body>
</html>
`;
}

// Copy companion files shipped with a post (e.g. a standalone report page).
// blog/ is wiped on every run, so they are authored under
// content/blog/attachments/{slug}/ and served at /blog/{slug}/{file}
function copyAttachments(slug, destDir) {
  const src = path.join(ATTACHMENTS_DIR, slug);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, destDir, { recursive: true });
}

// Clean and regenerate blog/ directory
if (fs.existsSync(BLOG_DIR)) {
  fs.rmSync(BLOG_DIR, { recursive: true });
}

// index.articles is sorted newest-first: prev (older) = i+1, next (newer) = i-1
let count = 0;
index.articles.forEach((article, i) => {
  const prev = index.articles[i + 1] || null;
  const next = index.articles[i - 1] || null;
  const dir = path.join(BLOG_DIR, article.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), generatePage(article, prev, next));
  copyAttachments(article.slug, dir);
  count++;
});

console.log(`Generated ${count} static blog pages in blog/`);

// Refresh the crawler-visible article list on the homepage
const RECENT_COUNT = 8;
const homePath = path.join(ROOT, 'index.html');
const recentItems = index.articles
  .slice(0, RECENT_COUNT)
  .map(a => `      <li><a href="/blog/${a.slug}/">${escapeAttr(a.title)}</a></li>`)
  .join('\n');
const home = fs.readFileSync(homePath, 'utf-8').replace(
  /(<!-- recent-articles:start[^>]*-->)[\s\S]*?(<!-- recent-articles:end -->)/,
  `$1\n${recentItems}\n      $2`
);
fs.writeFileSync(homePath, home);
console.log('Updated recent articles in index.html');

// Also update sitemap.xml with /blog/ URLs
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf-8');
sitemap = sitemap.replace(
  /https:\/\/straus\.it\/#read\//g,
  'https://straus.it/blog/'
);
// Add trailing slash to blog URLs that don't have one. File URLs such as
// an attachment's report.html keep their name and must stay untouched.
sitemap = sitemap.replace(
  /<loc>https:\/\/straus\.it\/blog\/([^<]+?)(?<!\/)(?=<\/loc>)/g,
  (match, urlPath) => (path.extname(urlPath) ? match : `<loc>https://straus.it/blog/${urlPath}/`)
);

const sitemapUrls = new Set(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url)
);
const missingArticleEntries = index.articles
  .filter(article => !sitemapUrls.has(`${BASE_URL}/blog/${article.slug}/`))
  .map(article => `  <url>
    <loc>${BASE_URL}/blog/${article.slug}/</loc>
    <lastmod>${article.date}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`);

if (missingArticleEntries.length > 0) {
  sitemap = sitemap.replace(
    '</urlset>',
    `${missingArticleEntries.join('\n')}\n</urlset>`
  );
}

fs.writeFileSync(sitemapPath, sitemap);
console.log('Updated sitemap.xml with /blog/ URLs');
