---
title: "The 512 GB Mac Studio was sized for last year's open models"
date: 2026-10-24
tags: ["local-ai", "llm", "apple-silicon", "infrastructure"]
---

# The 512 GB Mac Studio was sized for last year's open models

![A small aluminium desktop box dwarfed by a towering stack of glowing model layers that rises far beyond it](/img/mac-studio-512gb-open-frontier.png)

Moonshot announced Kimi K3.1 Pro this week, with open weights promised by 4 November. It is a mixture of experts model with 2.8 trillion parameters in total, 104 billion active per token, a context window of just over one million tokens, and image input. When a model like this comes out with open weights I do the usual sizing exercise, mostly to understand what "open" means in practice. This time the result was clear enough to be worth writing down.

## The sizing exercise

K3.1 Pro is a post-trained version of Kimi K3, and Moonshot trained it quantization-aware with MXFP4 weights. That detail matters more than it looks. Four bit is the native format of the model, not a lossy compression somebody applies afterwards to make it fit. MXFP4 stores 4 bits per value plus a shared 8 bit scale every 32 values, so about 4.25 bits per parameter. Multiply by 2.8 trillion and you get roughly 1.49 TB of weights. Add the vision encoder, embeddings and runtime buffers and the realistic number is 1.5 to 1.6 TB.

The KV cache is the part where I expected bad news and found good news. Only 24 of the 93 layers use MLA style attention, which grows with context. The other 69 use Kimi Delta Attention, a linear attention variant with a state of fixed size. Moonshot does not publish all the dimensions I would need, so this is my estimate, assuming a compressed latent similar to what DeepSeek uses. It lands at roughly 28 KB per token, so around 30 GB for a full one million token session, plus a few hundred MB of fixed state. Tens of GB, not hundreds.

So one session at full context needs about 1.55 to 1.65 TB of fast memory. The biggest Mac Studio has 512 GB. That is roughly a factor of three, before any second user or second agent.

## What Apple sold, and when

The Ultra Mac Studio has been positioned as the local LLM machine since March 2025. The M3 Ultra version came with up to 512 GB of unified memory, over 800 GB/s of bandwidth, and Apple said explicitly that it could run models with over 600 billion parameters entirely in memory. At the time this was true and it was a strong claim. DeepSeek R1 had 671 billion parameters and at 4-bit took a bit over 400 GB. It fit, with room for context.

In August 2026 Apple announced the M5 Ultra Mac Studio. Bandwidth went up to 1.2 TB/s, peak AI compute up to 4.3 times the M3 Ultra according to Apple, and Thunderbolt 5 clustering is now part of the official pitch. The message was again about running enormous LLMs entirely on device. The memory ceiling stayed at 512 GB, and that configuration is only arriving now, in late October. Apple has not published the price yet, but fully specced it should be around 20k.

## The open frontier had already moved

The uncomfortable detail is the timeline. Kimi K3, same size and same architecture as K3.1 Pro, was released with open weights in July 2026, a few weeks before the M5 Ultra was announced. In August Qwen and DeepSeek released open models between 1.6 and 2.4 trillion parameters. So the flagship open models had already outgrown the machine on the day it was presented. K3.1 Pro did not change the picture, it is just the latest data point.

| Model | Open weights | Total params | Approx. 4-bit size (estimate) | Fits in 512 GB |
|---|---|---|---|---|
| DeepSeek R1 | Jan 2025 | 671B | ~400 GB | Yes |
| Kimi K3 | Jul 2026 | 2.8T | ~1.5 TB (native MXFP4) | No |
| Qwen3.8-2.4T-A95B | Aug 2026 | 2.4T | ~1.3 TB | No |
| DeepSeek V4 Pro 0813 | Aug 2026 | 1.65T | ~0.9 TB | No |
| GLM-5.3 | Aug 2026 | 753B | ~0.4 TB | Yes, tight |
| DeepSeek V4.1 Flash | Sep 2026 | 763B | ~0.4 TB | Yes, tight |
| Kimi K3.1 Pro | by 4 Nov 2026 | 2.8T | ~1.5 TB plus KV | No, about 3x |

In eighteen months the top open models grew about four times in total parameters, and Apple's maximum desktop memory did not grow at all. Parameter count is not quality, and some of the models that still fit are very good. But if the goal is the open frontier, the trend is not going in the direction of the desk.

## Why I think this is structural

My interpretation is that a desktop bought for local AI is sized for the models of the month it was announced, and in this market that already means one generation late. Unified memory is soldered. There is no upgrade path, the only way to get more memory is to buy another machine. Hardware cycles are measured in years, open model releases currently in weeks.

Clustering is the official answer, and it does work on paper. Four M5 Ultra with 512 GB each give 2 TB, enough for K3.1 Pro with some headroom. The problem moves to bandwidth and latency. Decoding reads the active weights once per token, here about 55 GB. With the model split across four machines in a pipeline, each node reads its part in sequence, so the ceiling is roughly 55 GB divided by 1.2 TB/s, about 46 ms per token, around 20 tokens per second in theory. My estimate for real use is more like 8 to 12 tokens per second, plus the Thunderbolt hops. Nobody has benchmarked this model on such a setup yet, so treat these numbers as estimates.

Prefill is worse. Ingesting one million tokens means roughly 2 x 10^17 floating point operations just for the dense part. On a node with eight datacenter GPUs that is tens of seconds. Apple does not publish TFLOPS for the M5 Ultra, so I cannot give a number, but I would expect minutes. A cluster of four Macs that loads the model and answers is a working prototype. It is not something I would plan daily work on.

## Usable, not bootable

The reason to run a model like this locally is to use it every day, including for agents, not to prove that it starts. That puts the bar where an API already is, and for me it means at least these things.

- 30 or more tokens per second per stream for interactive work
- time to first token on 100k to 1M tokens of context in seconds, not minutes
- several agents in parallel, each adding around 30 GB of KV cache at full context
- uptime, updates and failed nodes handled by someone
- power and noise that fit the room it runs in
- a cost that makes sense compared to the API

Today only datacenter nodes clear that bar, and not every one of them. Eight H200 have 1,128 GB, which does not even hold the weights, so you need twelve or more. Eight AMD MI350X have 2,304 GB and native MXFP4 support, which fits comfortably, at about 1000 W per GPU. Moonshot itself recommends supernodes with 64 or more accelerators for serving K3. That tells you what the people who built the model consider a normal deployment.

## The money side

Moonshot sells the same model through its API at 2 dollars per million input tokens, 0.20 for cached input and 10 dollars per million output tokens, flat across the whole context. As a rough example, an agent heavy day with 50 million input tokens, 90 percent cached, and 5 million output tokens costs about 70 dollars. That is around 25k per year, which is in the same range as the price of a single fully specced top Mac Studio, and well below four of them. The four Macs still give you a prototype, while the API gives you the production version.

So on cost alone local does not win. The reasons to do it anyway are privacy, data sovereignty and control over the model version, and they are legitimate. But they should be budgeted as what they are, a premium paid for control, not as a saving.

## What the Mac Studio is still good for

None of this makes the M5 Ultra a bad computer. Models in the 30B to 750B range run on it, some of them very well, and for many real tasks a carefully chosen model of that size is enough. Bandwidth and compute went up a lot in this generation, and for that class of model it shows.

My problem is with a specific promise, frontier open models on your desk, in a way that lasts. For that goal I think the top Mac Studio is useless as an investment. It was behind when it was announced, its memory cannot grow, and the only way forward is buying more of them and accepting prototype performance. The alternatives are less exciting and more honest. Pick a smaller model on purpose and size the machine for it, or rent GPUs for the cases where the big model is really needed.

Some things remain open. Real numbers for K3.1 Pro on Mac clusters will only arrive after the weights are out. It is not clear how fast MLX will support Kimi Delta Attention properly. And Apple's next Ultra might lift the 512 GB ceiling. For now the gap between open weights and a local setup you can actually work with is measured in terabytes.
