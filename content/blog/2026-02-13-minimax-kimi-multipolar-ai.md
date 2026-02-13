---
title: MiniMax, Kimi, and the End of the US-Only AI Narrative
date: 2026-02-13
tags: [ai, benchmarks, minimax, kimi, model-selection]
---

# MiniMax, Kimi, and the End of the US-Only AI Narrative

Last week I was setting up a new agent pipeline for a side project and caught myself doing something I would not have done six months ago. I was reading comments on X about Kimi K2.5's benchmark results alongside Claude's. Not out of curiosity. Out of genuine uncertainty about which model would handle the tool-calling layer better. Because the better these models get, the higher the expectations grow, and somehow it is never enough.

That moment stuck with me, because it broke a habit I did not even know I had. For the past year, model selection in my work has been a two-body problem: Anthropic or OpenAI, occasionally Google. The rest was noise. Interesting noise, sometimes impressive noise, but not something I would seriously evaluate for production workflows.

That assumption no longer holds.

## The numbers that matter

I am not going to walk through every benchmark. Most of them measure things that do not affect how I build software. But a handful of benchmarks do matter for teams running AI-driven development pipelines, and on those, the results have converged in ways that should change how you think about model selection.

**SWE-Bench Verified** measures whether a model can fix real bugs in real GitHub repositories, validated by running the actual test suite. This is the closest thing we have to a benchmark that reflects day-to-day engineering work.

| Model | Score |
|-------|-------|
| Opus 4.6 | 80.9 |
| MiniMax M2.5 | 80.2 |
| GPT-5.2 | 80.0 |
| Kimi K2.5 | 76.8 |

MiniMax is essentially tied with Anthropic and OpenAI. Kimi from Moonshot AI is slightly below the top cluster, but still in the same performance tier. For an open model iterating at this speed, that 4-point gap is strategically small. And Kimi's variants tell a deeper story: 73.0% on SWE-Bench Multilingual and 50.7% on SWE-Bench Pro, indicating robustness that extends well beyond standard English-language repositories.

**BFCL** evaluates structured tool use and API integration across multiple turns. If you are building agent systems, orchestration layers, or anything that chains tool calls, this is the benchmark that predicts real-world reliability.

| Model | Score |
|-------|-------|
| MiniMax M2.5 | 76.8 |
| Opus 4.6 | 68.0 |
| GPT-5.2 | 61.0 |

MiniMax wins clearly. The gap is not marginal. It translates into fewer tool-call failures and less corrective scaffolding in production. Kimi K2.5 does not have a standardised BFCL score yet, but approaches the problem from a different angle. Its Agent Swarm architecture coordinates up to 100 parallel sub-agents for decomposition, retrieval, and tool chaining. That is not a function-calling benchmark. It is a different execution model entirely, and one that traditional single-pass scoring does not capture.

**Multi-SWE-Bench** measures bug fixing across multiple heterogeneous codebases, testing whether a model generalises beyond the repositories it was likely trained on.

| Model | Score |
|-------|-------|
| MiniMax M2.5 | 51.3 |
| Opus 4.6 | 50.3 |
| Gemini 3 Pro | 42.7 |

MiniMax edges out Opus and significantly outperforms Google. This matters the moment you move beyond well-known open-source projects into the kind of proprietary, messy codebases most companies actually maintain.

## Where the models diverge

The picture gets more interesting when you move beyond pure code benchmarks.

On **BrowseComp**, which measures web comprehension and multi-step reasoning over online content, the ranking shifts:

| Model | Score |
|-------|-------|
| Opus 4.6 | 84.0 |
| MiniMax M2.5 | 76.3 |
| Kimi K2.5 | 74.9 |

Opus leads here. For tasks that require deep narrative comprehension and long-form semantic integration, western frontier models retain an edge. But Kimi at 74.9 is close enough to MiniMax that the difference between them is noise, and both are within striking distance of Opus.

On **Humanity's Last Exam with tools**, which evaluates long-horizon reasoning with active tool usage, the ranking inverts:

| Model | Score |
|-------|-------|
| Kimi K2.5 | 50.2 |
| GPT-5.2 | 45.5 |
| Opus 4.5 | 32.0 |

Kimi leads by a wide margin. This is where the Agent Swarm architecture pays off. Tasks that require decomposition, parallel retrieval, and multi-step tool chaining play to Kimi's structural strengths. For anyone building autonomous systems rather than chat-based copilots, this benchmark matters more than SWE-Bench.

## What this actually means

The pattern is not that one model wins everywhere. The pattern is that different models win on different workloads, and the winners are no longer exclusively American.

MiniMax competes at the absolute top tier for real bug fixing and structured tool orchestration. Kimi is slightly behind on raw SWE-Bench Verified but leads on agentic reasoning and shows strong multilingual generalisation. Anthropic still leads on deep web reasoning and narrative comprehension. OpenAI remains competitive across the board but no longer holds a clear structural margin on engineering-heavy tasks.

For teams building AI-native development platforms, autonomous remediation systems, or multi-agent toolchains, model selection is no longer a regional decision. It is a workload decision.

I have been running my entire development workflow through Anthropic for the past year. I still think Claude is the best general-purpose model for the way I work. But I can no longer say that with the certainty I had six months ago, and I find myself testing alternatives in ways I previously considered a waste of time.

Anthropic still leads with Opus, but the margin is thin and getting thinner. Improving at the top of the performance curve is exponentially harder than catching up from behind. Each incremental point on SWE-Bench costs more research, more compute, more time. The challengers do not have that problem yet. They are still on the steep part of the curve, where iteration is fast and gains are large. If Anthropic's release cadence does not accelerate, the lead could evaporate within a few quarters.

The benchmark layer is now multipolar. If you are still defaulting to US-only models without evaluating MiniMax or Kimi for your specific workload, you are making a decision based on habit rather than data.

2026 could be the year the map gets redrawn entirely. It is going to be an interesting race.
