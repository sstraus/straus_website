---
title: Building Software Without Writing It First
date: 2026-01-01
tags: [ai, development, llm, vibe-coding]
---

# Building Software Without Writing It First

**Twelve Months Inside AI-Driven Development**

Over the past year, I have been building software without following a traditional code-first development path. Not by abandoning programming, but by shifting focus from writing code to observing and shaping systems as they are being built.

This is not about replacing programming skills, but about changing where leverage comes from.

## The Beginning

With the rise of modern large language models, I immediately saw the potential and started exploring what is often referred to as *vibe coding*.

This space is evolving rapidly. Initially, it was primarily helpful in analyzing or refining small scripts and workflows. Today, it is mature enough to support significantly more complex systems.

## How I Work Now

I now work almost entirely from the terminal. Every project starts from a concrete need, not from an academic exercise. I spin something up, grow it quickly, test it, and inevitably break it. Real learning happens precisely when something stops working. Errors reveal what I do not yet fully understand, not what I am incapable of doing.

I no longer write most code by hand. Instead, I work through a large number of prompts of varying complexity, switching between models such as Sonnet and Opus depending on the task and cost constraints.

The goal is not syntax, but understanding how pieces fit together:

- Data flows
- Dependencies
- Failure points
- Implicit conventions

Carefully reading the generated output is often more educational than writing code manually. Over time, patterns emerge, become reusable, and differ meaningfully depending on the model in use.

## Tools and Models

Anthropic is the leader here—very expensive but absolutely the way to go for reliable results. But keep an eye on the evolution of models and tools. I changed many times in the last year because every week we have a discovery, a new MCP, or a new IDE that performs way better than the others. Now I'm with Claude Code, but tomorrow who knows?

## What I've Built

During this period, I have built a wide range of things:
Personal tools, Small internal products, Analytical systems, Automations, Interfaces, Prototypes to a full application layer that one of my teams is now adapting for production readiness

Some of these projects reached production. Others were abandoned without hesitation. **Fast discard is part of the process.** The value is not the artifact itself, but the understanding accumulated along the way.

## The Method

The method is consistent:

1. Start with a vague idea
2. Clarify it by asking questions
3. Define what must exist and what must not
4. Let the system take shape
5. Intervene only to correct direction, not to micromanage
6. Force the LLM to test, observe, and iterate

Each project improves the next. Successes are recorded and documented as they happen. In practice, the LLM handles most of this automatically, making the process fast and low-friction.

## What Matters Most

Over time, it became clear that **discipline matters more than raw technical skill**. Essential elements include:

- Repeatable rules
- Clear conventions
- Automated tests
- Configurations that persist across projects

Not to follow best practices dogmatically, but to avoid repeating the same avoidable mistakes.

This approach enables work from anywhere. The boundary between writing code and using software becomes increasingly blurred. The system responds, adapts, and is guided. I focus on outcomes, not on syntax.

## A New Abstraction Layer

Rather than learning a new language, I am learning a new abstraction layer.

In the past, this was no-code: visual tools connected together with minimal code to glue logic. Today, it is interaction with systems capable of building other systems. The core skill is not memorizing rules, but:

- Framing problems
- Providing context
- Recognizing sound solutions

I moved from small projects with a few hundred lines of code (translators, productivity tools) to a multi-backend data abstraction layer spanning an aggregate of **more than four million lines of code** (tests included).

## Continuous Learning

Following how the community of engineers working with LLMs evolves accelerates everything. Reddit, Discord, and X are my sources of knowledge, and I spend at least one hour a day to keep up the pace.

Studying open source software, taking it apart, adapting it—this challenges the assumption that complex architectures are always necessary. **Simplicity works more often than expected.** (KISS is my opening prompt every time)

In many cases, solutions proposed by LLMs exceed what I have learned over decades of experience. New patterns, approaches I would not have considered, or would not have explored due to time constraints. Entire stacks assembled in hours instead of weeks. Not perfect, but already beyond what all my teams could realistically produce in the same timeframe.

## Language Agnostic

The choice of programming language is no longer a limiting factor.

Initially, I tried to stay within languages I knew well: C#, TypeScript, and Python. Eventually, it became clear that the language should serve the goal, not my prior familiarity.

You do not need to master every nuance of a language, but you do need to understand how systems evolve and which patterns tend to fail. From there, selecting the right language for the product matters more. This is how I transitioned to Go and Rust, reaching strong productivity within weeks of focused practice.

## Embracing Errors

I am not building large-scale, mission-critical infrastructure. Errors are acceptable and often necessary. Each bug exposes a boundary of understanding and suggests how to avoid it next time. Even seemingly trivial concepts only become obvious when you collide with a real constraint.

The key is being explicit about style and expectations—not only in terms of results, but also in how those results should be achieved.

## Practical Strategies

This way of working is fundamentally different from traditional programming education. It does not start from abstract exercises, but from real systems. Anyone already familiar with architectures, workflows, and products will find immediate leverage.

Key practices:

- **Continuous testing** – Test-driven development is critical for long-term sustainability
- **Logging everywhere** – The primary way an LLM can observe application behavior and apply corrective actions
- **Start monolithic** – A monolithic architecture that can be decomposed later often works best
- **Hexagonal architecture** – This was a major turning point for me

Once you establish your own working framework, no software feels unreachable. You can prompt it, test it, break it, and understand it. Naive questions are not a weakness. They are the engine of progress when there is no external judgment.

## What This Is

This is not improvisation, and it is not classical programming either. It is a new form of technical competence that does not yet have a precise name. It does not require perfection, only curiosity and tolerance for failure.

The process feels closer to play than to formal study. Rapid exploration, low cost, constant experimentation. Ideas do not need to be good to be useful. They only need to exist long enough to teach something.

Learning, in this context, means building beyond your current capability and accepting failure before trying again. You just need to pick a system, use it seriously, and stop searching for the perfect one.

## Conclusion

In the end, what matters is reducing friction between an idea and its realization. Everything else is noise.

**Plan, fail, understand, repeat.**

That is how I am relearning how to work with code.

*Originally published on [Medium](https://medium.com/@stefanostraus/building-software-without-writing-it-first-59cf6c71337b).*
