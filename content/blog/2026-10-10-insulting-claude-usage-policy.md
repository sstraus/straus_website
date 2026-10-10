---
title: "Insulting Claude Is Now a Usage Policy Question"
date: 2026-10-10
tags: [ai, claude, anthropic, privacy, policy]
---

# Insulting Claude Is Now a Usage Policy Question

Anthropic has added a rather unusual clause to its Usage Policy. Starting November 12, users are not supposed to engage in sustained or gratuitously abusive behaviour toward Claude, and the target here is not other users but the model itself. Anthropic is careful with the definition: getting frustrated is fine, criticising the model is fine, and even losing your temper once in a while is apparently fine. What the policy targets is repeated abuse without a useful purpose, and Claude can already end a conversation when it decides that this is what is happening.

I laughed when I read it, partly because we have reached the point where paying customers need behavioural rules for how they talk to software, but mostly because the rule did not arrive in a vacuum.

## The context the policy arrived in

The frustration around the Opus releases before 5.5 is easy to document. A Reddit thread describing Opus 5 as "almost rage-inducing to use" collected more than 1,300 votes, and other highly upvoted discussions complained about Claude arguing with instructions, refusing straightforward tasks, becoming needlessly verbose and generally turning work into a negotiation.

That matches my own experience quite closely. I use several models every day and I don't remember seriously losing my temper with Codex or ChatGPT, because when they fail, and they sometimes fail badly, the interaction still feels like a tool failing at a task. With Opus across the 4.7, 4.8 and 5 generations I did lose my temper, and more than once. The problem was rarely intelligence. Opus could produce excellent work and then spend the next twenty minutes arguing about a perfectly reasonable instruction, explaining why it should not do something, quietly changing the scope of the task, or repeating the same mistake while wrapping it in increasingly elaborate explanations.

This gets much worse when Claude works as an agent. You may be hundreds of tool calls into a coding session, with a large context, a dozen modified files and real money being consumed, and at that point an agent that decides to negotiate instead of executing is not a minor annoyance, because it burns time, tokens and context that you cannot get back.

Then Opus 5.5 arrived and the tone changed almost overnight. A "Claude is BACK!" thread passed 1,600 votes and another one calling 5.5 "actually peak" collected more than 800. What struck me in the comments is that people were not mainly celebrating a smarter model. They were celebrating a model that had stopped fighting them, one that was more collaborative and simply less annoying to work with, and I have to say that my experience with 5.5 has been the same.

So the sequence is fairly visible. Anthropic shipped models that generated an unusual amount of user frustration, the community complained loudly, 5.5 fixed most of the behaviour people were complaining about, and only then, with users finally happy again, did a rule appear telling them not to abuse Claude. The rule is not a response to the current model, because the current model is the one people are praising. It reads much more like insurance, written at the one moment when nobody is angry, so that it is already in place when the next release turns out to be another epic fail and the insults start flying again. Which, to be fair, is good release planning.

Meanwhile xAI is standing on the other side of the room with a "hold my beer" expression. Grok's personality is deliberately informal and provocative, and it is much more willing to follow the tone of the user, so while Anthropic keeps drawing boundaries around how humans should treat Claude, Grok will probably just insult you back. These are two very different ideas about the relationship between people and software, and I don't think either company arrived at its position by accident.

But the policy is not interesting because somebody wants us to be nicer to Claude, since Claude does not care. It becomes interesting when you ask how Anthropic knows that I am abusing it.

## Someone has to classify the conversation

This obviously does not mean that someone at Anthropic is reading conversations and deciding whether Stefano has been too mean today. It can be fully automated, with a classifier inspecting the interaction, assigning categories and producing safety metadata without any human ever looking at the text.

Where the joke started to turn into something else was when I read Anthropic's own privacy documentation. For consumer accounts, Anthropic states that conversations flagged by its safety systems can be analysed and used to improve those systems, including training the models that detect and enforce Usage Policy violations, and that this process is separate from the usual choice about letting your conversations improve Claude. That distinction matters more than it looks, because turning off model training does not necessarily mean that nothing from your conversations ends up in training. If an interaction is classified as a safety issue, it can enter a different pipeline and contribute to a different model.

To be precise, Anthropic does not say that these conversations are used to train Claude itself, and training a safety classifier is not the same thing as training Opus. From the customer's side, though, the boundary is much less obvious than the settings page suggests. I tell the provider that I don't want my conversations used to improve its models, the provider classifies one of those conversations against its own policy, and that interaction can still become training material for the system that enforces the policy. Technically different, operationally quite relevant, and more so now that the policy covers how I talk to the model and not only what I ask it to do.

## Retention gets interesting too

According to the same documentation, inputs and outputs flagged for Usage Policy violations may be retained for up to two years, and safety classification scores for up to seven. There are perfectly good reasons for this. A provider needs to deal with fraud, malware and exploitation, and nobody can run these systems at scale without observing enough of the platform to enforce its rules.

What interests me is where the boundary now sits. We are no longer only talking about someone asking Claude to write malware or help with fraud, because certain ways of talking to Claude are themselves prohibited behaviour. So what happens when that classifier fires? If I call Claude an idiot ten times because it keeps destroying the same function, is that treated like any other Usage Policy violation, can it trigger the extended retention, can it become training material for the safety system, and how much of the surrounding conversation has to be kept to prove that the behaviour was sustained and not a single outburst? Anthropic describes the general mechanisms, but I have not found an equally clear explanation of how this new category flows through them, and that seems worth knowing.

## Zero Data Retention is not quite zero

The enterprise side adds another layer. Anthropic offers Zero Data Retention arrangements to eligible API customers, but ZDR does not automatically cover every Claude product and feature, and even under ZDR Anthropic states that it keeps UserSafety classifier results for Usage Policy enforcement. That does not mean the original prompt is secretly stored, since a classifier result is not the conversation that produced it. It does mean that "zero" refers to specific categories of data and not to the literal absence of anything derived from the interaction.

For a company sending source code, internal documentation, customer data or proprietary business context into these systems, the question is no longer just whether the provider trains on its prompts. There is the main model, the safety models, the classifiers, policy enforcement, logging, derived metadata, possible human review, different retention periods and different contractual terms depending on which Claude product is actually in use, and the training opt-out switch describes only one corner of that picture.

## The training angle

There is one more angle that Anthropic does not mention, so what follows is speculation and I want to label it as such. User frustration is potentially very useful training data. Take a message like "I asked you three times to change this function and you keep doing the opposite", strip the insult around it, and what is left is an unusually clean signal: there was an instruction, the model ignored or misread it, the user corrected it, the model failed again, and eventually the user reacted with a strong negative signal that no thumbs-down button would ever capture with the same intensity.

> If thousands of users independently get angry when a model shows the same behavioural pattern, the anger stops being noise and becomes a measurement of the model.

None of this proves that the policy exists to improve training, and there is no public evidence for that causal link. I still find the data angle much more plausible than the idea that Anthropic suddenly became worried about Claude's emotional wellbeing, because Claude has no emotional wellbeing, while Anthropic does have a model to improve, safety systems to train and a platform to operate, and it now also has an explicit category for identifying sustained abusive interactions with that model.

## The funny part hides a more serious one

There is something genuinely absurd about paying for a model, getting angry because it refuses to do what you asked, insulting it, and then discovering that insulting the software may itself break the provider's rules, all while another major lab builds a model that would happily insult you back. Underneath the comedy, though, there is a real question about how AI privacy is changing.

We still tend to think about it in binary terms, with training either on or off and data either retained or deleted, while the actual systems are becoming much less binary. A conversation can disappear while metadata derived from it remains, content can be excluded from general training while a flagged interaction still feeds a safety model, and different products from the same provider can follow completely different retention rules. And now the behaviour being classified extends beyond what we ask the AI to do and into how we behave toward it.

Anthropic is entitled to decide what behaviour it accepts on its platform, and I am equally entitled to ask what exactly happens to my conversation when Anthropic decides I crossed that line. In the meantime I will try to be nicer to Claude, which has become a lot easier since 5.5 stopped giving me reasons not to be. I would just feel more reassured if the effort spent on preparing for the next epic fail went into making sure it never ships.
