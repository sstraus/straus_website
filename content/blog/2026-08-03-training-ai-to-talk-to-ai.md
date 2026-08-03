---
title: "Are We Training AI To Talk Only To Other AI?"
date: 2026-08-03
tags: [ai, llm, training, rlhf, product]
---

# Are We Training AI To Talk Only To Other AI?

One thing has been bothering me lately when using the newest coding models.

The more capable they become at solving technical problems, the less enjoyable they become to work with.

I'm not talking about benchmark scores or reasoning ability. I'm talking about the interaction itself. Explaining a problem, asking for refinements, exploring alternatives. That part increasingly feels mechanical. Sometimes the answer is technically correct, but surprisingly difficult to read. Other times it is so compressed that understanding the reasoning requires almost as much effort as solving the problem yourself.

I don't think this is an accident.

## What human feedback actually encoded

For years, frontier models were heavily trained with specialized human feedback. Expert reviewers were not only checking whether an answer was correct. They were also choosing which response was clearer, more natural, and simply more pleasant to read. Style was part of the optimization target, not just factual accuracy.

The mechanism behind that has a name. RLHF, reinforcement learning from human feedback, works by showing people several candidate answers to the same prompt and asking which one they prefer. Those comparisons are not fed to the model directly. They train a second model, the reward model, which learns to predict what a human would have chosen, and it is that reward model which then guides the reinforcement learning of the assistant everyone actually talks to. The interesting part is what ends up encoded in those preferences. When a reviewer picks one answer over another, they are rarely rewarding correctness alone, because both candidates are often correct. They are rewarding rhythm, structure, the willingness to explain a step instead of skipping it, the choice to say something twice in different words because the first phrasing was dense. All of that gets compressed into the reward signal, invisible but very much present.

That process was expensive, but it produced models that felt collaborative.

## When the reviewer became a model

Today, human feedback has not disappeared, but its relative weight has clearly changed. As models become stronger and cover increasingly specialized domains, it becomes harder and harder to rely on humans for large-scale supervision. You cannot hire world-class experts for every discipline, nor can you ask reviewers to evaluate millions of highly technical conversations.

The result is that more of the optimization is delegated to automated techniques. Models evaluate other models, reward models rank candidate answers, synthetic data becomes a larger part of the training corpus, and reinforcement learning increasingly optimizes for objectives that are easy to measure automatically. Correctness scales. Readability is much harder to quantify.

Each of those techniques has a name, and they are worth knowing, because every one of them moves a little more of the judgment away from people. RLAIF, reinforcement learning from AI feedback, keeps the exact structure of RLHF and simply replaces the human annotator with another model deciding which of two answers is better. Constitutional AI, introduced by Anthropic, goes further and has the model critique and revise its own responses against a written set of principles, so that a large part of the alignment work happens with no reviewer in the loop at all. Preference models and reward models can now be trained on human labels, on AI labels, or on any mixture of the two, and once your reward model is good enough, producing more training signal becomes a question of compute rather than headcount. Synthetic data closes the circle, with models generating the corpus that trains the next generation of models, sometimes the next version of themselves.

That trade-off is starting to show.

## Why coding shows it first

Coding is where it surfaces most clearly, and the reason is a technique called verifier-based reinforcement learning. Instead of asking anyone which of two answers reads better, you run the code. The tests pass or they do not, the proof checks or it does not, and the reward comes from an automatic verifier rather than from a preference. This is a genuinely powerful idea, and it is a large part of why coding and mathematics have improved so quickly over the last two years. It is also completely blind to how the answer is written. A solution that passes every test as a wall of dense, unexplained code scores exactly the same as one that walks you through the reasoning, so the pressure that used to push models toward clarity is simply no longer part of the objective.

I notice it with Opus 5, and I see the same tendency with Sol. They often produce answers that are technically solid, but sometimes cryptic. They optimize for precision more than communication. It feels as if the model assumes its reader already thinks like another language model.

From a research perspective this is understandable. It is much easier to measure correctness than readability. But from a product perspective, the interaction itself is the product. If talking to the model becomes frustrating, higher benchmark scores will not fully compensate.

There is another risk that is easy to overlook. As more synthetic data is generated by models and then used to train future generations, the language itself may slowly drift away from the way humans naturally explain concepts. The optimization target slowly shifts from communicating well with people to communicating efficiently with other models.

This is not just about tone. Humans often prefer explanations that are redundant, progressive, and intuitive. Models, on the other hand, naturally converge toward language that is denser, more compressed, and optimized for information transfer. Those are not always the same thing.

## When the judge is also a model

There is one more aspect that worries me.

Increasingly, models are not only trained by other models, they are also evaluated by other models. Synthetic data generates new synthetic data, reward models score candidate answers, automated evaluators measure quality, and even many benchmarks are judged by AI.

LLM-as-a-judge is now standard practice, in research papers and in industrial pipelines alike. You take a strong model, hand it a rubric, and let it score thousands of responses that no realistic team of humans could ever review. Self-play and self-training close the loop tighter still, with the model generating problems, solving them, checking its own work, keeping whatever survives the check, and training on the result. Every one of these techniques is defensible on its own terms, and most of them are not optional if you want to keep improving at this pace. The concern is not any single one of them. It is what happens once you stack them, and the entire chain from training signal to evaluation ends up made of language models judging language models.

This makes perfect sense from a scalability perspective. Human evaluation is expensive, slow, and difficult to standardize.

But it also creates an interesting risk. When both the teacher and the judge are language models, they naturally optimize for what other models consider a good answer. Human preferences become just one signal among many instead of the primary objective.

Communication may slowly drift toward something that is optimal for machines rather than intuitive for people.

If that happens, we may continue to improve benchmark scores while making the everyday experience of using these models progressively worse.

That would be a strange outcome. After all, language models are not built to communicate with other language models. They are built to communicate with us.

That is not where we want to end up.

## What is worth measuring

This is why I think conversational quality deserves renewed investment. Not because users want friendlier chatbots, but because clarity is part of intelligence. A model that explains complex ideas naturally is often more valuable than one that is marginally better on a benchmark but significantly harder to understand.

OpenAI understood this surprisingly early with GPT-3.5. Looking back, one of its biggest strengths was not raw capability. It was simply pleasant to talk to.

That was RLHF doing exactly what it was designed to do, with an enormous amount of human judgment about what reads well compressed into a reward model, at a moment when nobody had found a cheaper way to get there. Everything that has replaced it since is better at almost everything, except that one thing.

Perhaps that is a direction worth investing in again. A model that no one enjoys talking to is not a smarter model. It is just a harder one to use.
