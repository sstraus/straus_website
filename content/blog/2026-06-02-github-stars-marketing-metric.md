---
title: "GitHub Stars Are Becoming a Marketing Metric, Not a Quality Signal"
date: 2026-06-02
tags: [open-source, github, metrics, engineering]
---

# GitHub Stars Are Becoming a Marketing Metric, Not a Quality Signal

I have mostly stopped trusting the star count on a GitHub repository, and it took me longer than I would like to admit to get there. For years that number did real work in my head. It was never precise, and nobody serious treated it as if it were, but it correlated with something useful. A project sitting at tens of thousands of stars usually came with active contributors, a steady stream of releases, and issue threads where people argued about edge cases. The number was shorthand for "people are actually here."

A proxy like that is fine as long as it keeps pointing in the same direction as the thing it stands for. That is exactly what stopped happening. The number and the reality underneath it quietly came apart, and the reason is not mysterious. Stars turned into a currency. And the moment a metric becomes a currency, a market grows around it whether anyone wants one or not.

## The market is not hiding anymore

It used to feel like something that happened in the disreputable corners of the internet. Not anymore. Spend ten minutes on Telegram, Fiverr, or a handful of purpose-built marketplaces and you will find vendors selling stars, forks, followers, and entire engagement packages with the same calm confidence as a SaaS pricing page.

The competent ones have learned not to dump a number on you overnight, because that pattern is precisely what gets flagged. So they drip the stars out over a week or two, until the graph looks like something that grew rather than something that was poured. Pay a little more and they will layer in issues and comments, giving the repository the texture of a place where people genuinely show up.

This is not a few lonely developers padding their vanity numbers. It is a supply chain, and supply chains exist because demand is durable. Investors read GitHub activity as traction. Journalists reach for it when a story needs a number to stand on. Developers doing the evaluating, myself very much included, use the star count as a first-pass filter before reading a single line of source. When everyone holding a budget or a byline is staring at the same figure, that figure gets a price. And the people most willing to pay it tend to be the ones with the most pressing reason to look successful before they actually are.

## Why it is hard to stop

It would be cheap to pretend GitHub is just ignoring this. They have put real engineering into detecting manipulation, and the problem genuinely resists a clean fix. The campaigns that matter look nothing like the bot farms of a decade ago. They run across real accounts belonging to real people, amplified by influencers with genuine audiences, pushed through newsletters and launch communities and paid promotion that, at the level of a single click, is indistinguishable from honest enthusiasm.

There is also an awkward truth sitting underneath the technical difficulty. Engagement is good for GitHub. Activity brings users, discussion, and attention regardless of where it came from. Asking the platform to aggressively suppress the behavior that inflates its own headline numbers is asking it to push against its own gravity, and gravity usually wins.

## What the number measures now

So you end up with a metric that measures launch execution far more faithfully than it measures engineering quality. That does not make it worthless, and I do not want to overcorrect into pretending it tells you nothing. A repository at forty thousand stars did, at minimum, run a campaign that worked, which says something real about a team's ability to manufacture attention. It just does not answer the question I used to think it answered: whether the thing underneath is any good.

> A high star count tells you a launch worked. Whether the code works is a different question, and the number was never the one answering it.

Those are separate questions now. I have stumbled into some of the most solid engineering of the last few years in repositories with a few hundred or a few thousand stars, projects that never had a launch moment and never tried to engineer one. And I have wired up the popular option, the one with the slick README and the launch thread that made the rounds, only to spend two evenings discovering that almost nobody outside the original author had ever touched it. Open issues from a year ago. Pull requests sitting unreviewed. A lot of attention, very little life. Ask me how I know.

## Reading the repository instead of the number

I read these projects differently now, and the shift is less about finding a better single number than about refusing to lean on any single number at all. The signals that survive scrutiny are the ones that are expensive to fake in combination, and most of them sit one click below the star count:

- How many genuinely distinct people are contributing, not the raw commit total, because one prolific author produces a lot of activity that vanishes the day they lose interest.
- Whether the history has continuity, whether the project outlived the enthusiasm of whoever started it.
- Whether maintainers answer hard questions in the issues or just triage and close.
- Release cadence, but only insofar as releases fix problems real users actually reported.
- Contributor diversity across different organizations, which is hard to fake convincingly.
- The quiet evidence of production use: dependents, postmortems, blog posts written by people who clearly run the thing under load and have the scars to show for it.

None of these is conclusive alone. Together they are far harder to buy than a number.

If I had to keep one rough heuristic, it would be the gap between attention and participation, because that gap is where the manufactured cases give themselves away. A repository with tens of thousands of stars and almost no contribution from anyone outside the original author is worth a second look. Not because that proves anything on its own, since plenty of excellent single-author tools simply do not invite outside work, but because a project thousands of people supposedly love and yet nobody has ever bothered to send a fix to is telling two different stories about its popularity and its actual use. The distance between those stories usually says more than the star count sitting on top of them.

## The same arc as everything else

None of this is really specific to GitHub. It is the same path every public metric on the internet eventually walks: useful signal, then optimized target, then openly gamed number. Follower counts went through it. Likes went through it. Search rankings and app store reviews went through it. There was never much reason to expect stars to be the exception.

The metric still exists, and it still carries information. What degraded is the signal-to-noise ratio, quietly, while the number itself kept climbing. For anyone deciding what to actually build on, that shift is not academic. The cost of trusting the wrong number gets paid later and in private, in the evenings you spend discovering that the popular thing was popular for reasons that had nothing to do with whether it works.
