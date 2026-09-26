---
title: "The Herd Effect of Vibe Coding"
date: 2026-09-26
tags: [ai, vibe-coding, open-source, social-media, engineering]
---

# The Herd Effect of Vibe Coding

Something odd is happening around vibe coding, and I think it has less to do with code generation than with how technical ideas now move through social networks.

I see the same pattern often on X. Someone with real experience points out a legitimate problem. Usually the original observation is narrow and tied to a specific failure mode. Then it gets compressed into something stronger because stronger claims travel better. A few days later, most of the conditions are gone.

## From a narrow problem to an absolute claim

AI-generated tests are a good example. There is a real problem when the model writes both the implementation and the tests from the same reasoning. It can end up validating its own mistake, especially if the test is derived from the code instead of from an independent specification. That is worth discussing.

But from there it is very easy to end up at *“AI-generated tests are useless”*, which is a different claim. Once enough people repeat it, the distinction gets lost. You start seeing the same position everywhere, often from people who have not really tested the problem themselves.

This is not mainly an AI problem. **It is a social one.**

Being early on a new idea gets attention. A strong statement travels better than a conditional one. If a position starts getting engagement, more people repeat it. Some because they agree, some because they only understand part of it, some because they can see that this is where the attention is going. After a while, repetition starts to look like validation.

## Moving targets

This has always happened on social networks, but AI makes the effect much stronger because the technology changes so fast that almost nobody has deep, long-term experience with all the things they are talking about.

We are all testing moving targets. Models change, tools change, workflows change. Something that looked fragile six months ago may work well today, while something that looks impressive after two days can still become a maintenance problem after six months.

The problem is that social media removes most of that time dimension. A pattern noticed on Monday can become a best practice by Friday.

## When the opinion becomes a repository

Vibe coding adds another layer, and this is where the issue becomes more concrete.

Until recently, a weak technical idea could spread as an opinion, but turning it into software still required enough work to slow things down. Somebody had to design it, write the code, debug it, package it and maintain it. That friction did not guarantee quality, but it did filter out a lot of things before they became reusable software. Now that filter is getting much weaker.

Someone can see a claim on X, understand half of it, agree with the conclusion, and build a working open source tool around it in a weekend. At that point the distortion is no longer only in the feed. It has become software.

And software has a different kind of authority. A repository feels more concrete than a post. A demo looks like proof. A polished interface makes an idea look more mature than it may actually be. Then other people find the repository, try it, fork it, integrate it, and the activity around the tool starts reinforcing the idea that produced it.

> The original claim creates software, the software creates visibility, and the visibility makes the original claim look more credible.

That feedback loop is what interests me. Not because people suddenly became worse engineers. Quite the opposite. Vibe coding lets people build things they could never have justified building before, and a lot of that experimentation is genuinely useful.

## Cheap code, expensive understanding

The problem is that **the cost of implementation is falling much faster than the cost of understanding.**

You can build a tool in an afternoon. Knowing whether the abstraction is useful, whether it survives real users, whether it behaves well at scale, whether it becomes expensive to maintain, or whether it still makes sense after the underlying model changes still takes time. The code can arrive almost immediately. Judgement cannot.

This also changes the meaning of producing something. A lot of people now want to build, partly because building has become accessible enough that the act itself is attractive. That is not bad in itself, but it means the existence of a tool tells you less than it used to. A repository can represent months of serious work, or a weekend experiment with a good README and a nice interface. From the outside, the difference is not always obvious.

## An ecosystem that validates itself

Open source is especially exposed to this because discovery already depends heavily on social signals. A project gets some attention because the idea behind it is already circulating. That attention brings users, forks and integrations. Then someone else sees all that activity and assumes the underlying idea must be solid. At some point the ecosystem starts to validate the assumption simply because the ecosystem exists.

This is where I think the herd effect becomes more important than the usual discussion about AI-generated low quality content. The issue is not AI producing bad content. **The issue is that weak or incomplete technical consensus can now turn into executable artefacts almost immediately.**

That makes it much harder to distinguish between something that is popular, something that is interesting, and something that has actually been validated.

## The conditions are the interesting part

The difference matters a lot in areas where nobody has much historical experience yet. Agent frameworks, testing strategies, retrieval architectures, MCP patterns, memory systems and orchestration layers are all changing quickly enough that strong conclusions age badly.

Still, every week there is a new absolute position. Frameworks are suddenly the problem. Then they are necessary again. Retrieval is dead, then everybody is using it under another name. AI-written tests are useless, then someone shows a workflow where they are extremely effective.

Usually the interesting part is in the conditions. Those are exactly the parts that disappear as the idea moves through the feed. Then vibe coding gives the simplified version a codebase.

That creates a practical problem even for experienced engineers, because ignoring all of this noise is not an option. Some genuinely useful ideas emerge from the same environment. I have found good tools and better workflows through people experimenting publicly. The difficulty is that **visibility and quality are becoming less correlated.**

## What still takes months

The only thing that still seems expensive is operational experience. You only learn certain things after real use, after maintenance, after failures, after seeing what happens when the original author is no longer the only person who understands the system.

That takes months. The social cycle takes days. By the time someone has enough experience to answer the important questions properly, the conversation may already have moved through several new fashions.

This is probably the part I find most uncomfortable about the current phase of AI software. We have made creation extremely cheap, but judgement is still expensive. And now the output of that cheap creation can feed directly back into the social system that produced the original idea.

The herd does not just repeat the message anymore. It can build on top of it, package it, publish it and turn it into something that looks established before the underlying assumption has really been tested.

## What we treat as evidence

I would not want to give up the speed of experimentation. That part is valuable. But I think we need to become much more careful about what we treat as evidence:

- A tool can work and still be based on a bad assumption.
- A demo can be impressive and still tell us very little about long-term use.
- A repository can be popular because it solves a real problem, or because it arrived at the right moment in the right conversation.

The distinction only becomes clear later, when the hype is gone and the software has had to survive reality. That part has not become faster.
