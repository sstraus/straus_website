// The two links every lab page carries: back to the lab index, and follow on X.
// One source for the URLs and the wording. Usage: put <nav id="lab-links"></nav> where the
// page wants them, load ../../lib/links.css (or ../lib/links.css), and import this module.
const FOLLOW_URL = 'https://x.com/intent/follow?screen_name=StefanoStraus';
const X_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

// The lab index itself sets data-back="false" on the slot.
export function mountLabLinks(slot = document.getElementById('lab-links')) {
  if (!slot) return;
  const back = slot.dataset.back !== 'false';
  slot.classList.add('lab-links');
  slot.innerHTML =
    (back ? '<a class="lab-back" href="/lab/">← Lab</a>' : '') +
    `<a class="lab-follow" href="${FOLLOW_URL}" target="_blank" rel="noopener">${X_ICON}<span>Follow for more</span></a>`;
}

mountLabLinks();
