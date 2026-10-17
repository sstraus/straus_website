---
title: "Gemini 4 Argon Changes the Ranking, but There Is No Longer One Ranking"
date: 2026-10-10
tags: [ai, llm, gemini, claude, gpt, benchmarks]
---

# Gemini 4 Argon Changes the Ranking, but There Is No Longer One Ranking

A few days ago a chart crossed my feed that ranked the current frontier models in a tidy line: `Gemini 4 Argon > Claude Opus 5.5 > Gemini 3.1 Pro > GPT-6 Astra > GPT-6.1 Sol > GPT-5.6 Sol > Grok 4.7 > Grok 4.6`. My first reaction was that it looked wrong, so I went through the sources behind it, Artificial Analysis, Vals AI and Arena first, and the vendor tables separately.

I changed my mind about one thing. Gemini 4 Argon really is a frontier model, and on some independent leaderboards it is the best one available. What I did not change my mind about is the ranking itself, because in 2026 putting frontier models in a single ordered list has become almost meaningless, and Argon turns out to be the best illustration of why. I also have to admit that my first draft of this post contained numbers I could not trace back to any leaderboard. They came from an AI-assisted summary, they looked plausible, and they were wrong. Every number below now links back to a page I checked, which turned out to be the most useful lesson of the whole exercise.

## Google DeepMind is a vendor

Google announced Gemini 4 Argon on September 30, and access is still gated, so there is far less production evidence for it than for Claude or GPT. That matters more than it sounds. Google DeepMind is Google, and a Gemini result published by DeepMind is a vendor result in exactly the same way an Opus number published by Anthropic or an Astra number published by OpenAI is a vendor result. The vendor chose the harness, the reasoning budget and the comparison set, and in the case of Argon's DeepSWE score Google ran its own model while taking the competitors' numbers from elsewhere.

So the rule for this post is simple. Every quantitative comparison uses one independent source, Artificial Analysis for general intelligence, cost and calibration, Vals AI for professional and agentic tasks, Arena for human preference. Google's own numbers get their own section, clearly labelled, and no conclusion rests on them alone.

## General intelligence brought Google back, not ahead

Artificial Analysis gives Argon 53 on its Intelligence Index v4.3.2, level with GPT-6 Astra, one point ahead of GPT-6.1 Sol and five points behind Claude Opus 5.5.

| Model | AA Intelligence Index | Reasoning setting |
|---|---:|---|
| Claude Opus 5.5 | 58 | Max |
| Gemini 4 Argon | 53 | High |
| GPT-6 Astra | 53 | Max |
| GPT-6.1 Sol | 52 | Max |
| Grok 4.7 | 46 | Xhigh |
| Gemini 3.1 Pro Preview | 30 | As published by AA |

This table alone breaks the chart I started from, where Gemini 3.1 Pro sat in third place. On this index the Preview version scores 30, twenty-three points below Argon, and I would not stretch that number to other 3.1 variants. Argon did not establish a lead in general intelligence. It brought Google back into the leading cluster, which is a real achievement and a different story from the one the chart was telling.

## One evaluator, one model, first to seventh

Things become interesting once you stop averaging unrelated abilities into one number and look at a single evaluator testing a single model across many tasks. Vals AI tests Argon on more than twenty benchmarks, and the spread of positions is the clearest argument against a single ranking I have seen.

![Gemini 4 Argon's rank on eight Vals AI leaderboards: first on Finance Agent v2 and the Vals Index, second on Vibe Code Bench, Code Migration and CyberBench, fifth on Harvey Legal Agent and Terminal-Bench 4.0, seventh of eight on CUA-bench](/img/argon-vals-ranks-card.png)

| Vals benchmark | Argon | Rank |
|---|---:|---|
| Finance Agent v2 | 65.40% | #1 of 76 |
| Vals Index | 68.90% | #1 of 45 |
| Vibe Code Bench v1.1 | 91.91% | #2 of 110 |
| Code Migration | 68.17% | #2 of 75 |
| CyberBench v1.1 | 77.86% | #2 of 45 |
| Harvey Legal Agent | 19.58% | #5 of 76 |
| Terminal-Bench 4.0 | 57.58% | #5 of 45 |
| CUA-bench | 4.83% | #7 of 8 |

The top of that table is the strongest independent case for Argon. The Vals Index weights agentic work in finance, coding, law and tax by each sector's share of US GDP, and Argon leads it at 68.90%, ahead of Claude Sonnet 5.5 at 67.04% and Claude Opus 5.5 at 66.97%. On Finance Agent v2 the gap is wider, 65.40% against 58.59% for Opus, which sits ninth. CyberBench is the most surprising row, with Argon second at 77.86% and Opus thirty-seventh of forty-five at 55.36%. The bottom of the table is just as real, though, and it is where the agentic story starts.

## Writing code and running a terminal are different jobs

Arena tells a similar story from the human-preference side. Argon (High) took first place in Text Arena with 1525 points, and eighth place in Code Arena WebDev with 1679. Being the model people prefer to talk to and being the model people prefer to build with are clearly not the same thing.

Vals is more nuanced on code. Argon is second on Vibe Code Bench and second on Code Migration, so it writes and transforms code at the very top level. Hand it a terminal and it drops to fifth on Terminal-Bench 4.0, at 57.58%, while Opus 5.5 is first. And here the obvious question is which Opus number to quote, because Vals documents three of them on the same page.

![Terminal-Bench 4.0 on Vals: Opus 5.5 current listing 65.15%, earlier run 61.62%, Argon 57.58%, earlier Opus run 53.54% when fallback-assisted tasks count as failures](/img/argon-terminal-bench-card.png)

The current listing gives Opus 65.15%. An earlier run gave 61.62%, and Vals explains that some of those runs used fallback models, so counting fallback-assisted tasks as failures moves that earlier result to 53.54%, below Argon. I do not think this makes Opus weaker than Argon in a terminal, and the current number is still clearly ahead. It does mean that a single figure on a slide hides a configuration choice, and that "Opus 5.5" on a leaderboard is sometimes a system rather than a model. This is the part of agentic evaluation that keeps getting more important, because the reasoning budget, the prompts, the tools, the scaffolding and the fallback strategy all move the score.

Computer use is stranger still. Vals CUA-bench has agents play commercial video games for three hours each, pixels in and keystrokes out, and Argon finishes seventh of eight at 4.83%, behind GPT-6 Astra at 19.17% and Opus 5.5 at 14.00%. It is a narrow test, since it measures game play through mouse and keyboard rather than every kind of computer use, so I would not turn Astra's lead into a general claim. The narrower statement holds anyway: Argon's excellent reasoning and knowledge scores do not automatically translate into control of a computer.

## Calibration is not the same as accuracy

One Argon result deserves more attention than it has received, and also more care. Artificial Analysis' Omniscience evaluation separates accuracy, hallucination and abstention, and Argon's profile is unusual.

| Model | AA-Omniscience accuracy | Hallucination rate |
|---|---:|---:|
| Gemini 4 Argon | 50% | 15% |
| GPT-6 Astra (max) | 63% | 51% |
| GPT-6.1 Sol (max) | n/a | 54% |

Argon is right less often than Astra, and it invents answers far less often. The difference is abstention: Argon is much more willing to say, in effect, "I don't know". I would not summarise this as "very low hallucination" because a model that answers less often can hallucinate less without being more accurate, and the benchmark does not promise reliability in general. Strong factual calibration in AA testing is the honest description. Still, imagine two research agents, one of which answers more questions and confidently invents a third of what it does not know, while the other declines the questions it cannot establish. For a chatbot you might prefer the first. For financial analysis, security work, or any agent that feeds its output into other agents, I prefer the second, because the invented answers are the ones that end up in a report nobody rechecks.

> Calibration is becoming a capability in its own right, and leaderboards that only count right answers are slowly measuring the wrong thing.

## The price list changes the picture

Artificial Analysis also publishes what it costs to run each model through its own index, as an average cost per task. This is not the price of a generic API request, but it is measured on the same workload for every model, which makes it the fairest cost comparison I have.

![Artificial Analysis Intelligence Index against cost per task: Opus 5.5 58 at $5.98, Argon 53 at $1.99 introductory and $3.98 at full price, Astra 53 at $3.26, Sol 52 at $0.72, Grok 4.7 46 at $3.74, Gemini 3.1 Pro Preview 30 at $1.30](/img/argon-cost-card.png)

| Model | AA Intelligence | Cost per task (AA) |
|---|---:|---:|
| Claude Opus 5.5 (Max) | 58 | $5.98 |
| Gemini 4 Argon (High), introductory price | 53 | $1.99 |
| Gemini 4 Argon (High), full price | 53 | $3.98 |
| GPT-6 Astra (Max) | 53 | $3.26 |
| GPT-6.1 Sol (Max) | 52 | $0.72 |
| Grok 4.7 (Xhigh) | 46 | $3.74 |
| Gemini 3.1 Pro Preview | 30 | $1.30 |

Argon's $1.99 uses the introductory price of $2 per million input tokens and $10 per million output tokens, which is half the standard $4 and $20 that Vals already lists. At full price Artificial Analysis puts it at $3.98 per task, more than Astra. The reason is verbosity: Argon averages around 62k output tokens per task against 27k for Astra, so its cost advantage comes from the price per token rather than from using fewer tokens. That also means you cannot compare Argon's cost on Vals and on Artificial Analysis without checking which price each one used.

The model that this table really flatters is GPT-6.1 Sol. It scores 52 against 53 for Argon and Astra, and costs $0.72 per task. That does not make Sol the cheapest choice for every workload, but in the ratio between measured capability and measured cost it is very hard to beat, and for a production system processing millions of requests, one point on a composite index matters much less than the shape of the cost curve.

## What Google says, separately

Google's launch table contains several results that would be very important if they were reproduced. As reproduced by DataCamp and others from the DeepMind announcement, these are vendor-reported numbers.

| Benchmark (Google DeepMind) | Argon | Astra | Opus 5.5 | Who ran it |
|---|---:|---:|---:|---|
| GraphWalks, 256K to 1M tokens | 84.2% | 71.8% | 66.8% | Google, all models |
| LVBench, long video | 91.7% | 87.5% | 83.7% | Google, all models, Gemini at 1 frame per second |
| DeepSWE v1.1 | 77.9% | 74.1% | 74.2% | Google for Argon, other sources for rivals |
| FrontierSWE v2 | 55.0% | 65.5% | 62.3% | as reported by Google |

The long-context row is the most striking, a 12.4-point lead over Astra between 256K and one million tokens. If it holds up independently, it changes how you build systems around large repositories, corporate knowledge bases and long-running agent state. At launch no third party had reproduced these figures, so I treat them as signals rather than findings. It is also worth noticing that Google's own table shows Argon losing clearly on FrontierSWE, which fits the Terminal-Bench picture: the vendor table itself does not claim that Argon is the best agentic engineer.

## So which model is the best?

There is not one. Instead of a ranking, this is what I think the data supports today, and, just as important, what it does not. It is a qualitative reading, not a statistical ranking.

| Model | Strengths the data supports | What we cannot claim |
|---|---|---|
| Gemini 4 Argon | Knowledge work, finance, competitive coding, calibration | Best autonomous agent |
| Claude Opus 5.5 | General reasoning, terminal work and agentic coding | Best on every benchmark |
| GPT-6 Astra | Reasoning, software engineering, game-based computer use | Best software architect |
| GPT-6.1 Sol | Capability per dollar on the AA index | Cheapest for every workflow |
| Gemini 3.1 Pro Preview | A much cheaper earlier Gemini | Competitive with Argon on general intelligence |
| Grok 4.7 | Some professional and reasoning tasks | Overall leadership in cybersecurity |

Before looking at the independent results I was skeptical that Argon deserved the hype, and after looking at them I think Google has built something more interesting than "the new best model". It leads the economically weighted Vals Index, it is clearly first in financial research, it writes and migrates code at the very top level, it is unusually conservative about claims it cannot establish, and there are vendor signs, not yet independent ones, that its long-context ability is exceptional. Give it a terminal or a video game, though, and it falls well behind. Ask for broad hard reasoning and Opus still leads the Artificial Analysis composite, and ask for intelligence per dollar and GPT-6.1 Sol is very hard to beat. None of that is a weakness of Argon. It is evidence that the frontier has fragmented.

## Reading a benchmark in 2026

Model evaluation has become substantially harder, and the mistake I made in my first draft is a good example of how easy it is to go wrong. These are the questions I now ask before a number changes my mind about anything:

- **Who ran it?** Google testing Gemini, Anthropic testing Claude and OpenAI testing GPT are all vendor results. Only an independent evaluator removes the incentive.
- **At what reasoning level?** "High", "Max" and "Xhigh" are effectively different configurations of the same model.
- **With which harness, and with which fallbacks?** For agentic benchmarks the scaffolding can move the result by more than the gap between two models.
- **At which price?** Introductory pricing can halve the measured cost of a verbose model.
- **Can I open the page it came from?** If a number cannot be traced to a leaderboard, it does not go in the post, no matter how plausible it looks.
- **Does it measure what I care about?** Vibe Code Bench and Terminal-Bench are both "coding benchmarks", and they do not measure the same capability.

That last question is why one leaderboard can put Argon second and another can put it fifth on the same day, without either of them being wrong.

| Source | What I used it for |
|---|---|
| [Artificial Analysis](https://artificialanalysis.ai/articles/gemini-4-argon-google-top-three-labs) | Intelligence Index, reasoning settings, cost per task, Omniscience |
| [Vals AI](https://www.vals.ai/models/google_gemini-4-argon) | Professional and agentic benchmarks, Terminal-Bench, CUA-bench |
| [Arena](https://x.com/arena/status/2105394855644139908) | Human preference in Text Arena and Code Arena |
| Google DeepMind launch table | Vendor claims, kept separate |

The question that matters in late 2026 is no longer which model is the smartest. It is which model I give this particular job to, and which evaluator I trust to tell me.
