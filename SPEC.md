# straus.it - Terminal Website Specification

## Overview

A personal website that simulates a Mac terminal window running a fake "Claude Code" CLI interface. Users interact via typed commands or clickable suggestions to navigate between profile and blog content.

## Technical Requirements

| Requirement | Solution |
|-------------|----------|
| Hosting | GitHub Pages (static files only) |
| JavaScript | Vanilla ES6 modules, no frameworks |
| Blog | Static markdown files, client-side parsing |
| Markdown Parser | marked.js (28KB minified) |
| Routing | Hash-based (`#read/article-slug`) |

## Visual Design

### Mac Window Chrome
- Realistic window frame with rounded corners (10px radius)
- Traffic lights (close, minimize, expand) - decorative only
- Title bar showing "claude-code — stefano@straus.it"
- Drop shadow for depth

### Terminal Theme
```css
--term-bg: #0d1117       /* Dark background */
--term-text: #c9d1d9     /* Light gray text */
--term-prompt: #58a6ff   /* Blue prompt */
--term-command: #f0f6fc  /* White commands */
--term-success: #3fb950  /* Green success */
--term-error: #f85149    /* Red errors */
--term-link: #79c0ff     /* Cyan links */
```

### Typography
- Font: JetBrains Mono (fallback: Fira Code, Consolas, monospace)
- Size: 14px base
- Line height: 1.6

## Startup Sequence

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗████████╗██████╗  █████╗ ██╗   ██╗███████╗          ║
║   ██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██║   ██║██╔════╝          ║
║   ███████╗   ██║   ██████╔╝███████║██║   ██║███████╗          ║
║   ╚════██║   ██║   ██╔══██╗██╔══██║██║   ██║╚════██║          ║
║   ███████║   ██║   ██║  ██║██║  ██║╚██████╔╝███████║          ║
║   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

> Initializing claude-code v1.0.0...
> Loading personality matrix... done
> Establishing neural pathways... done
> Ready.

Welcome! I'm Stefano's personal website running in terminal mode.
Type 'help' for available commands or click a suggestion below.

[about]  [blog]  [skills]  [contact]

> _
```

## Commands

| Command | Description | Output |
|---------|-------------|--------|
| `help` | List all commands | Command list with descriptions |
| `about` | Personal profile | Renders profile.md |
| `blog` | List blog articles | Article list from index.json |
| `read <slug>` | Read article | Renders article markdown |
| `skills` | Tech stack | List of technologies |
| `contact` | Contact info | GitHub, LinkedIn, Email links |
| `clear` | Clear terminal | Clears output, shows prompt |

## File Structure

```
straus.it/
├── index.html                 # Single page entry
├── SPEC.md                    # This file
├── .nojekyll                  # Disable Jekyll
│
├── css/
│   ├── main.css               # Import aggregator
│   ├── variables.css          # CSS custom properties
│   ├── reset.css              # CSS reset
│   ├── window-chrome.css      # Mac window styling
│   ├── terminal.css           # Terminal body
│   ├── cursor.css             # Blinking cursor
│   ├── prompt.css             # Prompt and suggestions
│   ├── output.css             # Output and markdown
│   └── animations.css         # Typing effects
│
├── js/
│   ├── main.js                # Entry point
│   ├── config.js              # Configuration
│   ├── core/
│   │   ├── Terminal.js        # Main controller
│   │   ├── CommandProcessor.js
│   │   ├── OutputRenderer.js
│   │   └── InputHandler.js
│   ├── effects/
│   │   ├── TypeWriter.js      # Typing animation
│   │   ├── InitSequence.js    # Startup sequence
│   │   └── CursorManager.js
│   ├── commands/
│   │   ├── CommandRegistry.js
│   │   ├── help.js
│   │   ├── about.js
│   │   ├── blog.js
│   │   ├── read.js
│   │   ├── contact.js
│   │   ├── skills.js
│   │   └── clear.js
│   ├── content/
│   │   ├── ContentLoader.js
│   │   ├── MarkdownParser.js
│   │   └── ArticleIndex.js
│   ├── router/
│   │   └── HashRouter.js
│   └── utils/
│       ├── dom.js
│       ├── delay.js
│       └── sanitize.js
│
├── content/
│   ├── profile.md
│   ├── contact.md
│   └── blog/
│       ├── index.json         # Article manifest
│       └── *.md               # Blog articles
│
├── vendor/
│   └── marked.min.js
│
└── assets/
    └── fonts/
        └── jetbrains-mono/
```

## Blog Index Format

```json
{
  "articles": [
    {
      "slug": "welcome-to-my-terminal",
      "title": "Welcome to My Terminal",
      "date": "2024-01-15",
      "description": "An introduction to this unusual website",
      "tags": ["meta", "personal"],
      "file": "2024-01-15-welcome-to-my-terminal.md"
    }
  ]
}
```

## Data Flow

```
User Input → InputHandler → CommandProcessor → Command Handler
                                                      ↓
                                              ContentLoader (if needed)
                                                      ↓
                                              MarkdownParser (if needed)
                                                      ↓
                                              OutputRenderer → Terminal Display
                                                      ↓
                                              HashRouter (update URL)
```

## Interactive Elements

### Clickable Suggestions
- Rendered as styled chips/buttons
- Execute corresponding command on click
- Appear after command output
- Context-aware (different commands show different suggestions)

### Keyboard Navigation
- Enter: Execute command
- Up/Down arrows: Navigate command history
- Tab: (future) Auto-complete commands

### Hidden Input
- Invisible text input captures keystrokes
- Input text displayed inline with prompt
- Blinking cursor shows input position

## Responsive Design

### Desktop (> 768px)
- Terminal window: max-width 900px, 80vh height
- Full typing animations
- All commands available

### Mobile (< 768px)
- Full-width terminal
- Reduced padding
- Suggestions are primary navigation
- Virtual keyboard support

## Performance Considerations

- No external dependencies except marked.js
- Content cached after first load
- Minimal DOM manipulation
- CSS animations (GPU accelerated)
- Lazy load blog articles

## Accessibility

- Semantic HTML structure
- Keyboard navigable
- Focus management
- ARIA labels where appropriate
- Sufficient color contrast
