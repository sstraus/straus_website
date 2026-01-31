#!/usr/bin/env node
/**
 * Generate RSS feed with full article content
 * Usage: node scripts/generate-feed.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Load marked from vendor (UMD bundle exposes global 'marked')
const markedCode = fs.readFileSync(path.join(ROOT, 'vendor/marked.min.js'), 'utf-8');
const markedModule = {};
(function(exports) {
  eval(markedCode);
})(markedModule);
const { marked } = markedModule;

// Load blog index
const indexPath = path.join(ROOT, 'content/blog/index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

// XML escape helper
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date for RSS (RFC 822)
function formatRssDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return `${days[date.getUTCDay()]}, ${String(date.getUTCDate()).padStart(2, '0')} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} 00:00:00 +0000`;
}

// Remove YAML frontmatter from markdown
function removeFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  return match ? markdown.slice(match[0].length) : markdown;
}

// Generate items
const items = index.articles.map(article => {
  const mdPath = path.join(ROOT, 'content/blog', article.file);
  const rawMarkdown = fs.readFileSync(mdPath, 'utf-8');
  const markdown = removeFrontmatter(rawMarkdown);
  const html = marked.parse(markdown);

  return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>https://straus.it/#read/${article.slug}</link>
      <guid isPermaLink="true">https://straus.it/#read/${article.slug}</guid>
      <pubDate>${formatRssDate(article.date)}</pubDate>
      <description>${escapeXml(article.description)}</description>
      <content:encoded><![CDATA[${html}]]></content:encoded>
    </item>`;
}).join('\n\n');

// Get latest date for lastBuildDate
const latestDate = index.articles[0].date;

// Generate feed
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Stefano Straus</title>
    <link>https://straus.it</link>
    <description>Engineering Manager specializing in AI-driven development, software architecture, and developer productivity. Insights on intent-based programming, Claude Code, and modern development patterns.</description>
    <language>en</language>
    <lastBuildDate>${formatRssDate(latestDate)}</lastBuildDate>
    <atom:link href="https://straus.it/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>https://straus.it/img/profile.jpg</url>
      <title>Stefano Straus</title>
      <link>https://straus.it</link>
    </image>

${items}

  </channel>
</rss>
`;

fs.writeFileSync(path.join(ROOT, 'feed.xml'), feed);
console.log('Generated feed.xml with', index.articles.length, 'articles');
