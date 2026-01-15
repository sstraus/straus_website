/**
 * Configuration constants
 */
export const config = {
  // Typing animation speeds (ms per character)
  typeSpeed: {
    fast: 5,
    normal: 10,
    slow: 18,
  },

  // Delay durations (ms)
  delays: {
    short: 100,
    medium: 300,
    long: 500,
    lineBreak: 150,
  },

  // Terminal settings
  terminal: {
    maxHistorySize: 50,
    scrollBehavior: 'smooth',
  },

  // Content paths (relative for GitHub Pages compatibility)
  paths: {
    content: 'content',
    blog: 'content/blog',
    blogIndex: 'content/blog/index.json',
    archiveIndex: 'content/blog/wordpress-archive/index.json',
    archive: 'content/blog/wordpress-archive',
  },

  // Site info
  site: {
    name: 'straus.it',
    author: 'Stefano Straus',
    version: '1.2.1',
  },

  // Debug mode
  debug: false,
};
