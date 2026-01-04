/**
 * zsh.js - Fake zsh commands with humorous responses
 */
import { commandRegistry } from './CommandRegistry.js';

// Fake file system
const fakeFiles = {
  '~': ['Desktop', 'Documents', 'Downloads', 'definitely-not-secrets.txt', 'todo.md', '.bashrc', '.zshrc', 'node_modules'],
  '~/Desktop': ['meme.jpg', 'another-meme.png', 'work-stuff-i-guess', 'untitled-folder', 'untitled-folder-2'],
  '~/Documents': ['resume-v47-final-FINAL.docx', 'taxes-2024-maybe.xlsx', 'passwords.txt', 'cat-photos'],
  '~/Downloads': ['setup.exe', 'totally-legit-software.dmg', 'invoice-3847238.pdf', 'react-for-dummies.pdf'],
};

let currentDir = '~';

// ls command
const ls = {
  name: 'ls',
  description: 'List directory contents (fake)',
  usage: 'ls [options]',
  aliases: ['dir'],

  async execute(args, terminal) {
    const files = fakeFiles[currentDir] || ['nothing-here.txt', 'emptiness.void'];

    terminal.output.print(`total ${files.length}`);

    for (const file of files) {
      const isDir = !file.includes('.');
      const color = isDir ? 'info' : 'normal';
      terminal.output.print(isDir ? `drwxr-xr-x  ${file}/` : `-rw-r--r--  ${file}`, color);
    }

    if (args.includes('-a')) {
      terminal.output.print('.', 'system');
      terminal.output.print('..', 'system');
      terminal.output.print('.hidden-secrets', 'error');
      terminal.output.print('.definitely-not-watching-you', 'system');
    }

    return { success: true };
  },
};

// cd command
const cd = {
  name: 'cd',
  description: 'Change directory (fake)',
  usage: 'cd [directory]',

  async execute(args, terminal) {
    const target = args[0] || '~';

    const responses = {
      '~': "There's no place like home.",
      '..': "Going up! *elevator music*",
      '/': "Root access? Bold move.",
      '-': "Back to the future!",
      'Desktop': "Ah yes, where dreams go to die in a sea of icons.",
      'Documents': "The graveyard of 'I'll organize this later'.",
      'Downloads': "Enter at your own risk.",
      'node_modules': "ERROR: Black hole detected. You may never return.",
    };

    const cleanTarget = target.replace('~/', '').replace('/', '');

    if (target === 'node_modules' || cleanTarget === 'node_modules') {
      terminal.output.error("Nice try. That folder is 47GB and counting. No one goes there.");
      return { success: false };
    }

    const response = responses[cleanTarget] || responses[target] || `Changed to ${target}. I have no idea where we are now.`;
    terminal.output.print(response, 'system');

    if (fakeFiles[`~/${cleanTarget}`]) {
      currentDir = `~/${cleanTarget}`;
    } else if (target === '~' || target === '..') {
      currentDir = '~';
    }

    return { success: true };
  },
};

// pwd command
const pwd = {
  name: 'pwd',
  description: 'Print working directory (fake)',
  usage: 'pwd',

  async execute(args, terminal) {
    terminal.output.print(`/Users/you/are/lost/but/its/okay/${currentDir.replace('~', 'home')}`);
    return { success: true };
  },
};

// cat command
const cat = {
  name: 'cat',
  description: 'Concatenate files... or show a cat',
  usage: 'cat [file]',

  async execute(args, terminal) {
    if (!args.length) {
      // Show a cat ASCII art
      const cats = [
        [
          "  /\\_/\\  ",
          " ( o.o ) ",
          "  > ^ <  ",
          " /|   |\\",
          "(_|   |_)",
        ],
        [
          "  /\\_____/\\",
          " /  o   o  \\",
          "( ==  ^  == )",
          " )         (",
          "(           )",
          "( (  )   (  ) )",
          "(__(__)___(__)__)",
        ],
        [
          "    /\\_/\\  ",
          "   ( o o ) ",
          "   =( I )= ",
          "    /   \\  ",
          "   (_)-(_) ",
          "   meow!   ",
        ],
      ];
      const randomCat = cats[Math.floor(Math.random() * cats.length)];
      terminal.output.printLines(randomCat, 'info');
      terminal.output.newline();
      terminal.output.print("You asked for cat, you got cat.", 'system');
      return { success: true };
    }

    const file = args[0];
    const fakeContents = {
      'passwords.txt': "Nice try, FBI.",
      'todo.md': "- [ ] Stop procrastinating\n- [ ] Actually use this todo list\n- [x] Create todo list",
      'definitely-not-secrets.txt': "I knew you'd look here. There are no secrets. Stop snooping.",
      '.bashrc': "# This file is just for show\nexport PS1='confused-developer $ '",
      '.zshrc': "# Configured by someone who googled 'cool zsh plugins'\nZSH_THEME='agnoster'\n# 47 plugins later...",
    };

    if (fakeContents[file]) {
      terminal.output.print(fakeContents[file]);
    } else {
      terminal.output.error(`cat: ${file}: No such file or directory (but nice guess)`);
    }

    return { success: true };
  },
};

// rm command
const rm = {
  name: 'rm',
  description: 'Remove files (fake, thankfully)',
  usage: 'rm [options] [file]',

  async execute(args, terminal) {
    if (args.includes('-rf') && args.includes('/')) {
      terminal.output.error("NICE TRY! I'm not falling for that classic.");
      terminal.output.print("🚨 Security team has been notified. 🚨", 'warning');
      return { success: false };
    }

    if (args.includes('-rf')) {
      terminal.output.print("*nervous sweating*", 'warning');
      terminal.output.print("Pretending to delete... done.", 'system');
      terminal.output.print("(Nothing was actually deleted. You're welcome.)", 'system');
      return { success: true };
    }

    const file = args[args.length - 1];
    if (!file || file.startsWith('-')) {
      terminal.output.error("rm: missing operand. What should I pretend to delete?");
      return { success: false };
    }

    terminal.output.print(`Sending '${file}' to the shadow realm... done.`, 'system');
    return { success: true };
  },
};

// sudo command
const sudo = {
  name: 'sudo',
  description: 'Execute as superuser (LOL)',
  usage: 'sudo [command]',

  async execute(args, terminal) {
    if (!args.length) {
      terminal.output.error("usage: sudo command");
      return { success: false };
    }

    const command = args.join(' ');

    if (command.includes('make me a sandwich')) {
      terminal.output.print("🥪 Okay.", 'success');
      return { success: true };
    }

    const responses = [
      "Password: ********\nSorry, try again.\nPassword: ********\nSorry, try again.\nPassword: ********\nsudo: 3 incorrect password attempts",
      "You are not in the sudoers file. This incident will be reported.",
      "With great power comes great responsibility. Request denied.",
      "sudo: permission denied (but I appreciate the confidence)",
      "Access granted! Just kidding. This is a website.",
    ];

    terminal.output.print(responses[Math.floor(Math.random() * responses.length)], 'error');
    return { success: false };
  },
};

// vim command
const vim = {
  name: 'vim',
  description: 'The editor you can never exit',
  usage: 'vim [file]',
  aliases: ['vi', 'nvim'],

  async execute(args, terminal) {
    const jokes = [
      "You are now trapped. Press :q! to... wait, that won't work here.",
      "I've been stuck in vim since 2015. Send help.",
      "Pro tip: To exit vim, throw your computer out the window.",
      "Entering vim... your terminal session has been sacrificed.",
      "*opens vim* *forgets how to exit* *lives here now*",
    ];

    terminal.output.print(jokes[Math.floor(Math.random() * jokes.length)], 'warning');
    terminal.output.newline();
    terminal.output.print("(Type 'clear' to pretend this never happened)", 'system');
    return { success: true };
  },
};

// nano command
const nano = {
  name: 'nano',
  description: 'The friendly editor',
  usage: 'nano [file]',

  async execute(args, terminal) {
    terminal.output.print("Ah, nano. The editor for those who value their sanity.", 'success');
    terminal.output.print("^X to exit? Revolutionary. Groundbreaking. Actually intuitive.", 'system');
    return { success: true };
  },
};

// exit command
const exit = {
  name: 'exit',
  description: 'Attempt to exit (spoiler: you can\'t)',
  usage: 'exit',
  aliases: ['quit', 'logout'],

  async execute(args, terminal) {
    const responses = [
      "You can check out any time you like, but you can never leave. 🎸",
      "exit: Permission denied. You belong to the terminal now.",
      "Goodbye! *closes eyes* *opens eyes* You're still here.",
      "Error: exit.exe not found. Have you tried turning it off and on again?",
      "Why would you want to leave? It's nice here. Stay. STAY.",
    ];

    terminal.output.print(responses[Math.floor(Math.random() * responses.length)], 'warning');
    return { success: true };
  },
};

// whoami command
const whoami = {
  name: 'whoami',
  description: 'Existential crisis in terminal form',
  usage: 'whoami',

  async execute(args, terminal) {
    const responses = [
      "A good question. Philosophers have debated this for centuries.",
      "visitor (but we both know you're procrastinating)",
      "You are... someone who types terminal commands on a portfolio website.",
      "root\nJust kidding. You wish.",
      "I don't know, but I hope you figure it out someday. 💙",
    ];

    terminal.output.print(responses[Math.floor(Math.random() * responses.length)]);
    return { success: true };
  },
};

// date command
const date = {
  name: 'date',
  description: 'Print the current date',
  usage: 'date',

  async execute(args, terminal) {
    const now = new Date();
    const formatted = now.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });

    terminal.output.print(formatted);
    terminal.output.print("(Yes, this is the actual date. I'm helpful sometimes.)", 'system');
    return { success: true };
  },
};

// echo command
const echo = {
  name: 'echo',
  description: 'Echo text back at you',
  usage: 'echo [text]',

  async execute(args, terminal) {
    if (!args.length) {
      terminal.output.newline();
      return { success: true };
    }

    const text = args.join(' ');
    terminal.output.print(text);

    // Easter eggs
    if (text.toLowerCase().includes('hello')) {
      terminal.output.print("Oh, hello there! 👋", 'info');
    }

    return { success: true };
  },
};

// man command
const man = {
  name: 'man',
  description: 'Manual pages (kind of)',
  usage: 'man [command]',

  async execute(args, terminal) {
    if (!args.length) {
      terminal.output.error("What manual page do you want?");
      return { success: false };
    }

    const command = args[0];

    if (command === 'woman') {
      terminal.output.print("I see what you did there. Very clever. 👏", 'system');
      return { success: true };
    }

    terminal.output.print(`${command.toUpperCase()}(1)                   Fake Manual                   ${command.toUpperCase()}(1)`, 'info');
    terminal.output.newline();
    terminal.output.print("NAME", 'info');
    terminal.output.print(`       ${command} - does ${command} things`);
    terminal.output.newline();
    terminal.output.print("SYNOPSIS", 'info');
    terminal.output.print(`       ${command} [OPTIONS]`);
    terminal.output.newline();
    terminal.output.print("DESCRIPTION", 'info');
    terminal.output.print(`       This is a fake manual page. For real help, try 'help'.`);
    terminal.output.newline();
    terminal.output.print("SEE ALSO", 'info');
    terminal.output.print("       stackoverflow.com, google.com");

    return { success: true };
  },
};

// touch command
const touch = {
  name: 'touch',
  description: 'Create a file (fake)',
  usage: 'touch [file]',

  async execute(args, terminal) {
    if (!args.length) {
      terminal.output.error("touch: missing file operand");
      return { success: false };
    }

    const file = args[0];
    terminal.output.print(`Creating '${file}'... just kidding, this is read-only.`, 'system');
    terminal.output.print("(But I admire your optimism)", 'system');
    return { success: true };
  },
};

// mkdir command
const mkdir = {
  name: 'mkdir',
  description: 'Create a directory (fake)',
  usage: 'mkdir [directory]',

  async execute(args, terminal) {
    if (!args.length) {
      terminal.output.error("mkdir: missing operand");
      return { success: false };
    }

    const dir = args[0];
    terminal.output.print(`mkdir: cannot create directory '${dir}': This is a website, not your file system`, 'error');
    return { success: false };
  },
};

// grep command
const grep = {
  name: 'grep',
  description: 'Search for patterns (fake)',
  usage: 'grep [pattern] [file]',

  async execute(args, terminal) {
    if (!args.length) {
      terminal.output.error("Usage: grep [OPTION]... PATTERN [FILE]...");
      return { success: false };
    }

    const pattern = args[0];
    terminal.output.print(`Searching for '${pattern}'...`, 'system');
    terminal.output.print("Found 0 results. But to be fair, I didn't really look.", 'warning');
    return { success: true };
  },
};

// uptime command
const uptime = {
  name: 'uptime',
  description: 'Show how long the system has been running',
  usage: 'uptime',

  async execute(args, terminal) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    terminal.output.print(` ${now.toLocaleTimeString()}  up ${Math.floor(Math.random() * 365)} days, ${hours}:${minutes.toString().padStart(2, '0')},  1 user,  load average: coffee, more coffee, despair`);
    return { success: true };
  },
};

// Register all commands
[ls, cd, pwd, cat, rm, sudo, vim, nano, exit, whoami, date, echo, man, touch, mkdir, grep, uptime]
  .forEach(cmd => commandRegistry.register(cmd));
