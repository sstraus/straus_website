/**
 * Configuration constants
 */
export const config = {
  // Typing animation speeds (ms per character)
  typeSpeed: {
    fast: 7,
    normal: 15,
    slow: 25,
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
    version: '1.1.3',
  },

  // Debug mode
  debug: false,
};
