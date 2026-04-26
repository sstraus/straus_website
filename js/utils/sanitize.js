/**
 * HTML sanitization utilities
 */

// Allowed tags for markdown content
const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre',
  'a', 'img',
  'ul', 'ol', 'li',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
]);

// Allowed attributes per tag
const ALLOWED_ATTRS = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  code: ['class'],
  pre: ['class'],
  div: ['class'],
  span: ['class'],
  td: ['align'],
  th: ['align'],
};

/**
 * Sanitize HTML string
 * @param {string} html - Raw HTML
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;

  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_ELEMENT,
    null,
    false
  );

  const nodesToRemove = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const tagName = node.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      nodesToRemove.push(node);
      continue;
    }

    // Filter attributes
    const allowedAttrs = ALLOWED_ATTRS[tagName] || [];
    const attrs = Array.from(node.attributes);

    for (const attr of attrs) {
      if (!allowedAttrs.includes(attr.name)) {
        node.removeAttribute(attr.name);
      } else if (attr.name === 'href' || attr.name === 'src') {
        // Validate URLs
        const url = attr.value.toLowerCase().trim();
        if (url.startsWith('javascript:') || url.startsWith('data:')) {
          node.removeAttribute(attr.name);
        }
      }
    }

    // Add security attributes to links
    if (tagName === 'a') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }

  // Remove disallowed nodes
  for (const node of nodesToRemove) {
    node.parentNode.removeChild(node);
  }

  return template.innerHTML;
}

/**
 * Escape HTML special characters
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
