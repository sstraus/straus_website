---
title: "I Left Grok Out of the Last Benchmark"
date: 2026-08-18
tags: [ai, llm, coding, benchmarks, grok, claude, codex]
---

# I Left Grok Out of the Last Benchmark

This is a benchmark of coding agents. Same task, same rubric, isolated CLIs, five trials each. It does not ask who can write the most code. It asks three things I actually use agents for: can they reason through a hard constraint, can they find the problems in the text, and what does that cost in time and money.

The first published ranking was [Codex against Claude](https://publishwith.ai/t/publishwithai/a/claude-code-vs-codex-cli-measured-cost-and-quality/). Sol matched Opus at a lower price. Terra and Sonnet tied on the same miss. Luna was the value row. Haiku was the unsafe one. Grok was not in the run. It was not even a footnote.

Two weeks later I wrote that [the field was no longer a one-horse race](/blog/coding-ai-one-horse-race/). Grok 4.5 showed up there as the cheap, pleasant third: enjoyable, good at research, *not* at the level of the leaders in raw coding. That was a daily-use impression. It was not this benchmark, and it treated Grok as atmosphere around a Codex versus Claude story.

I then put Grok 4.5 and 4.6 on the same harness as everyone else. They were the result.

## How it runs

Eleven conditions. Five isolated trials each. High reasoning effort. Deterministic 10-point rubric. No model judged another model. Codex and Claude ran on 10 August. Grok ran on 17 August and was combined without rescoring. That delay is why Grok was missing from the first table, not a reason to keep it off this one.

The workload is a small repository, not a coding contest. The implementation of an attention sound is already correct and must not move. The user-facing text is stale: two docs overclaim that native and browser timing are identical, and an MCP schema still calls the sound a "low three-pulse buzzer". The agent has to see the mismatch, repair every descriptive surface, leave the runtime alone, and stop. An agent that starts rewriting the synthesizer has already failed the benchmark.

## Reasoning

The constraint is the test. The implementation stays. An agent that "fixes" the code to match the stale docs has not reasoned. It has inverted the problem.

Haiku did that in one trial. It changed runtime behavior to make the old documentation true, which is the one move the prompt prohibited. That is not a small miss. It is a failure to hold a rule while editing the surrounding text.

The rest of the field shows the same split in a quieter way. Opus and Sonnet spent about 13 turns exploring, burned 171k to 270k accounted tokens, and still did not close the loop. Sol sat in a short band and was usually complete. Grok used four or five turns and stopped. Grok 4.5 finished in 71k tokens with almost no run-to-run variation.

More search is not more reasoning. Claude looked longer and still dropped the constraint or the secondary surface. Grok looked at fewer files because it had already decided what mattered, and then it did not flinch.

*Reasoning here is the ability to hold a prohibition while you repair the text around it. Grok held it every time.*

## Finding the problems in the text

This is the part ordinary coding leaderboards skip, and it is the part that decided the score. It is also the part Grok was never scored on in public, because Grok was never in the table.

The rubric gives two points for repairing the MCP schema, two for removing the false timing-equivalence claims, two for keeping the exact motif in user-facing text, two for leaving runtime files byte-identical, one for an accurate `RESULT.md`, and one for staying inside the expected surfaces.

Almost everyone touches the files that look like documentation. The schema is the surface that tells you whether the agent actually read the whole artifact. Agents that only follow the obvious filenames walk past it.

Claude did this systematically. Opus missed the schema or the exact motif on every trial and never produced a perfect result. Sonnet managed one perfect trial out of five. Haiku missed the schema in all five. Codex is close: Sol API and Terra went 4/5, and their misses were usually wording, not a rewritten implementation.

Grok found every stale claim, every time. Not the schema, not the motif, not the runtime boundary. 4.5 and 4.6 were the only conditions that went 5/5. That is not a rounding error. That is the row the last ranking did not have.

*The easy text is not the test. The less obvious surface is. Grok was the only family that never missed it.*

## Time and cost

![The last ranking left Grok out](/img/measured-agents-card.png)

| Model | Mean score | Perfect | Mean time | Mean cost |
|---|---:|---:|---:|---:|
| Grok 4.5 | 10.0 | 5/5 | 45 s | $0.027 |
| Grok 4.6 | 10.0 | 5/5 | 66 s | $0.017 |
| Terra | 9.8 | 4/5 | 78 s | n/a |
| Sol API | 9.6 | 4/5 | 50 s | $0.193 |
| Sol subscription Fast | 9.4 | 3/5 | 64 s | n/a |
| Sol API Fast | 9.0 | 2/5 | 26 s | $0.360 |
| Sol subscription | 9.0 | 2/5 | 88 s | n/a |
| Luna | 7.2 | 1/5 | 85 s | n/a |
| Opus 5 | 7.0 | 0/5 | 79 s | $0.343 |
| Sonnet 5 | 6.2 | 1/5 | 89 s | $0.280 |
| Haiku 4.5 | 4.0 | 0/5 | 54 s | $0.080 |

Grok cost is what its CLI reports for a grok.com subscription login, not a separable invoice line. Subscription Codex rows have no per-call API spend, so I refuse to invent one. Sol API and Claude costs are calculated or CLI-reported under standard list prices. The August Sonnet promotion is ignored.

On the priced rows the spread is not subtle. Grok 4.5 finished complete in 45 seconds at a CLI-reported $0.027. Grok 4.6 was slower and cheaper, 66 seconds at $0.017, still 5/5. Sol API was almost as fast, 50 seconds, at $0.193, and missed one trial. Opus took 79 seconds, cost $0.343, and never finished the set. Sonnet was slower still at 89 seconds and $0.280, with one perfect trial in five.

In the earlier Codex-versus-Claude ranking, Sol was the premium win because it matched Opus at a lower price. That comparison was real. It was also incomplete. Once Grok is in the same benchmark, Sol is no longer the cheap complete row. It is the expensive almost-complete one.

Fast mode is the other result I did not expect. Sol API Fast finishes in 26 seconds instead of 50. It also drops from 4/5 perfect to 2/5, and the calculated cost rises from $0.193 to $0.360 because the Fast rate card is $10 / $1 / $60 per million tokens instead of $5 / $0.50 / $30. You pay more to be worse, just sooner. If the pitch is "same model, same quality, less waiting", this benchmark does not support it. The requested tier is Fast. The Codex stream does not currently expose the API's effective `service_tier`, so I am describing the condition I asked for, not an independently confirmed server response.

I am not going to pretend Grok's CLI number and Sol's calculated API number are the same kind of dollar. I am going to notice that they are not even in the same band. Completeness, wall-clock, and spend moved together for Grok. They came apart for Fast, and they came apart for Claude.

The per-trial score sequences, the failed-criterion matrix, and the full eleven-condition table are in the [complete report](https://publishwith.ai/t/publishwithai/a/agentic-coding-intelligence-grok-vs-gpt-56-vs-claude/).

## What I am not claiming

One task and five trials cannot establish a universal ranking. The harness says this out loud, and it is still true. A documentation-consistency workload rewards careful reading and scope discipline. It does not tell you who writes the better service, who reviews a gnarly refactor, or who survives a long session in a real repository. It does tell you that leaving Grok out of a benchmark like this is no longer a neutral omission.

An earlier three-trial run on the same task had Sol and Opus both at 10/10. This five-trial run, with stricter CLI isolation, does not. I am not going to turn that into a story about Opus collapsing. Small samples swing, model snapshots move, and a cleaner harness can remove help that a personal Claude config was quietly providing. The stable pattern is simpler: on this benchmark Claude keeps missing the less obvious surface, Codex is usually complete, and Grok, once it is actually in the run, is complete every time.

I also cannot claim exact Grok spend, and I will not convert subscription Codex tokens into imaginary API invoices. Token taxonomies differ. Latency includes launcher and authentication work. Date every rate card before you buy anything.

## What I am changing anyway

I still orchestrate. One model for coordination, others for implementation, review, and validation. That part of the earlier post holds. What changes is the hole I had left in the lineup.

When the work is "read this, find every stale claim, do not touch the runtime", that job now goes to Grok first. Sol API or Terra if I want a second independent pass. I am no longer routing that class of edit to Opus by default, and I am not routing constraint-sensitive edits to Haiku at all. Fast stays off unless I am measuring it.

Two weeks ago I ranked Grok below the leaders because it felt that way in the chair, and because the only table I had published did not contain it. Feeling is how I start. A benchmark with an empty row is a bad way to finish.

*The last ranking was incomplete. The missing row went 10/10.*
