/**
 * ContentLoader - Fetches content files
 */
import { config } from '../config.js';

class ContentLoaderClass {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Load a content file
   * @param {string} path - Path to content file
   * @returns {Promise<string>}
   */
  async load(path) {
    // Check cache first
    if (this.cache.has(path)) {
      return this.cache.get(path);
    }

    try {
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`);
      }

      const content = await response.text();

      // Cache the content
      this.cache.set(path, content);

      return content;
    } catch (err) {
      console.error(`ContentLoader error for ${path}:`, err);
      throw err;
    }
  }

  /**
   * Load JSON file
   * @param {string} path
   * @returns {Promise<Object>}
   */
  async loadJson(path) {
    const content = await this.load(path);
    try {
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to parse JSON from ${path}: ${err.message}`);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Remove specific item from cache
   * @param {string} path
   */
  invalidate(path) {
    this.cache.delete(path);
  }
}

export const ContentLoader = new ContentLoaderClass();
