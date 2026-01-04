/**
 * Fun scroll-to-top trick for long content
 * Shows a fake command and scrolls to top after a delay
 * Only triggers if content doesn't fit in viewport
 */
import { delay } from './delay.js';
import { createElement } from './dom.js';

export async function scrollToTopTrick(output) {
  // Check if content is taller than viewport (needs scrolling)
  const needsScroll = output.container.scrollHeight > output.container.clientHeight + 50;
  if (!needsScroll) return;

  // Track if user scrolls during the wait
  let userScrolled = false;
  const initialScroll = output.container.scrollTop;
  const onScroll = () => {
    // If user scrolled up significantly, abort
    if (output.container.scrollTop < initialScroll - 50) {
      userScrolled = true;
    }
  };
  output.container.addEventListener('scroll', onScroll);

  await delay(1250);

  output.container.removeEventListener('scroll', onScroll);

  // Abort if user already started reading
  if (userScrolled) return;

  // Add typing class for visibility
  output.container.classList.add('typing');

  // Scroll to bottom first so user can see the trick
  output.container.scrollTo({ top: 999999, behavior: 'smooth' });

  // Create a fake command echo
  const cmdLine = createElement('div', { className: 'command-echo scroll-trick' });
  const prompt = createElement('span', { className: 'prompt-symbol' });
  const cmdText = createElement('span', { className: 'command-text' }, 'top');
  cmdLine.appendChild(prompt);
  cmdLine.appendChild(cmdText);
  output.container.appendChild(cmdLine);
  output.container.scrollTo({ top: 999999, behavior: 'smooth' });

  await delay(300);

  // Add the witty message
  output.print("↑ Scrolling up... this content is meant to be read from the beginning!", 'system');
  output.container.scrollTo({ top: 999999, behavior: 'smooth' });

  await delay(800);

  // Remove typing class
  output.container.classList.remove('typing');

  // Smooth scroll to top
  output.container.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}
