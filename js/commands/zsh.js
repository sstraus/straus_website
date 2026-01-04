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
  description: 'List directory contents',
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
  description: 'Change directory',
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
  description: 'Print working directory',
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
  description: 'Create a file',
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
  description: 'Create a directory',
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
  description: 'Search for patterns',
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

// su command
const su = {
  name: 'su',
  description: 'Substitute user identity',
  usage: 'su [user]',

  async execute(args, terminal) {
    const user = args[0] || 'root';
    terminal.output.print(`Password: `, 'system');
    await new Promise(r => setTimeout(r, 800));
    terminal.output.print('••••••••', 'system');
    await new Promise(r => setTimeout(r, 500));

    if (user === 'root') {
      terminal.output.error("su: Authentication failure. Nice try though.");
      terminal.output.print("Hint: The password is not 'password', '123456', or 'letmein'.", 'system');
    } else {
      terminal.output.error(`su: user '${user}' does not exist. There's only me here.`);
    }
    return { success: false };
  },
};

// git command
const git = {
  name: 'git',
  description: 'The stupid content tracker',
  usage: 'git <command>',

  async execute(args, terminal) {
    const subcommand = args[0];
    const subargs = args.slice(1);

    const responses = {
      'status': "On branch main\nYour branch is ahead of 'origin/main' by 47 commits.\n  (use \"git push\" to publish your local commits)\n\nnothing to commit, working tree clean\n(that's suspicious...)",
      'log': "commit abc1234 (HEAD -> main)\nAuthor: You <you@example.com>\nDate:   Just now\n\n    Fixed bug introduced in previous fix for the fix\n\ncommit def5678\nAuthor: Past You <you@example.com>\nDate:   Yesterday\n\n    This will definitely work trust me",
      'blame': `Line 42: Written by "Not Me" <definitely-not-me@example.com>\nLine 43: Written by "The Intern" <intern@example.com>\nLine 44: Written by "Future Me's Problem" <tomorrow@example.com>`,
      'commit': subargs.length ? `[main 1a2b3c4] ${subargs.join(' ')}\n 47 files changed, 9001 insertions(+), 42 deletions(-)\n\nWarning: You committed on a Friday at 5pm. Bold move.` : "Aborting commit due to empty commit message.\n(We've all been there)",
      'push': "Pushing to origin/main...\n\nremote: 🔥 Deploying to production...\nremote: 🚀 Done!\nremote: 💀 3 customers already complaining\nremote: ☕ Grab coffee, you'll need it\n\nTo github.com:you/regrets.git\n   abc1234..def5678  main -> main",
      'pull': "remote: Counting objects: 42, done.\nremote: Compressing objects: 100% (42/42), done.\nAuto-merging everything.js\nCONFLICT (content): Merge conflict in everything.js\nCONFLICT (content): Merge conflict in styles.css\nCONFLICT (content): Merge conflict in your-sanity.md\nAutomatic merge failed; fix conflicts and then commit the result.",
      'checkout': subargs[0] === '-b' ? `Switched to a new branch '${subargs[1] || 'feature/hope-this-works'}'` : `error: pathspec '${subargs[0] || 'happiness'}' did not match any file(s) known to git`,
      'stash': "Saved working directory and index state WIP on main: hiding my mess\n(You'll forget about this in 3... 2... 1...)",
      'rebase': "Successfully rebased and updated refs/heads/main.\nWarning: History has been rewritten. Your coworkers will love this.",
      'merge': "Merge made by the 'pray' strategy.\n everything.js | 999 ++++++++++++---------------\n 1 file changed, 500 insertions(+), 499 deletions(-)",
    };

    if (!subcommand) {
      terminal.output.print("usage: git <command> [<args>]", 'system');
      terminal.output.print("\nThese are common Git commands:", 'system');
      terminal.output.print("   status    Show the working tree status (spoiler: it's a mess)", 'normal');
      terminal.output.print("   blame     Show who to blame (never you)", 'normal');
      terminal.output.print("   push      Push to remote (and pray)", 'normal');
      terminal.output.print("   pull      Update local (and cry)", 'normal');
      return { success: true };
    }

    const response = responses[subcommand];
    if (response) {
      response.split('\n').forEach(line => terminal.output.print(line));
    } else {
      terminal.output.error(`git: '${subcommand}' is not a git command. See 'git --help'.`);
      terminal.output.print(`\nDid you mean: git gud`, 'system');
    }

    return { success: true };
  },
};

// npm command
const npm = {
  name: 'npm',
  description: 'Node Package Manager',
  usage: 'npm <command>',
  aliases: ['yarn', 'pnpm', 'bun'],

  async execute(args, terminal) {
    const subcommand = args[0];

    if (subcommand === 'install' || subcommand === 'i') {
      terminal.output.print('Installing dependencies...', 'system');
      await new Promise(r => setTimeout(r, 500));

      const steps = [
        '⠋ Resolving dependencies...',
        '⠙ Fetching packages...',
        '⠹ Linking dependencies...',
        '⠸ Building fresh packages...',
        '⠼ Downloading the entire internet...',
        '⠴ Questioning life choices...',
        '⠦ Almost there...',
      ];

      for (const step of steps) {
        terminal.output.print(step, 'system');
        await new Promise(r => setTimeout(r, 300));
      }

      terminal.output.newline();
      terminal.output.print('added 847,293 packages in 3.2s', 'success');
      terminal.output.print('', 'normal');
      terminal.output.print('42 vulnerabilities (13 low, 17 moderate, 10 high, 2 critical)', 'warning');
      terminal.output.print('', 'normal');
      terminal.output.print("Run 'npm audit fix' to fix them (it won't work)", 'system');
    } else if (subcommand === 'audit') {
      terminal.output.print('found 42 vulnerabilities', 'error');
      terminal.output.print("Run 'npm audit fix' to pretend you're fixing them", 'system');
    } else if (subcommand === 'run') {
      terminal.output.error(`npm ERR! Missing script: "${args[1] || 'undefined'}"`);
      terminal.output.print(`\nDid you mean: npm run away`, 'system');
    } else {
      terminal.output.print("npm: the package manager that packages your patience", 'system');
      terminal.output.print("\nUsage: npm <command>", 'normal');
      terminal.output.print("\nCommands: install, audit, run, uninstall, cry", 'normal');
    }

    return { success: true };
  },
};

// make command
const make = {
  name: 'make',
  description: 'GNU make utility',
  usage: 'make [target]',

  async execute(args, terminal) {
    const target = args[0];

    if (target === 'coffee') {
      terminal.output.print('Brewing...', 'system');
      await new Promise(r => setTimeout(r, 1000));
      terminal.output.print('', 'normal');
      terminal.output.print('    ( (', 'normal');
      terminal.output.print('     ) )', 'normal');
      terminal.output.print('  ........', 'normal');
      terminal.output.print('  |      |]', 'normal');
      terminal.output.print('  \\      /', 'normal');
      terminal.output.print('   `----\'', 'normal');
      terminal.output.print('', 'normal');
      terminal.output.print('☕ Coffee ready! Now you can code for another 3 hours.', 'success');
    } else if (target === 'sandwich') {
      terminal.output.error("make: *** What? Make it yourself.");
      terminal.output.print("Hint: Try 'sudo make sandwich'", 'system');
    } else if (target === 'love') {
      terminal.output.error("make: *** No rule to make target 'love'. Stop.");
      terminal.output.print("(Segmentation fault in heart)", 'system');
    } else if (target === 'money') {
      terminal.output.error("make: *** Cannot make 'money' without 'time'.");
      terminal.output.print("Dependency 'rich-parents' not found.", 'system');
    } else if (target === 'sense') {
      terminal.output.error("make: *** No rule to make target 'sense'. Stop.");
      terminal.output.print("Have you tried turning it off and on again?", 'system');
    } else if (!target) {
      terminal.output.error("make: *** No targets specified and no makefile found. Stop.");
      terminal.output.print("Try: make coffee, make sandwich, make love, make money", 'system');
    } else {
      terminal.output.error(`make: *** No rule to make target '${target}'. Stop.`);
    }

    return { success: true };
  },
};

// curl command
const curl = {
  name: 'curl',
  description: 'Transfer data from or to a server',
  usage: 'curl [url]',
  aliases: ['wget'],

  async execute(args, terminal) {
    const url = args[0];

    if (!url) {
      terminal.output.error("curl: no URL specified");
      return { success: false };
    }

    terminal.output.print(`Connecting to ${url}...`, 'system');
    await new Promise(r => setTimeout(r, 500));

    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      terminal.output.print("There's no place like 127.0.0.1 🏠", 'success');
    } else if (url.includes('google')) {
      terminal.output.print("HTTP/1.1 200 OK", 'normal');
      terminal.output.print("X-Google-Knows: Everything about you", 'system');
      terminal.output.print("X-Ads: Incoming in 3... 2... 1...", 'system');
    } else if (url.includes('stackoverflow')) {
      terminal.output.print("HTTP/1.1 200 OK", 'normal');
      terminal.output.print("Content: The same question from 2012 that saved your life", 'system');
    } else {
      terminal.output.print("HTTP/1.1 418 I'm a teapot", 'warning');
      terminal.output.print("The server refuses to brew coffee because it is a teapot.", 'system');
    }

    return { success: true };
  },
};

// ping command
const ping = {
  name: 'ping',
  description: 'Send ICMP ECHO_REQUEST packets',
  usage: 'ping [host]',

  async execute(args, terminal) {
    const host = args[0];

    if (!host) {
      terminal.output.error("ping: missing host operand");
      return { success: false };
    }

    terminal.output.print(`PING ${host}: 56 data bytes`, 'system');

    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, 400));
      const time = (Math.random() * 50 + 10).toFixed(1);
      terminal.output.print(`64 bytes from ${host}: icmp_seq=${i} ttl=64 time=${time}ms`);
    }

    terminal.output.print('', 'normal');

    if (host.includes('google')) {
      terminal.output.print("Google is watching... Google is always watching. 👁️", 'system');
    } else if (host.includes('localhost') || host.includes('127.0.0.1')) {
      terminal.output.print("Pinging yourself? That's deep. 🤔", 'system');
    } else if (host.includes('facebook') || host.includes('meta')) {
      terminal.output.print("Request timeout. Zuckerberg is in the metaverse.", 'system');
    } else {
      terminal.output.print("All packets returned. The internet still works. Somehow.", 'system');
    }

    return { success: true };
  },
};

// history command
const history = {
  name: 'history',
  description: 'Show command history',
  usage: 'history',

  async execute(args, terminal) {
    const fakeHistory = [
      '  1  git commit -m "initial commit"',
      '  2  git commit -m "fixed typo"',
      '  3  git commit -m "fixed typo in typo fix"',
      '  4  sudo rm -rf node_modules',
      '  5  npm install',
      '  6  npm install',
      '  7  npm install --force',
      '  8  stackoverflow "why npm not working"',
      '  9  curl wttr.in',
      ' 10  echo "I should learn Rust"',
      ' 11  cargo install everything',
      ' 12  npm install',
      ' 13  git push --force',
      ' 14  git push --force-with-lease',
      ' 15  git push --force --force --please',
      ' 16  man woman',
      ' 17  sudo make me a sandwich',
      ' 18  cat /dev/urandom > /dev/confidence',
      ' 19  ls -la ~/.secrets',
      ' 20  history | grep password',
    ];

    fakeHistory.forEach(line => terminal.output.print(line));
    terminal.output.newline();
    terminal.output.print("(This isn't your actual history. Or is it? 👀)", 'system');

    return { success: true };
  },
};

// sl command (steam locomotive)
const sl = {
  name: 'sl',
  description: 'Steam Locomotive',
  usage: 'sl',

  async execute(args, terminal) {
    terminal.output.print("You typed 'sl' instead of 'ls'. Classic.", 'system');
    terminal.output.newline();

    const train = [
      '      ====        ________                ___________',
      '  _D _|  |_______/        \\__I_I_____===__|_________|',
      '   |(_)---  |   H\\________/ |   |        =|___ ___|',
      '   /     |  |   H  |  |     |   |         ||_| |_||',
      '  |      |  |   H  |__--------------------| [___] |',
      '  | ________|___H__/__|_____/[][]~\\_______|       |',
      '  |/ |   |-----------I_____I [][] []  D   |=======|__',
      '__/ =| o |=-O=====O=====O=====O \\ ____Y___________|__',
      ' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ',
      '  \\_/      \\__/  \\__/  \\__/  \\__/      \\_/            ',
    ];

    train.forEach(line => terminal.output.print(line));
    terminal.output.newline();
    terminal.output.print('🚂 Choo choo! Now try typing "ls" correctly.', 'system');

    return { success: true };
  },
};

// cowsay command
const cowsay = {
  name: 'cowsay',
  description: 'A cow says things',
  usage: 'cowsay [message]',

  async execute(args, terminal) {
    const messages = [
      "Moo! I mean... Hello, World!",
      "Have you tried turning it off and on again?",
      "I'm not a bug, I'm a feature!",
      "Works on my machine ¯\\_(ツ)_/¯",
      "There are only 10 types of people in the world...",
      "// TODO: Write better code",
      "It's not a bug, it's an undocumented feature",
      "Keep calm and git push --force",
      "Mass hysteria: 2.1 million dependencies",
    ];

    const message = args.length ? args.join(' ') : messages[Math.floor(Math.random() * messages.length)];
    const border = '_'.repeat(message.length + 2);
    const spaces = ' '.repeat(message.length + 2);

    terminal.output.print(` ${border}`, 'normal');
    terminal.output.print(`< ${message} >`, 'normal');
    terminal.output.print(` ${'-'.repeat(message.length + 2)}`, 'normal');
    terminal.output.print('        \\   ^__^', 'normal');
    terminal.output.print('         \\  (oo)\\_______', 'normal');
    terminal.output.print('            (__)\\       )\\/\\', 'normal');
    terminal.output.print('                ||----w |', 'normal');
    terminal.output.print('                ||     ||', 'normal');

    return { success: true };
  },
};

// docker command
const docker = {
  name: 'docker',
  description: 'Container platform',
  usage: 'docker <command>',
  aliases: ['podman'],

  async execute(args, terminal) {
    const subcommand = args[0];

    if (subcommand === 'run') {
      terminal.output.print('Pulling image...', 'system');
      await new Promise(r => setTimeout(r, 500));
      terminal.output.print('Creating container...', 'system');
      await new Promise(r => setTimeout(r, 300));
      terminal.output.print('Starting container...', 'success');
      await new Promise(r => setTimeout(r, 200));
      terminal.output.print('Container crashed.', 'error');
      await new Promise(r => setTimeout(r, 300));
      terminal.output.print('Restarting container...', 'system');
      await new Promise(r => setTimeout(r, 200));
      terminal.output.print('Container crashed.', 'error');
      terminal.output.print('', 'normal');
      terminal.output.print("It works on my machine! 🐳➡️🔥", 'warning');
    } else if (subcommand === 'ps') {
      terminal.output.print('CONTAINER ID   IMAGE           STATUS                    NAMES', 'normal');
      terminal.output.print('a1b2c3d4e5f6   node:latest     Up 2 seconds              optimistic_turing', 'normal');
      terminal.output.print('f6e5d4c3b2a1   node:latest     Exited (137) 1 min ago    sad_hopper', 'normal');
      terminal.output.print('1234567890ab   redis:alpine    Up 47 years               immortal_redis', 'normal');
    } else if (subcommand === 'compose') {
      terminal.output.print('Starting 47 services...', 'system');
      await new Promise(r => setTimeout(r, 800));
      terminal.output.error('Error: Port 3000 already in use');
      terminal.output.error('Error: Port 5432 already in use');
      terminal.output.error('Error: Port 6379 already in use');
      terminal.output.error('Error: All ports already in use');
      terminal.output.print("Have you tried 'docker-compose down' first?", 'system');
    } else {
      terminal.output.print("🐳 Docker: Containers for everyone!", 'system');
      terminal.output.print("", 'normal');
      terminal.output.print("Commands: run, ps, compose, pray", 'normal');
      terminal.output.print("(Results may vary)", 'system');
    }

    return { success: true };
  },
};

// format command
const format = {
  name: 'format',
  description: 'Format a disk',
  usage: 'format [drive]',

  async execute(args, terminal) {
    terminal.output.error("This isn't Windows. We don't do that here. 🐧");
    terminal.output.print("Try 'mkfs' if you really want to destroy something.", 'system');
    return { success: false };
  },
};

// Register all commands as fake (hidden from main help)
[ls, cd, pwd, cat, rm, sudo, vim, nano, exit, whoami, date, echo, man, touch, mkdir, grep, uptime, su, git, npm, make, curl, ping, history, sl, cowsay, docker, format]
  .forEach(cmd => {
    cmd.fake = true;
    commandRegistry.register(cmd);
  });
