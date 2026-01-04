/**
 * skills command - Display tech stack
 */
import { commandRegistry } from './CommandRegistry.js';

const skills = {
  name: 'skills',
  description: 'View my tech stack',
  usage: 'skills',
  aliases: ['tech', 'stack'],

  async execute(args, terminal) {
    const { output } = terminal;

    output.newline();
    output.print('Tech Stack', 'info');
    output.printDivider();
    output.newline();

    const categories = [
      {
        name: 'Languages',
        items: ['JavaScript/TypeScript', 'Python', 'Go', 'SQL'],
      },
      {
        name: 'Frontend',
        items: ['React', 'Vue.js', 'HTML/CSS', 'Tailwind'],
      },
      {
        name: 'Backend',
        items: ['Node.js', 'FastAPI', 'PostgreSQL', 'Redis'],
      },
      {
        name: 'DevOps',
        items: ['Docker', 'Kubernetes', 'AWS', 'GitHub Actions'],
      },
      {
        name: 'AI/ML',
        items: ['LangChain', 'OpenAI API', 'Claude API', 'Vector DBs'],
      },
    ];

    for (const category of categories) {
      output.print(`  ${category.name}`, 'info');
      output.print(`    ${category.items.join(' · ')}`, 'system');
      output.newline();
    }

    terminal.showSuggestions([
      { label: 'about', command: 'about' },
      { label: 'blog', command: 'blog' },
      { label: 'contact', command: 'contact' },
    ]);

    return { success: true };
  },
};

commandRegistry.register(skills);
