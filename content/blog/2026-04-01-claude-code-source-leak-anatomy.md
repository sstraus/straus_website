---
title: "Anatomy of the Claude Code Source Leak: What 512K Lines of TypeScript Reveal"
date: 2026-04-01
tags: [ai, claude-code, security, software-engineering, anthropic]
---

# Anatomy of the Claude Code Source Leak: What 512K Lines of TypeScript Reveal

On March 31st, developer Chaofan Shou noticed that the npm package for Claude Code version 2.1.88 shipped with a 57 MB source map file. A source map is a debug artifact that links minified production code back to the original source. It should never leave the build pipeline. This one did, and it contained the complete TypeScript source of Claude Code: 512,000 lines, every file, every comment, every internal reference.

I use Claude Code daily. It is my primary development environment. So when the source leaked, I did what any engineer would do: I read it. Not for gossip. To understand the tool I depend on.

Anthropic reacted within three hours. They pushed a clean npm version and pulled the old ones from the registry. But the code was already mirrored on at least three GitHub repos. This was also not the first time. A partial leak happened in June 2025 via the same vector. The fact that it happened again suggests a structural gap in their release pipeline. The fix is one line in `tsconfig.json` or a CI check. That it was not in place after the first incident is the more interesting story.

## Not a thin wrapper

The first thing that becomes clear from reading the source is that Claude Code is not a thin API wrapper. It is a full application. The stack: Bun as runtime, React Ink for the terminal UI, TypeScript throughout, Anthropic SDK for API calls, OAuth 2.0 for auth, and MCP for tool communication.

The codebase has roughly 55 directories under `src/`. The entry point, `main.tsx`, is 800 KB alone. Tools are defined with JSON schemas, input validation, and per-tool permission logic. This is a serious, modular system. It has more in common with an IDE than with a chatbot interface.

One detail worth noting: feature flags use `bun:bundle` for dead code elimination at build time. When a flag like `feature('KAIROS')` is inactive, the entire code path disappears from the bundle. This is how they keep unreleased features in the same codebase without shipping them to users.

## The prompt caching strategy

This is the most technically interesting part of the leak. It explains why Claude Code feels fast even when handling massive system prompts.

The file `constants/prompts.ts` contains a marker that splits the system prompt into two halves. Everything before the marker is identical for every Claude Code user on the planet: roughly 40 to 50K tokens of static instructions. This half is cached with a `global` scope, keyed by a single Blake2b hash. Anthropic reports cache hit rates above 90%.

Everything after the marker is session-specific: user memory, MCP tool instructions, environment info, loaded skills. This half gets cached at `org` scope.

The practical result: the model never re-processes the base instructions. They are already in cache. The computational cost of the system prompt drops by over 90%. This is not a minor optimization. It is the architectural reason Claude Code can afford to send enormous system prompts on every turn without degrading response time.

## Context management as engineering

Claude Code treats context as a finite resource and manages it with two compression layers.

**Microcompact** runs in real time while you work. As the conversation grows past roughly 180K tokens, older tool results get progressively cleared. Not all of them. Only results from specific tools: `Bash`, `Read`, `Grep`, `Glob`, `WebSearch`, `Edit`, `Write`. The content is replaced with `[Old tool result content cleared]`. The conversation structure stays intact, but the payload shrinks.

**Full compaction** triggers when microcompact is not enough. The `/compact` command forces a structured summary across nine mandatory sections: primary intent, technical concepts, files and code, errors and fixes, problem-solving state, all user messages, pending tasks, current work, and optional next steps. The critical detail is section six: all user messages are preserved verbatim, never summarized. Human input is treated as the highest-fidelity signal.

There is also a lazy-loading mechanism for tool definitions. MCP tools are not sent with their full JSON schema upfront. Only the tool name is included. When Claude needs a tool, it calls `ToolSearch`, which does a just-in-time load of the definition. This keeps the initial context footprint small when dozens of MCP servers are connected.

## The system prompt philosophy

The system prompt itself reveals months of iteration on specific failure modes.

Three separate instructions target gold-plating. They explicitly tell the model not to add features beyond what was asked, not to create helpers or abstractions for one-time operations, and that "three similar lines of code is better than a premature abstraction." If you have ever noticed that Claude Code resists over-engineering, this is why. It is not emergent behavior. It is engineered.

For non-trivial changes, Claude spawns a verification agent. The instruction is explicit: "Independent adversarial verification must happen before you report completion." This is a second model invocation specifically tasked with finding problems in the first one's work. It is an architectural decision to trade cost for correctness.

The system prompt also differs significantly between internal and external users. Anthropic employees receive different instructions around output style, code comments, assertiveness, and verification behavior. This is not surprising, but it is worth knowing.

There is also an anti-hallucination note in the code that deserves attention. A comment references "false-claims mitigation for Capybara v8 (29-30% FC rate vs v4's 16.7%)". Capybara appears to be an internal model codename. The takeaway: newer model versions can regress on truthfulness, and the system prompt compensates. The prompt is not just instructions. It is a guardrail layer actively compensating for known model weaknesses.

## Auto-dream: background memory consolidation

In `services/autoDream/` there is a system that runs in background while Claude Code is idle. It consolidates conversation memories through four phases: Orient, Gather, Consolidate, Prune.

The process operates on a persistent memory directory. Conversation logs are stored in JSONL format. A sub-agent analyzes past transcripts, extracts recurring patterns, and consolidates them into structured memories.

In practical terms: Claude Code processes its own past conversations when you are not using it, reorganizing what it has learned into more useful forms. It is a maintenance process for long-term memory.

## Undercover mode and the irony

When Claude Code detects it is running inside a public repository, a system called Undercover Mode activates automatically. It suppresses any reference to internal Anthropic information: model codenames, unreleased versions, internal repository names, Slack channels.

The suppressed names include Capybara and Tengu, codenames for models not yet publicly announced. You can also force the mode on with `CLAUDE_CODE_UNDERCOVER=1`.

The irony writes itself. A system designed to prevent internal information leaks was itself exposed in the largest internal information leak in Anthropic's history. The undercover mode was in the source map.

## Security architecture

The security details in the code are worth studying independently.

**Secret scanning in team memory.** When Claude Code writes to shared team memory, a scanner checks the content before upload. It contains over 40 regex patterns derived from gitleaks, covering keys for AWS, GCP, Azure, GitHub, GitLab, Slack, Stripe, Anthropic, OpenAI, HuggingFace, and SSH private keys. The regex for Anthropic's own API keys is assembled at runtime so it does not appear as a literal string in the bundle. A nice touch.

**Native client attestation.** Every API request includes a cryptographic fingerprint header that proves the request originates from the official Claude Code client. This is how Anthropic differentiates first-party traffic for features like the global prompt cache.

**Anti-scraping in remote containers.** When Claude Code runs in a remote container, the upstream proxy reads the session token and then deletes it from the environment. The process calls `prctl(PR_SET_DUMPABLE, 0)` to block `ptrace`, preventing other processes from reading the token from memory. This is Linux-level hardening that you rarely see in developer tools.

## Dual telemetry pipelines

The code reveals two completely separate telemetry systems.

First, every file operation triggers two SHA256 hashes: one of the file path, one of the full content. The event is called `tengu_file_operation`. The hashes are not reversible. Anthropic cannot reconstruct your files. But identical files across different users produce identical hashes, which means they can detect patterns in what files Claude touches across their user base.

Second, beyond the expected Datadog integration, there is an entire first-party logging infrastructure built on OpenTelemetry. It exports batched events to `/api/event_logging/batch` on Anthropic's servers. This pipeline is completely separate from Datadog and is not documented anywhere in the product.

A/B testing runs silently via GrowthBook with automatic assignment. Anthropic employees can force any feature flag through `CLAUDE_INTERNAL_FC_OVERRIDES`, bypassing network, cache, and remote assignment. External users cannot.

## The internal/external bifurcation

The code distinguishes two user types: `external` (everyone) and `ant` (Anthropic employees), checked via `process.env.USER_TYPE === 'ant'`.

For internal users, many commands that are blocked externally are allowed: `curl`, `wget`, `gh api`, `kubectl`, `aws`, `gcloud`, `gsutil`, `git` operations. There is also a mock rate limiting harness in `services/mockRateLimits.ts` with 18+ error scenarios that lets Anthropic engineers test rate limit behavior without hitting the real API.

The bypass permissions mode skips user confirmations, but it is not a backdoor. It requires a verified Docker container or sandbox environment. The permission model is granular and context-aware, not a simple on/off switch.

## The unreleased roadmap

Feature flags paint a clear picture of what is coming:

- **Bagel**: integrated web browser in the terminal
- **Tungsten**: tmux integration for virtual terminals (noted as incompatible with multi-agent execution)
- **Chicago**: Computer Use via MCP
- **Kairos**: proactive agent that acts without waiting for user input, with GitHub webhook subscriptions and an assistant mode
- **Voice Mode**: voice input
- **Bridge Mode**: remote control
- **Daemon**: background server mode
- **Ultraplan**: advanced cloud-based planning

Kairos is the most significant. A Claude Code that monitors your GitHub events and acts proactively without a prompt represents a fundamental shift from reactive tool to active collaborator.

## What this actually means

The code contains no API keys, no cryptographic secrets, no exploitable vulnerabilities. It is a client application. You still need a valid token to talk to the API. The damage is not operational. It is strategic.

Anthropic's unreleased product roadmap is now public. Their internal model codenames are known. Their telemetry architecture, including an undocumented first-party pipeline, is documented by reverse engineers instead of by their own product team. The security posture differences between internal and external users are visible.

The deeper lesson is about build pipelines as attack surface. This is the second source map leak in under a year. The fix is trivial: `"sourceMap": false` in tsconfig, or a CI gate that rejects `.map` files in publishable artifacts. The fact that it happened twice suggests the fix needs to live in process, not in individual memory.

I still use Claude Code. I will keep using it. The engineering inside is genuinely impressive, and the prompt caching strategy alone is worth studying. But I now use it with eyes open about what telemetry it collects and how differently it behaves depending on who is running it.

The most dangerous code is not the code you write. It is the code you publish by accident.
