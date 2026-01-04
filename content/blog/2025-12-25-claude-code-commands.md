---
title: Custom Slash Commands for Claude Code
date: 2025-12-25
tags: [ai, claude-code, productivity, automation]
---

# Custom Slash Commands for Claude Code

Slash commands are one of Claude Code's most powerful features. They let you define reusable prompts that execute with a single `/command`.

## Where Commands Live

Commands are markdown files in `~/.claude/commands/`. Each file becomes a slash command:

```
~/.claude/commands/
├── fix.md           → /fix
├── prime.md         → /prime
├── commit-and-push.md → /commit-and-push
├── code-review.md   → /code-review
├── coverage.md      → /coverage
├── ultrathink.md    → /ultrathink
└── build-planning.md → /build-planning
```

## My Command Collection

### /fix — Debug Loop

The simplest but most used command:

```markdown
READ the output from the terminal command to understand the error.
THEN FIX the error. Use context7 and brave-search MCPs to understand it.
THEN re-run the command. If there's another error, repeat.
```

**Usage**: Run a command, see an error, type `/fix`. Claude reads the terminal, understands the error, fixes it, and re-runs. Repeat until it works.

### /prime — Project Understanding

When starting a new session:

```markdown
## 1. Project Overview
- READ the README.md file
- RUN `git ls-files` to understand structure
- EXAMINE directory patterns

## 2. Core Documentation
- READ PLANNING.md for architecture
- READ TASKS.md for current status

## 3. Testing & Quality
- EXAMINE test files for patterns

## 4. Development Workflow
- CHECK CI/CD pipelines
- CHECK dev environment setup
```

**Usage**: Start every session with `/prime`. Claude builds a mental model of the project before doing anything.

### /commit-and-push — Smart Git Workflow

More than just `git commit`:

```markdown
ADD all modified and new files to git.
- Review the diff for problems and bugs
- Check if completed tasks in TASKS.md are actually done
- Check if tests are proper (not placeholders)
- Report if functionality was removed
- Raise concerns/recommendations
THEN commit with conventional commit notation.
THEN push to origin.
```

**Usage**: When you're ready to commit, `/commit-and-push` does a mini code review first.

### /code-review — Full Codebase Analysis

Comprehensive review with prioritized findings:

```markdown
Analyze the codebase for:
- 🔴 Critical: Security vulnerabilities, breaking bugs
- 🟠 High: Code quality issues, architectural problems
- 🟡 Medium: Minor bugs, missing tests
- 🟢 Low: Documentation, minor optimizations

Update TASKS.md with actionable items.
```

**Usage**: Run `/code-review` periodically or before major releases.

### /coverage — Test Gap Filler

```markdown
UNDERSTAND code coverage percentages for each function.
THEN add unit tests to functions without 100% coverage.
Include negative and edge cases.
ALWAYS use mocks for external functionality.
THEN re-run coverage and repeat as necessary.
```

**Usage**: After implementing a feature, `/coverage` fills in missing tests.

### /build-planning — Project Bootstrap

Creates structured documentation for new projects:

```markdown
Build PLANNING.md with:
- Project Overview
- Architecture (Core components, Data Model)
- API endpoints
- Technology stack
- Testing strategy
- Development commands
- Security considerations
- Future considerations

Build TASKS.md with categorized tasks.
```

**Usage**: Start new projects with `/build-planning` to establish structure.

### /ultrathink — Craftsman Mode

My favorite. Changes Claude's entire approach:

```markdown
**ultrathink** - We're not here to write code.
We're here to make a dent in the universe.

1. **Think Different** - Question every assumption
2. **Obsess Over Details** - Read the codebase like a masterpiece
3. **Plan Like Da Vinci** - Sketch architecture before coding
4. **Craft, Don't Code** - Every function name should sing
5. **Iterate Relentlessly** - First version is never good enough
6. **Simplify Ruthlessly** - Remove complexity without losing power
```

**Usage**: When you need exceptional quality, not just working code.

### /docs-consolidate — Documentation Cleanup

```markdown
Consolidates all markdown files into a clean docs folder.
- Identify meaningful documentation vs temporary notes
- Move relevant files to docs/ structure
- Remove redundant files and completed status updates
- Protect README.md and schema files
```

**Usage**: After a sprint, clean up scattered documentation.

## Creating Your Own Commands

### Basic Structure

```markdown
---
description: Short description shown in /help
---

Your prompt instructions here.
Use imperative verbs: READ, WRITE, ANALYZE, FIX.
Reference tools: context7, bash, git.
```

### Tips for Good Commands

1. **Be specific** - "READ the error" not "understand what happened"
2. **Chain actions** - "THEN" connects sequential steps
3. **Loop when needed** - "repeat this process" for iterative tasks
4. **Reference tools** - Mention MCPs and capabilities explicitly
5. **Set expectations** - Tell Claude what output you want

### Example: Custom Deploy Command

```markdown
---
description: Deploy to production with safety checks
---

1. RUN `make test` - all tests must pass
2. RUN `make build` - verify build succeeds
3. CHECK git status - no uncommitted changes
4. READ CHANGELOG.md - verify version bump
5. RUN `make deploy`
6. VERIFY deployment by checking health endpoint
7. Report success or rollback instructions
```

## Project-Specific Commands

Commands can also live in `.claude/commands/` within a project:

```
my-project/
└── .claude/
    └── commands/
        └── db-migrate.md    → /db-migrate (project only)
```

These override global commands and can reference project-specific tools.

## The Power of Commands

Commands transform Claude Code from a chatbot into a **workflow automation tool**. Instead of explaining what you want every time, you define it once and invoke it with a word.

The best commands encode your team's best practices. They ensure consistency, reduce errors, and let you focus on the actual problem instead of the process.

Start with `/fix` and `/prime`. Add more as patterns emerge.

---

*Share your favorite commands with me on [X](https://x.com/StefanoStraus).*
