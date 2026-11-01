/**
 * Page title management with Google Analytics tracking
 */
import { config } from '../config.js';

const BASE_TITLE = 'Stefano Straus | Software Engineer';

/**
 * Set the page title and send a GA4 page_view event
 * @param {string} [subtitle] - Optional subtitle to append
 */
export function setPageTitle(subtitle = null, articlePath = null) {
  const title = subtitle ? `${subtitle} | ${config.site.author}` : BASE_TITLE;
  document.title = title;

  const routes = { About: '/about/', Skills: '/skills/', Contact: '/contact/', Blog: '/blog/' };
  const path = articlePath || (subtitle === null ? '/' : routes[subtitle]);
  if (path) window.siteAnalytics?.track(path, title);
}

/** Reset page title to default. */
export function resetPageTitle() {
  setPageTitle(null);
}
