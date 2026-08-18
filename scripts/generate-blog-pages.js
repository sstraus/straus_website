#!/usr/bin/env node
/**
 * Generate static HTML pages for blog posts (SEO)
 *
 * Creates blog/{slug}/index.html for each article so search engines
 * can crawl and index the content. JS-enabled browsers are redirected
 * to the terminal view at /#read/{slug}.
 *
 * Usage: node scripts/generate-blog-pages.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'blog');
const ATTACHMENTS_DIR = path.join(ROOT, 'content/blog/attachments');
const BASE_URL = 'https://straus.it';

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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${title} | Stefano Straus</title>
  <meta name="description" content="${description}">
  <meta name="author" content="Stefano Straus">
  <meta name="theme-color" content="#ffffff">
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

  <style>
    :root {
      color-scheme: light;
      --bg: #ffffff; --fg: #1f2328; --muted: #656d76; --accent: #0066cc;
      --surface: #f6f8fa; --border: #d0d7de;
      --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    * { box-sizing: border-box; }
    html { background: #ffffff; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      max-width: 780px; margin: 0 auto; padding: 0 1.25rem 3rem;
      line-height: 1.7; color: var(--fg); background: var(--bg);
      font-size: 1rem;
    }
    article p, article li { font-size: 1em; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .site-nav {
      display: flex; gap: 1.25rem; align-items: baseline;
      padding: 1.25rem 0; margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      font-family: var(--mono); font-size: 1rem;
    }
    .site-nav .brand { font-weight: 700; color: var(--fg); }
    .site-nav .brand:hover { color: var(--accent); text-decoration: none; }
    .post-header { margin-bottom: 2.5rem; }
    .post-header h1 {
      font-size: 2.5rem; line-height: 1.2; margin: 0 0 0.75rem;
      letter-spacing: -0.02em;
    }
    .post-meta {
      display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: baseline;
      font-family: var(--mono); font-size: 0.95rem; color: var(--muted);
    }
    .tag { color: var(--accent); }
    article h2 { font-size: 1.75rem; margin-top: 2.5rem; letter-spacing: -0.01em; }
    article h3 { font-size: 1.4rem; margin-top: 2rem; }
    article img { max-width: 100%; border-radius: 6px; }
    article hr { border: 0; border-top: 1px solid var(--border); margin: 2.5rem 0; }
    pre {
      background: var(--surface); border: 1px solid var(--border);
      padding: 1rem; overflow-x: auto; border-radius: 6px; line-height: 1.5;
    }
    code { font-family: var(--mono); font-size: 0.875em; }
    :not(pre) > code {
      background: var(--surface); border: 1px solid var(--border);
      padding: 0.1em 0.35em; border-radius: 4px;
    }
    blockquote {
      border-left: 3px solid var(--accent); margin: 1.75rem 0;
      padding: 0.5rem 1.25rem; color: var(--accent); font-style: italic;
      background: rgba(0, 102, 204, 0.06); border-radius: 0 6px 6px 0;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--border); padding: 0.5rem; text-align: left; }
    th { background: var(--surface); }
    .terminal-link {
      margin-top: 3rem; padding: 0.875rem 1.25rem;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 6px; font-family: var(--mono); font-size: 1rem;
    }
    .terminal-link::before { content: '$ '; color: var(--muted); }
    .post-nav {
      display: flex; justify-content: space-between; gap: 1rem;
      margin-top: 1.5rem;
    }
    .post-nav-link {
      display: block; max-width: 48%; font-size: 1rem; line-height: 1.4;
    }
    .post-nav-link span {
      display: block; font-family: var(--mono); font-size: 0.85rem;
      color: var(--muted); margin-bottom: 0.25rem;
    }
    .post-nav-link.next { text-align: right; margin-left: auto; }
    .site-footer {
      margin-top: 3rem; padding-top: 1.25rem;
      border-top: 1px solid var(--border);
      font-family: var(--mono); font-size: 0.9rem; color: var(--muted);
      display: flex; gap: 1.25rem;
    }
  </style>
</head>
<body>
  <nav class="site-nav">
    <a class="brand" href="/">stefano@straus.it:~$</a>
    <a href="/#blog">blog</a>
    <a href="/feed.xml">rss</a>
  </nav>
  <article>
    <header class="post-header">
      <h1>${article.title}</h1>
      <div class="post-meta">
        <time datetime="${article.date}">${formatDate(article.date)}</time>
        <span>${minutes} min read</span>
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
fs.writeFileSync(sitemapPath, sitemap);
console.log('Updated sitemap.xml with /blog/ URLs');
