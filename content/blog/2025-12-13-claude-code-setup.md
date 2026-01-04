---
title: My Claude Code Setup
date: 2025-12-13
tags: [ai, claude-code, setup, development]
---

# My Claude Code Setup

A complete walkthrough of how I configure Claude Code for maximum productivity.

## What is Claude Code?

Claude Code is Anthropic's official CLI tool that brings Claude directly into your terminal. It's not just a chatbot—it can read files, execute commands, edit code, and integrate with external tools via MCP (Model Context Protocol).

## Installation

```bash
npm install -g @anthropic-ai/claude-code
```

Or if you prefer:

```bash
brew install claude-code
```

## Configuration Files

Claude Code uses several configuration files in `~/.claude/`:

### settings.json

This is the main configuration file. Here's what matters:

```json
{
  "model": "opus",
  "alwaysThinkingEnabled": true,
  "max_turns": 100,
  "includeCoAuthoredBy": false 
}
```

Key settings:

- **model**: I use `opus` for complex tasks (expensive but reliable), `sonnet` for everyday work
- **alwaysThinkingEnabled**: Without thinking even Opus is weak
- **max_turns**: How many back-and-forth turns before stopping
- **includeCoAuthoredBy**: Avoid having "Co-authored-by" add to git commits

### Permissions

Claude Code has a robust permission system. I prefer a permissive setup with explicit allows:

```json
{
  "permissions": {
    "allow": [
      "*",
      "Bash(go build:*)",
      "Bash(go test:*)",
      "Bash(git commit:*)",
      "Bash(make:*)"
    ],
    "defaultMode": "default"
  }
}
```

The `*` allows most operations, but you can be more restrictive.

Usually i run Claude with 
```bash
claude --dangerously-skip-permissions  --resume --chrome
```

I know, it's dangerous, but I commit continiously and have good backup startegies.
This will speed up your work by 10x.

### CLAUDE.md

This file lives in `~/.claude/CLAUDE.md` (global) or in your project root (project-specific). It's your way to give Claude persistent instructions.

My global CLAUDE.md:

```markdown
# Style
Apply KISS, YAGNI, DRY and SOLID coding principles.
Always respond in English.

# Rules
- Do not duplicate logic
- Do NOT stop until all tasks are complete
- Check your todo list after each step
- Never skip failing tests. Fix them!
```

## MCP Servers

MCP (Model Context Protocol) extends Claude's capabilities. I use three:

### mcp.json

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena-mcp-server"]
    },
    "chrome-devtools": {
      "type": "stdio",
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    },
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upai/mcp-server-context7"]
    }
  }
}
```

**What each does:**

- **Serena**: Code intelligence—symbol search, references, project navigation
- **Chrome DevTools**: Browser automation and debugging
- **Context7**: Up-to-date documentation lookup for any library

## Plugins

Claude Code has a plugin system. My enabled plugins:

| Plugin | Purpose |
|--------|---------|
| context7 | Documentation lookup |
| feature-dev | Guided feature development |
| frontend-design | UI/UX design assistance |
| ralph-wiggum | Automated iteration loops |
| claude-hud | Status line display |

Enable in settings:

```json
{
  "enabledPlugins": {
    "context7@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "claude-hud@claude-hud": true
  }
}
```

## Hooks

Hooks let you run commands before/after Claude actions. I use them for automatic git checkpoints:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "git-ai checkpoint claude --hook-input stdin"
          }
        ]
      }
    ]
  }
}
```

This creates automatic checkpoints whenever Claude edits files—easy rollback if something goes wrong.

## Status Line

The status line shows useful info while Claude works. I use claude-hud:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash -c 'node \"$(ls -td ~/.claude/plugins/cache/claude-hud/claude-hud/*/ | head -1)dist/index.js\"'"
  }
}
```

## Tips for Daily Use

1. **Start with `/prime`** - Use a custom command to analyze the project before starting work
2. **Use opus for complex tasks** - Worth the cost for architecture decisions
3. **Check the todo list** - Claude tracks its own progress, review it
4. **Leverage MCP** - Context7 for docs, Serena for code navigation
5. **Trust but verify** - Always review generated code before committing

## Project-Specific Config

Each project can have its own `.claude/CLAUDE.md` with specific instructions:

```markdown
# Project: MyApp

## Stack
- Go 1.22
- PostgreSQL 15
- React 18

## Commands
- `make test` - Run tests
- `make build` - Build binary

## Conventions
- Use hexagonal architecture
- All errors must be wrapped with context
```

## Conclusion

Claude Code is more than a coding assistant—it's a development environment that understands context, follows instructions, and integrates with your tools. The key is configuration: take time to set up your CLAUDE.md, permissions, and MCP servers.

The investment pays off exponentially.

---

*Questions about my setup? [Reach out on X](https://x.com/StefanoStraus).*
