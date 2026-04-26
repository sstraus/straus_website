/**
 * MarkdownParser - Converts markdown to HTML
 */
import { sanitizeHtml } from '../utils/sanitize.js';

class MarkdownParserClass {
  constructor() {
    this.renderer = null;
    this.initialized = false;
  }

  /**
   * Initialize the parser
   */
  init() {
    if (this.initialized) return;

    // Check if marked is available
    if (typeof marked === 'undefined') {
      console.error('marked.js is not loaded');
      return;
    }

    // Configure marked
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false,
    });

    this.initialized = true;
  }

  /**
   * Parse markdown to HTML
   * @param {string} markdown
   * @returns {string}
   */
  parse(markdown) {
    this.init();

    if (!this.initialized) {
      // Fallback: return escaped text
      return `<pre>${markdown}</pre>`;
    }

    // Remove frontmatter if present
    const content = this.removeFrontmatter(markdown);

    // Parse markdown
    const html = marked.parse(content);

    // Sanitize HTML
    return sanitizeHtml(html);
  }

  /**
   * Remove YAML frontmatter from markdown
   * @param {string} markdown
   * @returns {string}
   */
  removeFrontmatter(markdown) {
    const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
    return markdown.replace(frontmatterRegex, '');
  }

  /**
   * Extract frontmatter as object
   * @param {string} markdown
   * @returns {Object|null}
   */
  extractFrontmatter(markdown) {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!match) return null;

    const frontmatter = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
      }

      frontmatter[key] = value;
    }

    return frontmatter;
  }
}

export const MarkdownParser = new MarkdownParserClass();
