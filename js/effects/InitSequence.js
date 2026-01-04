/**
 * InitSequence - Startup animation sequence
 */
import { delay } from '../utils/delay.js';
import { config } from '../config.js';

// ASCII Art portrait - full image
const ASCII_PORTRAIT = [
  '                                                                           ',
  '                          ░░                                               ',
  '                                                                           ',
  '                    ░ ░ ░░░░░░░░                  ░░░           ░  ░░░░░   ',
  '   ░     ░           ░▒▒▒░▒▒░▒▒░░░░░░              ░  ░ ░  ░░ ░░░░░ ░░░░   ',
  '░░░░    ░░░░░░░     ▓░▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░             ░░░░  ░  ░░░░ ░░░░  ░  ',
  '   ░░░░ ░░ ░░░░░ ░░▓▓▓▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒░░░░                 ░ ░░░░░░░░░░░░░  ',
  ' ░  ░ ░░░░ ░     ▒▓▓▓▓▓▓▓▒▓▓▒▒▒▒▒▒▒▒▒▒▒░░░░░ ░            ░ ░░▒▒▒▒▒▒▒▒▒░░░░',
  ' ░░░░░░ ░░ ░    ▒▓▓▓▒▓▓▓▓▒▓▓▓▓▓▒▒▒▒▒▒▒▒░░░░      ░     ░░░░░░░░         ░  ',
  '░  ░░░       ░░  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒░░              ░░░░░    ░  ▒  ░  ░░',
  ' ░  ░░     ░░░ ░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒░░░            ░░░░░░░░ ░   ░  ░   ',
  '░░░░░░░░░░░  ░ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒░▒▒▒▒▒▒▒░░░░░░░     ░░░░  ░▒░ ░░░▒▒░▒░░░',
  ' ▒▒░░▒▒▒▒░▒▒▓▓▒▓█▓▓▓▓▓▓▓▓▓▓▓▒▒▓▒▒▓▒░▒▓▓▓▒▒▒▒▒▒▒░░░     ░░░░░░ ░░░░▒▒░▒▒░░░░',
  '▒▒░▒░▒▓▒░░░▓▓▓▓▓▓█▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▓▓▓▓▓▓▒▒░▒▓▓▓▓▒▒▒ ░░░░░░░░▒░▒▒░░░░░░░▒',
  '▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓█▓▓▒▓▒▓▓▓▓▓▓███▓▓▒▓▓█▓▓▓▓▒ ▓█▓██▓░▒░░░░░░▒▒▒▒▒░▒░░░░░▒░░',
  ' ░▓▓▓▓▓▓▓▓▓▒▓▓▓██▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░ ▓██▓▒░░ ░░░░░▒░░░▒░▒░░░░░ ░░░',
  '░  ▓▓▒▒▒▒▒▒▒▓▓███▓▓▓▓▓▓▓▓▓▒▒▒▒▓▒▓▓▓▓▓▓▓▓▓▓▓▓▒  ▓▓▒▒░  ▒▒░░░▒░░░░░▒░▒░░▒▒▒▒▒',
  '▒▒ ░ ░▒▓▒▒▒▒▓▓▓▓█▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒░░▒░▒▒▒▓▓▓▓▓▒  ▓▒░    ▒▒▓▒▒▒▒▒▒▓▓▒▒▓▓▓▓▓▓▓',
  '▒▓▒▒░░░▒░▒▒░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒░░░░▒▒▒▓▓▓▒▒▒         ▒▓▒░░░▒▒▒▒▓▒▒▓▓▓▒▒▒▓',
  '▒▒░░░░▒▒▒▒░▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░▒░▒▒▓▓▓▓▓▒▒░  ░░░░  ▒░░▒░░░░▒▒░▒▒▓▓▓▒░▒▒',
  '▒▒░░▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▓▓▓▓▒▒▓▓▓▒░░ ▒░░░░▒▒▒▒▒▒░▒▒▒▓▒▓▒▒▓▓▓▓▓',
  '▒▓▒▒░░▓▒▒▓▓▒▒▒▒░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▓▓▓▓█▓███▒▒▒▒▒▓▓▒░░░ ░░░▒▒▓▓▒▓▒▓▓▓▒▓▓▓▓▓',
  '▓▓▓▒▒▒▓░░░░▓░▒▒▒▒▓▓▒▓▓▓▒▓▓▓▓▓▓▓▒▒▓▓▒▒█▓▓▓███▓▓▒  ░█▓▒░▒▒▒░▒▒▓▓▒▒░▓█▒▒▒▓░▓▒▒',
  '▓▒▒▓▒▒▒░░▒░░  ▒▒▒▒▓▒▓▓▓▓▓▓▓▓▓▓▓▒█▒██▓▓█▓▓▓▓█▓▓▓░░░▓▓▒▓▓▒░░▒░ ░▒█▓░░▓░░▒░░▓▓',
  '▓█▒▓▓▒▒░░▓░░▒  ▓▒▓▓▓▓▒▓▒▓▓▓▓▓▓▓▒▓▓▓██▓▓▓▓▓▒▓▒▒░▒▓▒▓▒░▓▓▓▓▓▓▓▓▒▓▓▓▓▓▓▓▓▓▒▒▓▓',
  '░░░▓▒▒ ░▓░▓▒  ░░█▒▒▓▒▓▒▓▒▓▓▓▒▒▒▒▒▓▓▓▓▓███▓▓▓▓█▒  ▒░░▓▓▓▓▓█▓▓▓▓█▓█▓▓▓▓▓▒▓▓▓█',
  '█▓  ▓▒██▓▓▓ ░░░░░▒▓▓▓▓▓▓▓▓▓▓▓▓▓▒▓▓▓▓▓▓▓▓▓▒░░░░░  ▒░░███▓██▓▓▓▓█▓█▓▓▓███▓▓▓█',
  '█▓▒▓██▓▓██ ░░░░░░░░▓▓▒▓▓▓▓▓▓▓▓▓▓▒▓▒▓▓▓▓▓▓▓▒▓▒▓░ ░░░████▓███████████████████',
  '▓███▒▓█▓█  ░░░░░░░░░░▒▓▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒░░ ░ █████████████████████████',
  '▓█████▓   ░ ░░░░░░░░░░░▒█▓▓▓▓██▓▓▓▓▓▓▒▒▓▒▓▒▒▒    ██████████████████████████',
  '████       ▒░░░░░░░░░░░░░░█▓▓▓▓██▓▓█▒▓▒▒▒▒▒░░░  ███████████████████████████',
  '█           ▒ ░░░░░░░ ░░░░░░▒█▒▓█▓▓▓▓▓▓▓▓▓▓▓▒▒▓  ██████████████████████████',
  '             ▒░░░ ░    ░░░░░░░▒██▓▓▓▓▓▓▒▓▓▓▓▓▒    █████████████████████████',
  '              ▒▒ ░           ░░░▒▓▓▓▓▓▓▒▒░▓      ██████████████████████████',
  '               ░▒ ░             ░░░▓▓▒▒░          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓██▓▓▓▓',
  '                ░▒                   ░░░          ▓▒▓▓▓▓▓▓▓▓▓▓▓▓▒▓▒▒▒▒▓▓▓▓▓',
  '                                       ▓         ▒▓▓▓▓▓▓▓▓▓▒▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒',
];

const ASCII_LOGO = [
  '   ███████╗████████╗██████╗  █████╗ ██╗   ██╗███████╗',
  '   ██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██║   ██║██╔════╝',
  '   ███████╗   ██║   ██████╔╝███████║██║   ██║███████╗',
  '   ╚════██║   ██║   ██╔══██╗██╔══██║██║   ██║╚════██║',
  '   ███████║   ██║   ██║  ██║██║  ██║╚██████╔╝███████║',
  '   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
];

const INIT_STEPS = [
  { text: 'Initializing straus-code v1.0.0...', delay: 400 },
  { text: 'Loading personality matrix... done', delay: 300 },
  { text: 'Establishing neural pathways... done', delay: 300 },
  { text: 'Ready.', delay: 200 },
];

export class InitSequence {
  /**
   * Run the initialization sequence
   * @param {OutputRenderer} output
   */
  static async run(output) {
    // Print ASCII portrait with hover image (white)
    output.printAsciiWithImage(ASCII_PORTRAIT, 'img/profile.jpg');
    await delay(300);

    output.newline();
    output.newline();

    // Print ASCII logo (orange)
    output.printAscii(ASCII_LOGO, 'logo');
    output.newline();

    await delay(500);

    // Print initialization steps
    for (const step of INIT_STEPS) {
      await output.typewrite(`> ${step.text}`, 'system', {
        speed: config.typeSpeed.fast,
      });
      await delay(step.delay);
    }

    output.newline();

    // Welcome message
    await output.typewrite(
      "Welcome! I'm Stefano's personal website running in terminal mode.",
      'normal',
      { speed: config.typeSpeed.normal }
    );

    await delay(200);

    output.print(
      "Type 'help' for available commands or click a suggestion below.",
      'system'
    );

    output.newline();

    // Initial suggestions
    output.printSuggestions(
      [
        { label: 'about', command: 'about' },
        { label: 'blog', command: 'blog' },
        { label: 'skills', command: 'skills' },
        { label: 'contact', command: 'contact' },
      ],
      (cmd) => {
        // Will be connected by Terminal after init
        window.terminalApp?.runCommand(cmd);
      }
    );

    output.newline();
  }

  /**
   * Run a minimal/quick init (for returning visitors)
   * @param {OutputRenderer} output
   */
  static async runQuick(output) {
    output.print(`straus-code v${config.site.version}`, 'system');
    output.print("Type 'help' for commands.", 'system');
    output.newline();

    output.printSuggestions(
      [
        { label: 'about', command: 'about' },
        { label: 'blog', command: 'blog' },
        { label: 'skills', command: 'skills' },
        { label: 'contact', command: 'contact' },
      ],
      (cmd) => window.terminalApp?.runCommand(cmd)
    );

    output.newline();
  }
}
