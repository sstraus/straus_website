---
title: Beads - External Memory for AI Agents
date: 2026-01-07
tags: [ai, claude-code, beads, task-tracking, development]
---

# Beads: External Memory for AI Agents

I found [Beads](https://github.com/steveyegge/beads) last week, and it solved a problem I didn't know how to fix.

It's not a new AI model. Not a new IDE. It's a task tracker. But it completely changes how AI agents handle long projects.

## The Problem I Had

Markdown TODO lists don't work with AI agents. They work fine for me. I can remember context between sessions, track dependencies in my head. But agents can't.

Here's what kept happening: I'd be 200 messages deep in a session. The agent had finished half my plan. I'd ask "what's next?" and it would either:

1. Hope the markdown TODO was still in its context window
2. Ask me to paste it again
3. Guess

Then I'd hit the context limit. Or switch git branches. Or close my laptop and come back tomorrow. The plan would fall apart. Early tasks would be forgotten. Dependencies were just text notes like "TODO: fix auth (blocked on bd-3)". The agent couldn't actually query what was ready to work on.

This drove me crazy. I was using markdown as write-only memory. The agent could write tasks down but couldn't effectively read them back. Completely backwards.

## What Beads Actually Is

Beads is an issue tracker that lives in git. It acts like a database but stores everything as files in your repo. So you get both: the ability to query tasks **and** full version control.

Think of it as external memory for AI agents. Memory they can actually search.

Here's how it works:

- Tasks stored in `.beads/` directory as JSON files
- SQLite cache for fast queries
- Background sync daemon
- IDs that never collide across branches
- Everything outputs JSON

But here's the clever part: dependencies are real relationships, not text. You don't write "blocked by X" in a comment. You create an actual link between tasks. When you find a bug while building a feature, you create an issue and link it with `discovered-from`. The dependency graph shows how work actually unfolded, not just a flat list.

## How I Use It

The setup is simple. I tell Claude Code:

> "We track work in Beads instead of Markdown. Run bd quickstart to see how."

That's it. No config files. No long explanations. No system prompts.

Claude figures it out immediately. It starts running `bd ready --json` to find what's not blocked. Creates tasks with `bd create`. Updates status. Links dependencies. All without me explaining the commands.

Why does this work so well? Because Beads was built for how agents actually think.

**Agents can query, not just read**
Instead of reading markdown and trying to parse text, Claude runs `bd ready --json` and gets a clear list. The difference is huge. It's querying real data, not interpreting text.

**Sessions don't lose context**
When I close my laptop and come back tomorrow, the work is still there. Claude doesn't need me to paste the TODO list again. It just runs `bd ready --json` and picks up where it left off.

**Multiple agents don't conflict**
With markdown, two agents would fight over the same TODO list and duplicate work. With Beads, both query the same database (through git), see what's in progress, and pick different tasks. Simple.

**It works across machines**
I can have agents on different computers sharing the same task database through git. Even if they create tasks on different branches with the same ID, git handles the merge. No collisions.

**Full history**
When a task updates, it's logged with a timestamp and who did it. Claude can see the history. With markdown, you'd need to check git blame, and even then you only see line changes, not "status changed from open to in_progress."

## A Real Example

Steve Yegge built Beads. He shared a story that shows how well this works:

He installed Beads on an old computer. Installed Sourcegraph Amp. Asked it to file issues for his decade-old TODO list for a project called Wyvern.

**30 seconds**: Amp understood the system and started filing issues.

**30 minutes later**: 128 issues created. Six main categories. Five sub-categories. All the dependencies mapped out.

Then he could ask "what are the top priority tasks I can work on right now?" and get an instant, correct answer.

That's the difference. You can create issues fast. Update them in batches. Split them. Merge them. You always know what's open, what's blocked, what matters most.

**And your agents know too.**

For me, this changes how I work on long projects. I can give Claude Code work that takes days, across multiple sessions, across git branches. It doesn't lose track. It doesn't ask me to explain again. It just runs `bd ready --json` and continues.

## How to Install It

You can install Beads through npm, Homebrew, or Go:

```bash
# npm
npm install -g @beads/bd

# Homebrew
brew install steveyegge/beads/bd

# Go
go install github.com/steveyegge/beads/cmd/bd@latest
```

Works on Linux, macOS, and Windows.

Then run this in your project:

```bash
bd quickstart
```

The quickstart is interactive. Takes about two minutes to learn everything.

## Why This Matters

The problem with AI development isn't the models anymore. It's the infrastructure around them.

Specifically: how do agents keep track of long-term plans without you constantly reminding them?

Markdown doesn't scale. GitHub Issues are built for humans, not agents. JIRA is too heavy.

Beads solves something different: **external working memory for agents**.

Here's what agents actually need:

1. **Data they can query** - not text they have to read and understand
2. **Memory across sessions** - the plan survives when you close your laptop
3. **Real dependency graphs** - not dependencies written in comments
4. **Multi-agent coordination** - several agents working without stepping on each other
5. **Git integration** - version control for the tasks themselves

Beads does all of this. And it's small enough that agents learn it just from reading `bd --help`.

This is what good infrastructure looks like. Not flashy. Not marketed. Just solving a real problem that was blocking real work.

## What I Think

Beads changed how I work with AI. Not because it's exciting, but because it removed friction I didn't know I had.

If you're using Claude Code, Cursor, or any AI assistant for real projects, you need task persistence. Markdown doesn't work. Beads does.

Try it. Run `bd quickstart`. Watch how Claude behaves when it has actual memory.

You won't go back.
