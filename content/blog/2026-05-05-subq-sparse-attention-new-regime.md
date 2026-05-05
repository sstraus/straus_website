---
title: "SubQ and the End of Quadratic Attention: Breakthrough or Familiar Promise?"
date: 2026-05-05
tags: [ai, architecture, attention, infrastructure, model-design]
---

# SubQ and the End of Quadratic Attention: Breakthrough or Familiar Promise?

I have been waiting for this one. Not for SubQ specifically, but for the moment someone would credibly claim they cracked the quadratic attention problem at frontier scale. Today a startup called Subquadratic launched with $29M in seed funding and a model that, if the claims hold, changes the cost structure of everything we build on top of LLMs.

The pitch is straightforward. Current transformer models spend most of their compute on relationships between tokens that do not matter. Every token attends to every other token. Double the context, quadruple the cost. This is the reason frontier models cap out around one or two million tokens even when they claim more. It is elegant math that scales terribly.

SubQ replaces this with what they call Sparse Sub-Quadratic Attention. Instead of evaluating all pairwise interactions, it selects the subset that carries signal and skips the rest. Not an approximation of dense attention. A different execution model where compute grows linearly with context length.

## The numbers they are claiming

The headline benchmarks are aggressive. On RULER 128K, SubQ scores 95% accuracy at a reported cost of $8, compared to 94.8% accuracy and roughly $2,600 for Claude Opus. Their sparse attention mechanism is 52x faster than FlashAttention at one million tokens with 63% less compute. At 12 million tokens, the research model claims nearly 1,000x reduction in attention compute.

On SWE-Bench Verified they report 81.8, slightly ahead of Opus 4.6 at 80.8 and DeepSeek 4.0 Pro at 80.0. On MRCR v2, the retrieval and reasoning benchmark, their research result hits 83 versus GPT 5.5 at 74 and Claude Opus 4.7 at 32.2. The production model, third-party verified, sits at 65.9.

These numbers would be remarkable from an established lab. From a seed-stage startup, they demand scrutiny.

## Why this is architecturally different

I have written before about efficiency gains in AI infrastructure. TurboQuant, DeepSeek's MLA, various quantization breakthroughs. Those are optimizations within the existing paradigm. They make the same computation cheaper.

SubQ claims something different. Not the same computation done faster, but less computation needed in the first place. If most token-to-token interactions are irrelevant, then dense attention is overcomputing by design. The question shifts from "how big can the model get" to "how much work is actually needed."

This matters because of what it implies for system design. Right now, we build entire engineering stacks around the scarcity of context. We chunk documents. We build retrieval pipelines. We prune aggressively. We maintain elaborate indexing systems to compensate for the fact that models cannot see enough at once. Not because these approaches are optimal, but because attention makes full-context processing too expensive.

If a model can genuinely operate on millions of tokens without quadratic explosion, most of that infrastructure becomes unnecessary overhead. Instead of partial views and clever retrieval, you feed the full corpus. Instead of short-lived sessions with context management, you maintain continuity. Instead of optimizing prompts for compression, you optimize for completeness.

Their SubQ Code product leans into this directly. A CLI coding agent that loads entire codebases into a single context window. No chunking, no multi-agent coordination, no retrieval layer. One call, full repository. If it works as described, it eliminates an entire category of engineering complexity that we have spent the last two years building.

## The skepticism is well-earned

Here is where I have to be honest about the history. We have been here before.

Mamba promised linear complexity. It delivers it mathematically, but underperforms quadratic attention at frontier scale. RWKV followed the same trajectory. Kimi Linear achieves linear attention on 75% of its layers but still needs quadratic Multi-Latent Attention on the remaining 25% because, as their own paper states, "pure Linear Attention still struggles with precise memory retrieval and exact copying." DeepSeek Sparse Attention's lightning indexer component is itself quadratic, making the overall system quadratic despite the marketing.

A thorough LessWrong analysis from January concluded that every subquadratic attention mechanism that works in practice either remains quadratic in implementation, improving efficiency by only a constant factor, or underperforms on downstream benchmarks at frontier scale. The author's summary is blunt: these are "incremental improvements to the transformer architecture," not paradigm shifts.

SubQ claims to break this pattern. Fully subquadratic from first principles, no hybrid fallback to quadratic layers, frontier-competitive benchmarks. If true, they have solved a problem that Google, Meta, and every major lab has been working on for years. With $29M and a team of eleven researchers.

That is either extraordinary or implausible. Possibly both.

## The real test

The technical risk is specific and well understood. Sparse selection must be stable. If the model decides a token relationship is unimportant and skips it, but that relationship was actually critical for reasoning, the output degrades silently. Dense attention is wasteful but robust. It never misses a dependency because it computes all of them. Sparse attention is efficient but fragile. The failure mode is not slowness. It is subtle errors in reasoning that do not show up on standard benchmarks but surface in production under adversarial or unusual inputs.

This is why benchmarks alone cannot validate the architecture. RULER, SWE-Bench, MRCR. These measure average-case performance on known distributions. The question that matters is edge-case stability. What happens at 3 AM when the model encounters a dependency pattern that the sparse selector did not anticipate? Dense attention would compute it anyway. Sparse attention might not.

The team behind SubQ is credible. PhDs from Meta, Google, Oxford, Cambridge, ByteDance. Alex Whedon, the CTO, led generative AI at TribeAI with over 40 enterprise implementations. Justin Dangel, the CEO, is a five-time founder. The investors include early backers of Anthropic and OpenAI. This is not a weekend project.

But credibility and correctness are different things. The model is not yet publicly available. Independent benchmarks have not been run. The production version scores significantly below the research version on MRCR (65.9 versus 83), which suggests the gap between lab results and deployed performance is real and meaningful.

## What changes if it works

If SubQ's architecture holds up under independent evaluation, the implications are not incremental.

Cost curves flatten. At 5% of Opus pricing with comparable quality, the economics of LLM-powered systems change for every company running inference at scale. Context stops being something to manage and becomes something to use directly. The entire retrieval-augmented generation stack, which consumes significant engineering effort across the industry, becomes an optimization for a constraint that no longer exists.

More importantly, it introduces a new scaling axis. So far, progress has been driven by more parameters and more data. SubQ suggests a third direction: reducing the amount of useless work the model does. If that scales, the competition shifts from "who has the most GPUs" to "who wastes the least compute." That is a very different game, and one where incumbents do not necessarily have the advantage.

## Waiting with informed skepticism

I am not going to pretend I know whether SubQ delivers what it promises. The claims are extraordinary. The history of subquadratic attention is a graveyard of promising ideas that did not survive contact with frontier scale. And the gap between research results and production numbers in their own benchmarks suggests the team knows they are not fully there yet.

But the direction is correct. Dense attention computing every pairwise interaction at quadratic cost is objectively wasteful. The question was always whether you could be selective without losing critical signal. If SubQ has found a way to do that reliably, it is not just another model release. It is a structural break in how LLMs use compute.

I have requested early access. When it arrives, I will test it the way I test everything. Not on benchmarks, but on real work. Load a full codebase, run a complex refactor, check whether the output holds up when the context is adversarial rather than cooperative.

Until then, cautious attention. Which, ironically, is exactly what SubQ is selling.
