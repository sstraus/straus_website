/**
 * Page title management with Google Analytics tracking
 */
import { config } from '../config.js';

const BASE_TITLE = 'Stefano Straus | Software Engineer';

/**
 * Set the page title and send a GA4 page_view event
 * @param {string} [subtitle] - Optional subtitle to append
 */
export function setPageTitle(subtitle = null) {
  const title = subtitle ? `${subtitle} | ${config.site.author}` : BASE_TITLE;
  document.title = title;

  // Send page_view event to GA4 if gtag is available
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_title: title,
      page_location: window.location.href,
    });
  }
}

/**
 * Reset page title to default
 */
export function resetPageTitle() {
  setPageTitle(null);
}
