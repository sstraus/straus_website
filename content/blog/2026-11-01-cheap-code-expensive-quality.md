---
title: "Cheap code, expensive quality"
date: 2026-11-01
tags: [ai, github, open-source, coding-agents, software-quality, rust]
cover: img/cheap-code-expensive-quality-cover.png
---

# Cheap code, expensive quality

A $200 monthly subscription to an AI coding agent now buys a lot of compute. People who log their usage and reprice it at public API rates report something between about $1,700 and $3,200 a month for steady daily work. The heaviest users who push the weekly limits report $6,000 to $8,700. One measured case suggests the weekly cap of the most expensive Claude plan sits around $1,900 of API value, so a month at the limit lands near $8,000. These are self-reported logs, and the provider does not publish limits in dollars. Still, the order of magnitude is clear.

That subsidy changes who can build software. Someone with an idea and a weekend can now get a working application out of an agent. My own side projects work this way. Agents write the code and I review it. The output is often good, sometimes very good with the latest models. The interesting part is what happens after the code exists.

## The numbers behind the feeling

GitHub says 121 million new repositories were created in its 2025 reporting year, against 60 million in 2020. The 2026 report talks about 17.9 billion pushes in twelve months, more than 2024 and 2025 combined, and says more than 40% of pull requests now start with an agent. Outside GitHub the pattern repeats. Sensor Tower estimates that new App Store releases doubled in the first half of 2026 to about 560,000, while downloads grew 2%. On Product Hunt, a community analysis counts about 147,000 submissions so far in 2026 against about 43,000 in all of 2024.

More supply with flat demand has a predictable consequence. A rough way to see how much of this output survives is the GitHub search API. For public repositories created between January and June, I had an agent count how many received any push more than 90 days after the end of their creation month. That was about 10.5% for 2024, 10.0% for 2025 and 6.9% for 2026. The method is rough. Recent repositories had less time to receive late pushes, deleted repositories are invisible, and a push can be a bot. Comparing only January cohorts, the share drops from 11.5% in 2024 to 8.7% in 2026.

| Repos created Jan to Jun | Public repos | Pushed after 30+ days | Pushed after 90+ days |
|---|---|---|---|
| 2024 | 20.8M | 15.1% | 10.5% |
| 2025 | 26.6M | 14.4% | 10.0% |
| 2026 | 43.7M | 12.8% | 6.9% |

Most repositories were always short lived. A 2015 study of GitHub found that only 38% of projects stayed active for more than a month, long before any AI was involved. Most of these are experiments, homework and forks, and that is fine. What changed is the volume, and the fact that the throwaway projects now look finished.

## Why so many end up abandoned

Building got cheap, but selling did not. A developer who builds a product with an agent then meets a market where the same idea has been shipped ten times in the same month. Reddit threads are full of people who rebuilt an app for themselves instead of paying a few euros for it. From their point of view that is rational. The marginal cost of the clone was close to zero, and the clone fits their workflow. For whoever wanted to sell the original, it means the buyer pool shrinks while the competition grows.

Some build for passion and stay happy with a tool that only they use. Others want revenue and find that distribution is the real bottleneck. Without a sustained social campaign, or an existing audience on YouTube or similar, a new product rarely gets noticed. When traction does not arrive in the first weeks, the repository goes quiet. Open sourcing it costs nothing, so many of them end up public and abandoned.

The same pattern shows up with clones of complex products. Searching GitHub for repositories created since 2025 that call themselves a clone or an alternative of Photoshop, Excel, PowerPoint, Lightroom or Premiere returns several hundred results, and in the samples checked almost all of them had fewer than ten stars. Of the first 100 Excel clones, 86 had received no push since May 2026. A demo that opens a file and applies a filter is not a Photoshop replacement, because the real product is file format compatibility, color management, collaboration and years of edge cases.

## Polish is no longer a signal

The surface of a project used to tell you something. A good landing page, complete documentation and a few thousand GitHub stars implied that someone had invested months. Today an agent produces the site and the docs in an afternoon. Stars are worse. A Carnegie Mellon study detected about six million suspected fake stars on GitHub, with campaigns growing sharply in 2024. Most of them promoted short-lived malware, but the effect on the signal is the same.

Rust is a good example of the mismatch. It is a demanding language with a steep learning curve, the kind you used to choose only after real investment. Yet GitHub reports that the number of developers working on Rust projects doubled in the past year, the fastest growth among the top languages, and roughly 40% of the merged pull requests in those projects show AI involvement. Many new projects are written in Rust instead of Go, Python or TypeScript by people who would never have attempted it before, because it sounds serious and the agent writes the code anyway. Choosing a hard language without understanding ownership or lifetimes does not make the project more rigorous, but from the outside "written in Rust" still reads as a quality signal.

## Where the value moves

If writing code is cheap, the value moves to the decisions around it. An agent will add any feature you ask for, because a feature is one prompt. It will also produce software that works while being badly designed, because when you describe only the expected result, the result is what you get. Security, coherent data models, a sensible scope and maintainability are not visible in a demo. They come from people who have seen systems fail and know what to leave out.

That is the uncomfortable part. A product built with care and a product that only promises it can look identical in the first ten minutes. Both have a polished site, a long feature list and stars. The difference shows up months later, in the bugs, the migrations and whether anyone is still there to answer an issue. For now I do not see a reliable way to tell them apart quickly, and it remains to be seen whether the platforms will build one or whether reputation will simply move back to people and teams with a track record.
