/**
 * MetaManager - Dynamic meta tag and structured data management for SEO
 */
import { config } from '../config.js';

class MetaManagerClass {
  constructor() {
    this.baseUrl = 'https://straus.it';
    this.defaultImage = `${this.baseUrl}/img/profile.jpg`;
  }

  /**
   * Update page meta tags
   * @param {Object} meta - Meta information
   * @param {string} meta.title - Page title
   * @param {string} meta.description - Page description
   * @param {string} meta.type - Page type (website, article)
   * @param {string} [meta.image] - OG image URL
   * @param {string} [meta.url] - Canonical URL
   */
  updateMeta({ title, description, type = 'website', image, url }) {
    // Update document title
    document.title = title ? `${title} | ${config.site.author}` : `${config.site.author} | Software Engineer`;

    // Update or create meta tags
    this.setMetaTag('description', description);
    this.setMetaTag('og:title', title || `${config.site.author} | Software Engineer`);
    this.setMetaTag('og:description', description);
    this.setMetaTag('og:type', type);
    this.setMetaTag('og:image', image || this.defaultImage);
    this.setMetaTag('og:url', url || this.baseUrl);

    // Twitter Card
    this.setMetaTag('twitter:card', 'summary_large_image');
    this.setMetaTag('twitter:title', title || `${config.site.author} | Software Engineer`);
    this.setMetaTag('twitter:description', description);
    this.setMetaTag('twitter:image', image || this.defaultImage);

    // Canonical URL
    this.setLinkTag('canonical', url || this.baseUrl);
  }

  /**
   * Update meta tags for a blog article
   * @param {Object} article - Article object from ArticleIndex
   */
  updateArticleMeta(article) {
    const url = `${this.baseUrl}/#read/${article.slug}`;
    const description = article.description || `${article.title} by ${config.site.author}`;

    this.updateMeta({
      title: article.title,
      description: description,
      type: 'article',
      url: url,
      image: article.image || this.defaultImage,
    });

    // Add article-specific JSON-LD
    this.updateJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: description,
      author: {
        '@type': 'Person',
        name: config.site.author,
        url: this.baseUrl,
      },
      datePublished: article.date,
      dateModified: article.date,
      publisher: {
        '@type': 'Person',
        name: config.site.author,
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url,
      },
      keywords: article.tags ? article.tags.join(', ') : '',
    });
  }

  /**
   * Reset to default homepage meta tags
   */
  resetToDefault() {
    this.updateMeta({
      title: '',
      description: 'Personal website of Stefano Straus - Engineering Manager specializing in AI-driven development, software architecture, and developer productivity. Explore insights on intent-based programming, Claude Code, and modern development patterns.',
      type: 'website',
      url: this.baseUrl,
    });

    // Add Person schema for homepage
    this.updateJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: config.site.author,
      url: this.baseUrl,
      jobTitle: 'Engineering Manager',
      description: 'Engineering Manager specializing in AI-driven development, software architecture, and developer productivity',
      knowsAbout: [
        'Software Engineering',
        'AI Development',
        'Intent-Based Programming',
        'Engineering Management',
        'Claude Code',
        'Developer Productivity',
      ],
      sameAs: [
        'https://github.com/straussmaximilian',
        'https://x.com/StefanoStraus',
      ],
    });
  }

  /**
   * Update meta tags for blog listing page
   */
  updateBlogListingMeta() {
    this.updateMeta({
      title: 'Blog',
      description: 'Articles on AI-driven development, intent-based programming, Claude Code, software engineering, and modern development patterns by Stefano Straus.',
      type: 'website',
      url: `${this.baseUrl}/#blog`,
    });

    // Remove article JSON-LD if present
    this.removeJsonLd();
  }

  /**
   * Set or update a meta tag
   * @private
   */
  setMetaTag(name, content) {
    if (!content) return;

    const isProperty = name.startsWith('og:') || name.startsWith('twitter:');
    const attr = isProperty ? 'property' : 'name';

    let meta = document.querySelector(`meta[${attr}="${name}"]`);

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.appendChild(meta);
    }

    meta.setAttribute('content', content);
  }

  /**
   * Set or update a link tag
   * @private
   */
  setLinkTag(rel, href) {
    if (!href) return;

    let link = document.querySelector(`link[rel="${rel}"]`);

    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      document.head.appendChild(link);
    }

    link.setAttribute('href', href);
  }

  /**
   * Update JSON-LD structured data
   * @private
   */
  updateJsonLd(data) {
    // Remove existing JSON-LD
    this.removeJsonLd();

    // Create new script tag
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data, null, 2);
    script.id = 'jsonld-metadata';
    document.head.appendChild(script);
  }

  /**
   * Remove JSON-LD structured data
   * @private
   */
  removeJsonLd() {
    const existing = document.getElementById('jsonld-metadata');
    if (existing) {
      existing.remove();
    }
  }
}

export const MetaManager = new MetaManagerClass();
