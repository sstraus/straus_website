/**
 * ArticleIndex - Manages blog article metadata
 */
import { ContentLoader } from './ContentLoader.js';
import { config } from '../config.js';

class ArticleIndexClass {
  constructor() {
    this.articles = null;
    this.loaded = false;
  }

  /**
   * Load the article index
   * @returns {Promise<void>}
   */
  async load() {
    if (this.loaded) return;

    try {
      const data = await ContentLoader.loadJson(config.paths.blogIndex);
      this.articles = data.articles || [];
      this.loaded = true;
    } catch (err) {
      console.error('Failed to load article index:', err);
      this.articles = [];
      this.loaded = true;
    }
  }

  /**
   * Get all articles
   * @returns {Promise<Array>}
   */
  async getAll() {
    await this.load();
    return this.articles.sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
  }

  /**
   * Find article by slug
   * @param {string} slug
   * @returns {Promise<Object|null>}
   */
  async findBySlug(slug) {
    await this.load();
    return this.articles.find(a => a.slug === slug) || null;
  }

  /**
   * Find articles by tag
   * @param {string} tag
   * @returns {Promise<Array>}
   */
  async findByTag(tag) {
    await this.load();
    return this.articles.filter(a => a.tags && a.tags.includes(tag));
  }

  /**
   * Find related articles
   * @param {Object} article
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async findRelated(article, limit = 3) {
    await this.load();

    if (!article.tags || article.tags.length === 0) {
      return [];
    }

    // Find articles with matching tags
    const related = this.articles
      .filter(a => a.slug !== article.slug)
      .map(a => {
        const matchingTags = a.tags
          ? a.tags.filter(t => article.tags.includes(t)).length
          : 0;
        return { ...a, matchingTags };
      })
      .filter(a => a.matchingTags > 0)
      .sort((a, b) => b.matchingTags - a.matchingTags)
      .slice(0, limit);

    return related;
  }

  /**
   * Get all unique tags
   * @returns {Promise<string[]>}
   */
  async getAllTags() {
    await this.load();
    const tags = new Set();

    for (const article of this.articles) {
      if (article.tags) {
        for (const tag of article.tags) {
          tags.add(tag);
        }
      }
    }

    return Array.from(tags).sort();
  }

  /**
   * Refresh the index (clear cache and reload)
   */
  async refresh() {
    this.loaded = false;
    this.articles = null;
    ContentLoader.invalidate(config.paths.blogIndex);
    await this.load();
  }
}

export const ArticleIndex = new ArticleIndexClass();
