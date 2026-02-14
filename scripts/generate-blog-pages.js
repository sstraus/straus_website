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

// Generate one static page
function generatePage(article) {
  const mdPath = path.join(ROOT, 'content/blog', article.file);
  const rawMarkdown = fs.readFileSync(mdPath, 'utf-8');
  const markdown = removeFrontmatter(rawMarkdown);
  const html = marked.parse(markdown);

  const url = `${BASE_URL}/blog/${article.slug}/`;
  const description = escapeAttr(article.description || article.title);
  const title = escapeAttr(article.title);
  const image = `${BASE_URL}/img/profile.jpg`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description || article.title,
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
    keywords: article.tags ? article.tags.join(', ') : '',
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Stefano Straus</title>
  <meta name="description" content="${description}">
  <meta name="author" content="Stefano Straus">
  <link rel="canonical" href="${url}">

  <!-- Open Graph -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="Stefano Straus">

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

  <!-- Redirect JS users to terminal view -->
  <script>window.location.replace('/#read/${article.slug}');</script>

  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #222; }
    a { color: #0066cc; }
    .back { margin-bottom: 2rem; }
    article img { max-width: 100%; }
    time { color: #666; }
    h1 { margin-bottom: 0.25rem; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 0.9em; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #555; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <noscript>
    <nav class="back"><a href="/">&larr; straus.it</a></nav>
    <article>
      <h1>${article.title}</h1>
      <time datetime="${article.date}">${formatDate(article.date)}</time>
${html}
    </article>
    <nav><a href="/">&larr; Back to straus.it</a></nav>
  </noscript>
</body>
</html>
`;
}

// Clean and regenerate blog/ directory
if (fs.existsSync(BLOG_DIR)) {
  fs.rmSync(BLOG_DIR, { recursive: true });
}

let count = 0;
for (const article of index.articles) {
  const dir = path.join(BLOG_DIR, article.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), generatePage(article));
  count++;
}

console.log(`Generated ${count} static blog pages in blog/`);

// Also update sitemap.xml with /blog/ URLs
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf-8');
sitemap = sitemap.replace(
  /https:\/\/straus\.it\/#read\//g,
  'https://straus.it/blog/'
);
// Add trailing slash to blog URLs that don't have one
sitemap = sitemap.replace(
  /<loc>https:\/\/straus\.it\/blog\/([^<]+?)(?<!\/)(?=<\/loc>)/g,
  '<loc>https://straus.it/blog/$1/'
);
fs.writeFileSync(sitemapPath, sitemap);
console.log('Updated sitemap.xml with /blog/ URLs');
