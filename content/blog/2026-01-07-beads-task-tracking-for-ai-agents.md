---
title: Beads - External Memory for AI Agents
date: 2026-01-07
tags: [ai, claude-code, beads, task-tracking, development]
---

# Beads: External Memory for AI Agents

I just discovered [Beads](https://github.com/steveyegge/beads), and this is the biggest infrastructure breakthrough I've seen for AI-driven development since I started working this way.

Not a new model. Not a new IDE. A task tracker. But one that fundamentally changes how agents work on long-horizon tasks.

## The Real Problem

Markdown TODOs don't work for agents. They work fine for humans who can hold context across sessions and manually track dependencies. But agents?

Agents have context limits. No persistent memory. They work best with structured data and explicit semantics.

You're 200 messages into a session. The agent completed half your plan. You ask "what's next?" and it either:

1. Hopes the markdown TODO is still in context
2. Asks you to re-read it
3. Guesses

Then you hit the context window limit. Or switch branches. Or close the session and come back tomorrow. The plan fragments. Early tasks get forgotten. Dependencies exist only as prose notes like "TODO: fix auth (blocked on bd-3)" which means the agent can't query for ready work - it has to read and interpret text.

This is write-only memory. Completely backwards for how agents actually operate.

## What Beads Actually Is

Beads is a git-backed issue tracker that acts like a managed central database but writes everything to git as JSONL. You get both: queries **and** versioning.

It's external memory for agents with dependency tracking and query capabilities.

The architecture is simple:

- Issues stored in `.beads/` directory as JSONL files
- SQLite for local caching and queries
- Background daemon for sync
- Hash-based IDs that prevent collisions
- JSON output everywhere

But the genius is in the semantics. Dependencies are first-class. You don't write "blocked by X" in prose - you create explicit relationships. Discovery during execution maps directly to how agents work: when implementing a feature and finding a bug, you create an issue and link it with `discovered-from`. The dependency graph becomes a map of how work actually unfolded, not a flat list.

## It Just Works

Beads has an incredibly small footprint. It's a drop-in upgrade that requires almost zero explanation to agents.

I tell Claude Code:

> "We track work in Beads instead of Markdown. Run bd quickstart to see how."

That's it. No configuration files. No schema definitions. No long system prompts explaining the workflow.

The agent immediately understands. It starts running `bd ready --json` to find unblocked work. It creates issues with `bd create`. It updates status, links dependencies, manages hierarchical epics. All without me explaining the commands.

Why? Because Beads was designed for how agents actually think:

**Queryable, not interpretable**
Instead of scanning markdown and mentally parsing text, the agent runs `bd ready --json` and gets a definitive list of unblocked work. The cognitive load difference is massive. It's not interpreting - it's querying structured data.

**Session persistence without re-prompting**
Between conversations, work doesn't vanish into context-window limbo. The agent doesn't need me to copy-paste the TODO list. It runs `bd ready --json` and is immediately back in context.

**Multi-agent coordination that actually works**
With markdown, two agents on the same project means conflicting TODO lists and duplicated work. With Beads, both query the same logical database (via git), see what's claimed (`status: in_progress`), and work on different ready issues. The `--assignee` filter makes this trivial.

**Naturally distributed**
Worker agents on multiple machines can share the same beads database backed by git. Any merge conflicts - including those from workers on different branches creating issues with colliding IDs - are transparently solved by the AI doing intelligent collision resolution.

**Audit trail the agent can trust**
When an issue is updated, the event is logged with timestamp and actor. The agent can see history. With markdown, you'd need to parse git blame, and even then you only see line-level changes, not semantic "status changed from open to in_progress."

## A Real Example

Steve Yegge (Beads' creator) shared a story that captures how well this works:

He dropped Beads onto an old dev box, installed Sourcegraph Amp, and asked it to file beads issues for everything in his decade-old TODO list for Wyvern.

**Less than 30 seconds** for Amp to come up to speed and begin filing issues.

**30 minutes later**: 128 issues created. Six main epics. Five sub-epics. Complex interdependencies and parent/child relationships fully mapped.

After all issues were filed, he could ask the agent "what are the top priority ready work items?" and get an immediate, accurate answer.

This is the difference. You sling issues around like candy. Batch updates. Split them. Merge them. You always know what's open, what's blocked, what the priorities are.

**And so do your agents.**

For me, this changes everything about long-horizon tasks. I can give Claude work that spans days, multiple sessions, branch switches. It doesn't lose its place. It doesn't ask me to re-explain the context. It just runs `bd ready --json` and continues where it left off.

## Installation

Beads is available through multiple package managers:

```bash
# npm
npm install -g @beads/bd

# Homebrew
brew install steveyegge/beads/bd

# Go
go install github.com/steveyegge/beads/cmd/bd@latest
```

Works on Linux (glibc 2.32+), macOS, and Windows.

Once installed, initialize it in your project:

```bash
bd quickstart
```

The quickstart guide is interactive and shows you everything you need to know in under two minutes.

## Why This Matters

The bottleneck in AI-driven development isn't models anymore. It's infrastructure.

Specifically: how do AI agents maintain coherent, long-term plans without constant human intervention?

Markdown doesn't scale. GitHub Issues are designed for human workflows, not agent cognition. JIRA is enterprise bloat.

Beads solves a different problem entirely: **external working memory for agents**.

Think about what agents need:

1. **Structured data they can query** - not prose they have to interpret
2. **Persistence across context windows** - the plan survives session boundaries
3. **Dependency graphs** - explicit relationships, not implied by prose
4. **Multi-agent coordination** - multiple workers without conflicts
5. **Git integration** - version control for the plan itself

Beads delivers all of this with an incredibly lightweight implementation. The entire tool is small enough that agents can learn it from `bd --help` and the quickstart guide.

This is what missing infrastructure looks like when you find it. Not flashy. Not marketed. Just solving a real problem that's been blocking serious work.

## My Take

Beads is the kind of tool that changes how you work. Not because it's flashy, but because it removes friction you didn't realize was there.

If you're using Claude Code, Cursor, or any AI coding assistant for non-trivial projects, you need task persistence. Markdown doesn't cut it. Beads does.

Try it. Run `bd quickstart`. See how an agent behaves when it actually has memory.

You won't go back.
