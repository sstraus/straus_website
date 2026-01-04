# straus.it - Personal Terminal Website

## Project Overview

Personal portfolio website simulating a Mac terminal running "straus-code" CLI. Built with vanilla JavaScript and ES6 modules.

## Deployment

```bash
make deploy
```

Deploys to: `stefano@100.86.23.27:/volume1/web/me`

**Note:** The `apps` folder on the remote server is preserved during deployment.

### How it works:
1. Removes all files/folders on remote except `apps`
2. Tars local deploy files and extracts on remote via SSH pipe
3. Fast, no rsync needed

### Files deployed:
- `index.html`, `favicon.svg`
- `css/`, `js/`, `content/`, `img/`, `vendor/`, `assets/`

## Local Development

Serve locally with any static server:
```bash
python -m http.server 7080
# or
npx serve -p 7080
```

## Project Structure

```
├── content/           # Markdown content
│   ├── profile.md     # About page
│   ├── contact.md     # Contact info
│   └── blog/          # Blog posts
├── css/               # Stylesheets
├── js/
│   ├── commands/      # Terminal commands
│   ├── core/          # Core terminal logic
│   ├── effects/       # Visual effects (init sequence, window controls)
│   └── content/       # Content loading/parsing
├── img/               # Images (profile.jpg for ASCII hover)
└── vendor/            # Third-party libs (marked.js)
```

## Key Features

- Mac terminal window simulation with traffic light buttons
- ASCII art portrait with hover-to-image effect
- Markdown-based content
- Fake zsh commands for fun (`help fake` to see them)
- Mobile responsive (auto-fullscreen)
- Email obfuscation using full-width Unicode

## Commands

Real commands: `help`, `about`, `blog`, `read`, `skills`, `contact`, `clear`

Fake commands (fun): `ls`, `cd`, `cat`, `rm`, `sudo`, `vim`, `exit`, etc. (run `help fake`)
