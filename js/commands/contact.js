/**
 * contact command - Display contact information
 */
import { commandRegistry } from './CommandRegistry.js';
import { createElement } from '../utils/dom.js';

const contact = {
  name: 'contact',
  description: 'Get in touch',
  usage: 'contact',
  aliases: ['email', 'social'],

  async execute(args, terminal) {
    const { output } = terminal;

    output.newline();
    output.print('Contact', 'info');
    output.printDivider();
    output.newline();

    const links = [
      {
        icon: '→',
        label: 'GitHub',
        url: 'https://github.com/stefanostraus',
        display: 'github.com/stefanostraus',
      },
      {
        icon: '→',
        label: 'LinkedIn',
        url: 'https://linkedin.com/in/stefanostraus',
        display: 'linkedin.com/in/stefanostraus',
      },
      {
        icon: '→',
        label: 'Email',
        url: 'mailto:hello@straus.it',
        display: 'hello@straus.it',
      },
    ];

    const container = createElement('div', { className: 'md-content' });

    for (const link of links) {
      const p = createElement('p');
      const icon = createElement('span', {}, `${link.icon} `);
      const label = createElement('strong', {}, `${link.label}: `);
      const a = createElement('a', {
        href: link.url,
        target: '_blank',
        rel: 'noopener noreferrer',
      }, link.display);

      p.appendChild(icon);
      p.appendChild(label);
      p.appendChild(a);
      container.appendChild(p);
    }

    output.container.appendChild(container);
    output.newline();

    output.print("Feel free to reach out – I'm always happy to connect!", 'system');
    output.newline();

    terminal.showSuggestions([
      { label: 'about', command: 'about' },
      { label: 'blog', command: 'blog' },
      { label: 'skills', command: 'skills' },
    ]);

    return { success: true };
  },
};

commandRegistry.register(contact);
