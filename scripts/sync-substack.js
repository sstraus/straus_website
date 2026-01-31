#!/usr/bin/env node
/**
 * Sync Substack RSS feed to blog
 * Usage: node scripts/sync-substack.js [--dry-run]
 *
 * Fetches posts from Substack and converts them to blog markdown files.
 * Use --dry-run to preview without writing files.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUBSTACK_FEED = 'https://stefanostraus.substack.com/feed';
const ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'content/blog');
const INDEX_PATH = path.join(ROOT, 'content/blog/index.json');

const DRY_RUN = process.argv.includes('--dry-run');

// Fetch RSS feed
function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Parse RSS XML (simple regex-based, no dependencies)
function parseRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');
    const content = extractCdata(itemXml, 'content:encoded');

    if (title && link) {
      items.push({ title, link, pubDate, description, content });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || '').trim() : null;
}

function extractCdata(xml, tag) {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

// Convert HTML to Markdown (basic conversion)
function htmlToMarkdown(html) {
  if (!html) return '';

  return html
    // Remove Substack-specific elements
    .replace(/<div class="subscription-widget-wrap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
    .replace(/<div class="captioned-image-container">[\s\S]*?<\/div>/gi, '')
    // Headers
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    // Paragraphs
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Bold/Italic
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
    // Lists
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    // Code
    .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n\n')
    // Blockquotes
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n')
    // Images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)\n\n')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)\n\n')
    // Horizontal rules
    .replace(/<hr[^>]*\/?>/gi, '---\n\n')
    // Line breaks
    .replace(/<br[^>]*\/?>/gi, '\n')
    // Strip remaining HTML
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Generate slug from title
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Format date as YYYY-MM-DD
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

// Load existing index
function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
  } catch {
    return { articles: [] };
  }
}

// Check if article already exists (by slug or title)
function articleExists(index, slug, title) {
  return index.articles.some(a =>
    a.slug === slug ||
    a.title.toLowerCase() === title.toLowerCase()
  );
}

// Main sync function
async function sync() {
  console.log('Fetching Substack feed...');
  const xml = await fetchFeed(SUBSTACK_FEED);
  const items = parseRss(xml);

  console.log(`Found ${items.length} posts in feed`);

  const index = loadIndex();
  let added = 0;

  for (const item of items) {
    const slug = slugify(item.title);
    const date = formatDate(item.pubDate);
    const filename = `${date}-${slug}.md`;

    if (articleExists(index, slug, item.title)) {
      console.log(`  [SKIP] "${item.title}" (already exists)`);
      continue;
    }

    const markdown = htmlToMarkdown(item.content);
    const description = item.description || markdown.slice(0, 150).replace(/\n/g, ' ') + '...';

    // Create frontmatter + content
    const fileContent = `---
title: ${item.title}
date: ${date}
tags: []
---

# ${item.title}

${markdown}
`;

    console.log(`  [NEW] "${item.title}"`);
    console.log(`        slug: ${slug}`);
    console.log(`        date: ${date}`);
    console.log(`        file: ${filename}`);

    if (!DRY_RUN) {
      // Write markdown file
      fs.writeFileSync(path.join(BLOG_DIR, filename), fileContent);

      // Add to index
      index.articles.unshift({
        slug,
        title: item.title,
        date,
        description: description.slice(0, 200),
        tags: [],
        file: filename
      });

      added++;
    }
  }

  if (!DRY_RUN && added > 0) {
    // Sort by date descending
    index.articles.sort((a, b) => b.date.localeCompare(a.date));
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
    console.log(`\nAdded ${added} new articles. Run 'node scripts/generate-feed.js' to update RSS.`);
  } else if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would add ${items.filter(i => !articleExists(index, slugify(i.title), i.title)).length} new articles`);
  } else {
    console.log('\nNo new articles to add.');
  }
}

sync().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
