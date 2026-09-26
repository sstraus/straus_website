/**
 * Theme state shared by the theme command and the reader window.
 * The key is also read by the inline scripts in index.html and in the
 * static blog pages, so all of them follow one preference.
 */
const THEME_KEY = 'straus-terminal-theme';

/**
 * @returns {'light'|'dark'}
 */
export function currentTheme() {
  return document.body.classList.contains('light-theme') ? 'light' : 'dark';
}

/**
 * Apply a theme without persisting it
 * @param {'light'|'dark'} theme
 */
function applyTheme(theme) {
  const light = theme === 'light';
  document.body.classList.toggle('light-theme', light);

  // Update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', light ? '#ffffff' : '#000000');
  }
}

/**
 * Apply a theme and persist it
 * @param {'light'|'dark'} theme
 * @returns {boolean} false when the preference could not be saved
 */
export function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Apply the saved theme on load and remove the FOUC class set by index.html
 */
export function initTheme() {
  document.documentElement.classList.remove('light-theme-loading');
  try {
    if (localStorage.getItem(THEME_KEY) === 'light') {
      applyTheme('light');
    }
  } catch (e) {
    // localStorage not available, use default theme
  }
}
