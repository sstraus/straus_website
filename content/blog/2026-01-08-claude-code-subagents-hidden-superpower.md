# Claude Code Subagents: The Hidden Superpower You're Not Using

I discovered something by accident last week. I was reviewing a piece of code, and I asked Claude Code to check it. The review was good, but something felt incomplete. So I asked again. Same code, same question. But the second review found completely different issues.

That's when it clicked: **AI isn't deterministic**. Give it the same task twice, and you get two different answers. Most people see this as a problem. I saw an opportunity.

What if I could run two reviews at the same time? Not the same review twice, but two competing agents, each trying to find more issues than the other?

Turns out, Claude Code has exactly this feature built in: **subagents**. They're specialized AI workers that run independently with their own context, tools, and instructions. Most developers never use them beyond plan mode, where Claude automatically spawns an Explore agent to scan your codebase.

But here's what I learned: subagents aren't just helpers. They're parallel workers. And when you set them up to compete, they become way more thorough.

## The Competition Trick

The idea is simple: spawn two subagents and tell them they're competing against each other.

Here's the prompt I use:

```
Please deploy two subagents to thoroughly review {whatever to review}.
Inform them that they are competing against another agent.
Ensure they examine both the architecture and implementation carefully.
Let them know that whoever discovers more issues will be promoted.
```

What happens? Each agent takes a different path. One focuses on edge cases, the other on performance. One finds a race condition, the other spots missing validation. Then I get a combined summary with the best findings from both.

Why does this work? Because AI isn't deterministic. Give the same task to two separate agents, and they'll approach it differently. They'll notice different things. This variability is actually useful. I learned to exploit it.

This isn't just running two reviews in parallel. It's **adversarial collaboration**. They push each other to be more thorough.

## Why Pressure Works

Here's something I learned through experimentation: pressure makes AI work harder.

When I tell an agent it's competing, or that something important is at stake, the quality goes up. It becomes more thorough. More creative in finding problems.

I know how this sounds. The AI doesn't *actually* care about being promoted. But the framing changes how it thinks. It's like when you tell yourself you have a deadline tomorrow instead of next week. The urgency changes your approach.

These phrases work well:
- "You're competing against another agent"
- "This is critical for production deployment"
- "The other agent found X issues. Can you find more?"
- "Your thoroughness will be evaluated"

Call it a hack. Call it prompt engineering. I call it getting better results. Try it yourself and see what happens.

## How Subagents Actually Work

Let me explain what subagents are. They're separate AI instances that work independently from your main conversation. Each one gets:

- **Its own context window** – Your main chat stays clean while the subagent reads dozens of files
- **Custom instructions** – You can give each one specialized tasks
- **Limited tools** – You control what they can do (read-only, write files, run commands, etc.)
- **Independent work** – They do their job separately and give you a summary at the end

### Built-in Subagents

Claude Code comes with three subagents already configured:

| Agent | Purpose | When It Runs |
|-------|---------|-----------|
| **Explore** | Read-only codebase research | When you search or analyze code |
| **General-purpose** | Complex tasks with file edits | When you need multiple steps |
| **Plan** | Pre-planning research | Automatically in plan mode |

### Creating Your Own Subagents

You can create custom subagents. They're just Markdown files with some metadata at the top:

**Location:**
- Project-level: `.claude/agents/*.md`
- Global: `~/.claude/agents/*.md`

**Example: Go Code Reviewer**

```markdown
---
name: go-reviewer
description: Go code review specialist. Use for quality, security, and idiomatic Go patterns.
tools: Read, Grep, Glob, Bash
---

You are a senior Go developer specializing in code review.

When reviewing code:
- Check for proper error handling (no silent failures)
- Verify goroutine safety and channel usage
- Ensure interfaces are minimal and well-defined
- Look for non-idiomatic patterns
- Identify potential performance issues

Be thorough. Be critical. Miss nothing.
```

### How to Use Them

There are two ways to trigger your custom subagents:

1. **Automatic** – Claude reads the `description` and decides when to use it
2. **Explicit** – You ask for it directly: "Use the go-reviewer subagent to analyze this PR"

For competitive reviews, I always ask explicitly. That way I control exactly how many agents run and what they're told to do.

## Patterns I Use

Here are three ways I use competing subagents in my daily work:

### Pattern 1: Basic Dual Review

```
Spawn two subagents to review the authentication module.
Tell them they're competing. The one that finds more security
issues wins. Have them focus on different aspects: one on
logic flaws, one on edge cases.
```

This is my go-to pattern. Simple and effective.

### Pattern 2: Architecture vs Implementation

```
Deploy two competing subagents:
- Agent A: Review the high-level architecture and design decisions
- Agent B: Review the implementation details and code quality
Both should report issues. Compare and synthesize their findings.
```

I use this when adding major features. One agent thinks big picture, the other gets into the details.

### Pattern 3: Red Team / Blue Team

```
Launch two subagents in adversarial mode:
- Red agent: Try to find ways to break this code
- Blue agent: Verify the code handles all edge cases correctly
They're competing to prove each other wrong.
```

This one's my favorite for security-critical code. It's like having two paranoid developers working against each other.

## What I Learned

Here's what I discovered after a few weeks of experimenting:

1. **Most people don't use subagents** – They think it's only for plan mode
2. **Competition gets better results** – Two agents beat one every time
3. **Pressure works** – Frame tasks as important and watch quality improve
4. **AI isn't consistent** – That's a feature, not a bug. Different runs = different insights
5. **Custom agents save time** – Build your own for repetitive tasks

My workflow changed completely once I started using competing subagents. Instead of trusting a single review, I run two or three in parallel. The results speak for themselves.

Try it on your next code review. Set up two competing agents and see what they find. I bet you'll be surprised.

---

*The best code review is two paranoid agents trying to outdo each other.*
