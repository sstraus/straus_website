/**
 * Configuration constants
 */
export const config = {
  // Typing animation speeds (ms per character)
  typeSpeed: {
    fast: 15,
    normal: 30,
    slow: 50,
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

  // Content paths
  paths: {
    content: '/content',
    blog: '/content/blog',
    blogIndex: '/content/blog/index.json',
  },

  // Site info
  site: {
    name: 'straus.it',
    author: 'Stefano Straus',
    version: '1.0.0',
  },

  // Debug mode
  debug: false,
};
