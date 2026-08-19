---
title: "When More Precise AI Feels Less Clear"
date: 2026-08-19
tags: [ai, llm, claude, comprehension, evaluation]
---

# When More Precise AI Feels Less Clear

For many people, Opus 4.6 became the most understandable, friendly and versatile version of the model. It was not only capable. It could move from code to research to an ordinary conversation without making every exchange feel like a technical report.

Then 4.7 arrived, followed by 4.8, and the perception began to change. The models were still strong, often stronger, but many people felt that something was fading. Answers became denser. More qualifications appeared. More context was preserved. The information was there, yet the explanation sometimes became harder to hold in your head.

It is tempting to turn that into a simple story about a good model getting worse. I do not think that is the interesting question.

The sharper question is whether Opus became more precise and informative until it crossed the point where additional context stopped helping the human reader.

## Understanding is successful compression

A good explanation is not the one that contains the most information. It is the one that leaves the right model in someone else's mind.

That requires compression. The reader needs enough causal anchors to understand what happened, the details that disambiguate those causes, and the context placed exactly where it becomes useful. Everything else competes for working memory. Even a true detail can make an explanation worse when it arrives too early, repeats a point already understood, or forces the reader to keep another branch of the story alive.

The practical test is not whether every fact was visible on the page. It is whether, after one reading, the reader can retell the event and predict what happens next.

For a duplicate payment, that mental model is compact. The first charge succeeded. Its response was lost. The timeout was therefore ambiguous, not proof of failure. The application retried without an idempotency key, so the provider treated the retry as a new request and charged again. Reusing one key for the same logical payment would have turned that retry into a replay of the saved result instead.

There are more details behind the policy, and some are necessary. The request fingerprint matters. Conflicts matter. Retention matters. But understanding comes from attaching those details to the causal skeleton, not from presenting every available fact with equal weight.

That is what I mean by successful compression: not less information by default, but the right information surviving the trip into another person's head.

## What the benchmark actually found

I tested this with one synthetic duplicate-payment incident. Four Opus versions answered it five times each, producing 20 responses in total. The audience was a backend developer who understands HTTP but is new to distributed systems.

The first two evaluation rounds used the same blinded rubric and independent scoring. For the third round I deliberately changed the method. Instead of asking for another set of absolute scores, I compared responses in blind pairs and separated three decisions: which better supported reconstruction of the incident, which was more economical, and which had the best overall balance.

That distinction matters because a repeated method can reproduce its own assumptions. A changed method gives the result a chance to fail differently.

The visible length trend was unambiguous. Opus 4.6 averaged 451 words, 4.7 averaged 543, 4.8 averaged 687, and Opus 5 averaged 951. The newest response was, on average, more than twice as long as the 4.6 response to the same incident.

In the machine-verifiable benchmark record, 4.7 won the overall-balance ranking. It combined strong coverage with substantially better economy than 4.8 or Opus 5. Opus 4.6 was the shortest and strongest on economy. Opus 4.8 and Opus 5 performed better on the reconstruction proxy, but they did it at much greater length.

The pairwise comparisons make the tension unusually visible. When the overall-balance decision was decisive, the selected response averaged 241 fewer words than the rejected one. When the reconstruction decision was decisive, the selected response averaged 273 more words.

The automated reviewer more often preferred the longer response for reconstruction. It preferred the shorter response for overall balance. Both can be true.

**[Read the full benchmark report](https://opus-clarity-gap.stefano150390.chatgpt.site)**

What cannot be concluded is equally important. This does not prove that 4.7 is more comprehensible to humans. It does not prove a general decline across Opus versions. It is one incident, five responses per version, and machine-mediated evaluation. The benchmark measures stable properties of these responses and useful proxies around them. It does not measure what remained in a person's memory after reading.

## Why automated evaluation likes visible detail

Checklist evaluation has a structural preference. It can reliably reward what is present.

Did the answer explain that the first charge committed? Did it mention the lost response, the ambiguous timeout, the reused key, the fingerprint conflict and the retention window? Each visible detail creates evidence that a judge can detect. Missing one creates an obvious deduction.

Surplus is harder to score. A paragraph can be accurate, relevant and still make the explanation more difficult by competing with the central causal chain. The cost appears in the reader's attention, not in a missing checklist item. Unless the rubric measures that cost directly, completeness has a clearer path to reward than restraint.

This is not a defect unique to AI judges. Human reviewers using a checklist can behave the same way. The difference is scale. Once evaluation becomes automated, visible coverage can be rewarded millions of times, consistently and cheaply. The system learns that saying one more correct thing is safer than deciding which correct thing the reader does not need.

The result can look like improvement from the evaluator's side and feel like deterioration from the user's side.

## The case for 4.6

My interpretation is that 4.6 may be more comprehensible precisely because it selects the right details.

That is not what the reconstruction proxy ranked highest, and I am not replacing the measured result with my preference. I am separating two claims. Longer answers gave the machine judge more material from which to reconstruct the incident. A human reader may still build the same mental model more reliably from a shorter answer with fewer competing details.

At 451 words, 4.6 was not terse. It had room to explain the commit, the lost response, the ambiguity of the timeout and the retry policy. Its advantage was not that it said almost nothing. It was that it had less opportunity to make secondary context compete with the mechanism that mattered.

This is the point automated scoring can easily miss. Selection is part of intelligence. Knowing a fact is useful. Knowing that this reader does not need it yet is also useful.

More detail can therefore raise machine-scored completeness and lower human clarity at the same time. There is no contradiction. The two measures are observing different costs.

## A hypothesis, not a cause

Earlier this month I asked whether we are training AI to communicate with other AI. This benchmark does not answer that question, but it gives the concern a more precise shape.

If training and evaluation increasingly depend on rubrics that detect explicit coverage, models have an incentive to produce text that makes every criterion easy for another model to find. That could gradually shift communication toward machine-legible completeness: more named concepts, more qualifications, more restatement and fewer decisions about what to leave implicit.

It is a plausible hypothesis and a useful direction for research. It is not a proven explanation for the differences between these Opus versions. The benchmark cannot identify training data, reward design or the causes of model behavior. Product tuning, system prompts, inference changes and ordinary sampling variation could all matter.

The responsible claim is narrower. Our current evaluation methods can reward the same visible detail that makes an answer harder for a person to absorb. If those methods influence training, a drift toward rubric-detectable coverage is possible. We should measure it instead of turning it into a story we merely find convincing.

## The next benchmark needs people

The next step is not a more elaborate checklist. It is a human comprehension study.

Give people one response, remove it, and ask them to retell why the duplicate happened. Ask them to predict what the system should do when the same key returns with the same fingerprint, and what should happen when the fingerprint changes. Measure what they remember, what they misunderstand, how confident they are, and how much mental effort the explanation required.

Recall, retelling, prediction, confidence and cognitive load are closer to the thing we actually care about. Checklist presence still matters because an elegant explanation that omits the remedy is not a good explanation. But presence is the input. Understanding is the outcome.

If a reader can reconstruct the mechanism and use it correctly after one reading, the explanation worked. If every fact is present but the reader cannot tell the story back, it did not.

The best AI response may not be the one that says the most. It may be the one that knows what the human mind can safely leave behind.
