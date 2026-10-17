---
title: "Open Source, But Not If You Use AI"
date: 2026-10-17
tags: [ai, open-source, licensing, coding-agents, legal]
---

# Open Source, But Not If You Use AI

Some developers are starting to publish software under licences that prohibit the use of AI coding tools to modify it. Not just restrictions on AI training, but restrictions on the development process itself. You can read the source, fork the repository, modify it manually, and distribute commercial derivatives. But using Claude Code or Codex to make those modifications may violate the licence.

This is an unusual direction for open source. Two developers can produce exactly the same modification, but only one may be allowed to distribute it, depending on whether AI participated in the development. The restriction concerns how the software was produced rather than what the software does.

## When the development tool becomes a licence condition

The experimental DT-HumanDev License starts from the MIT model and introduces restrictions on AI-assisted development. It preserves permissions for commercial use, redistribution, and human-written modifications, while prohibiting AI systems from producing modifications or derivative implementations.

The practical distinction is quite specific.

| Development activity | DT-HumanDev |
|---|---|
| Read and study the source code | Allowed |
| Use the software commercially | Allowed |
| Fork and modify the repository manually | Allowed |
| Distribute human-developed derivatives | Allowed |
| Use AI to develop an application depending on the library | Allowed |
| Use Claude Code or Codex to modify the licensed library | Prohibited |
| Ask AI for specific instructions to modify the library manually | Prohibited |
| Use AI to identify and correct security vulnerabilities | Allowed within the security exception |
| Create a genuinely independent implementation | Not automatically covered |

If I use a DT-HumanDev library through its public API, an agent can still develop the surrounding application. But asking Codex to modify the library itself is prohibited. Even requesting project-specific instructions from an AI and then implementing them manually can fall within the restriction.

The licence also includes an exception for identifying and correcting security vulnerabilities, provided the modifications remain limited to remediation. An agent may therefore be allowed to change a function to fix a vulnerability but not to optimise its performance.

The author describes the licence as experimental and acknowledges uncertainty about its enforceability. Its development has also involved testing how AI agents interpret licensing restrictions. Earlier wording reportedly addressed AI systems directly, creating potential conflicts with prompt injection protections. Later revisions shifted the restrictions towards the people operating the agents.

This distinction matters because an agent recognising a restriction and a court enforcing that restriction are separate issues.

## Not all anti-AI licences restrict development

The AI Use Restriction Addendum takes a different approach. It adds restrictions to existing licences, targeting AI training and certain uses of software within AI-enabled products rather than the tools used to develop it.

| Activity | DT-HumanDev | AI Use Restriction Addendum |
|---|---|---|
| AI-assisted modifications | Restricted | Not inherently prohibited |
| AI training on licensed code | Not the primary restriction | Prohibited |
| Integration into AI-enabled products | Generally allowed | Restricted |
| Commercial use outside restrictions | Allowed | Allowed |
| AI-assisted security remediation | Specific exception | Depends on the use |
| OSI-approved open source | No | No |

Under the addendum, using Codex to modify a conventional application may be permitted, while integrating the licensed library into an AI service could be prohibited even if the code was written manually.

The restrictions can extend to applications using external LLM APIs, agent frameworks, and RAG infrastructure, including internal applications. The addendum also addresses downstream distribution and licence termination following violations.

These licences therefore address different problems. DT-HumanDev attempts to control development methods, while the addendum restricts particular uses of software.

Neither qualifies as open source under the conventional Open Source Definition. Public source code is not sufficient. Open source also requires freedoms concerning modification, redistribution, and permitted uses.

They are more accurately described as source-available licences with additional restrictions.

## Can these restrictions actually work?

The difficulty with DT-HumanDev is that AI assistance is becoming increasingly integrated into development. Coding agents analyse repositories, review code, identify bugs, execute tests, and propose architectural changes. A developer can write every line manually while relying on AI to understand the implementation and decide what to modify.

Under a licence restricting project-specific AI assistance, even that workflow may become problematic.

Enforcement is another issue. There is no reliable general method for distinguishing human-written source code from AI-generated code. Similar implementations are common because software follows established algorithms, APIs, and technical conventions.

Proving a violation may therefore require development logs, repository history, contractual audit rights, or other evidence about the process rather than the resulting code.

The legal situation is also uncertain. Copyright protects the expression of software, not every idea or functionality it implements. An independently developed implementation does not automatically become a derivative work because it provides equivalent functionality.

A licence may impose contractual obligations beyond copyright permissions, but enforceability depends on its wording, jurisdiction, and the relationship between the parties. These experimental restrictions have not established a settled judicial interpretation.

The economic consequences may arrive earlier.

Companies already maintain processes for dependency scanning, licence compliance, and intellectual property risk. Adding restrictions on AI-assisted development means additional policies, potentially separate workflows, and controls preventing agents from modifying certain repositories.

Even if the legal validity of a restriction is questionable, managing that uncertainty has a cost. Given two comparable libraries, one under MIT and another restricting AI-assisted development, an organisation using coding agents may prefer the simpler option.

This could reduce adoption and external contributions to the very projects whose maintainers are trying to protect their work.

The motivation is understandable. AI makes it much cheaper to reproduce functionality, maintain forks, and build competing applications. But the underlying economic conflict existed before generative AI. Permissive licences have always allowed commercial exploitation and proprietary derivatives.

AI changes the cost of exercising those permissions. Restricting development tools does not necessarily solve the problem of funding open source maintenance.

It is also important not to confuse three different objectives. Preventing AI training, preventing AI-assisted development, and preventing commercial appropriation require different approaches. Prohibiting Codex from modifying a repository does not prevent a model from having been trained on its code, and prohibiting training does not prevent agents from modifying it using capabilities acquired elsewhere.

## The opposite approach, licensing AI-generated code

In March 2026, the AI-MIT License 1.0 was proposed for discussion within the OSI community. Instead of prohibiting AI development, it attempts to address copyright ownership when software is produced with different levels of human involvement.

| Code origin | Proposed treatment |
|---|---|
| Human-authored | Conventional copyright |
| AI-assisted with human creative contribution | Copyright for qualifying human contributions |
| Fully AI-generated without qualifying human authorship | No copyright claimed by the distributor |

The proposal is experimental and not an approved OSI standard, but it addresses a problem that existing software licences were not designed to handle.

Traditional licences assume someone owns copyright in the material and can grant permissions to others. With autonomously generated code, that assumption becomes less obvious.

In the United States, copyright generally requires human authorship. AI-assisted works may qualify when sufficient human creative contribution exists, while purely machine-generated material may not receive protection. Other jurisdictions may apply different rules.

Attaching MIT or GPL to fully AI-generated code does not automatically establish copyright ownership. A licence can express the distributor's intentions, but it cannot create rights that do not exist.

This creates questions about provenance, downstream licensing, and the legal status of AI-generated contributions. The AI-MIT proposal attempts to address them without restricting AI-assisted development.

## When the IDE needs to understand licences

There is another consequence for AI-native development environments.

Traditionally, licence compliance has been managed by developers and organisations. Tools identify licences and report conflicts, but an IDE does not normally decide whether someone is allowed to modify a repository.

Coding agents change this relationship because they can clone repositories, inspect source code, plan modifications, execute commands, and commit changes autonomously.

If a repository prohibits AI-assisted development, the agent may perform an operation that the licence attempts to restrict. Legally, responsibility remains with the people and organisations involved, but technically the agent is executing the modification.

An AI-native IDE could inspect licences before allowing agents to modify files and apply policies configured by the organisation. This would extend software composition analysis into agent execution policies.

The implementation would require some care. A licence might allow AI-assisted analysis while prohibiting modifications. Another might restrict training but permit development. Others may contain ambiguous provisions whose enforceability is uncertain.

There is also a security issue. A LICENSE file is repository content and must be treated as untrusted input. Instructions embedded in it should not automatically become commands for an agent, otherwise licensing text could become another prompt injection vector.

A separate policy component could interpret known restrictions and decide whether to warn, block, or request authorisation, without treating the licence text as executable instructions.

Whether this additional complexity becomes necessary depends on the adoption of these licences. For now, they remain experimental, but they introduce a problem that agentic development environments may eventually need to address.

## Where this leaves open source

Open source has always benefited from improvements in development tools. Compilers, code generators, static analysers, refactoring engines, and automated testing have progressively reduced the manual effort required to produce software.

AI represents a much larger increase in automation, particularly with agents capable of handling complex development tasks. But trying to preserve human involvement by prohibiting particular tools introduces a boundary that will become increasingly difficult to maintain.

The economic concerns behind these licences are understandable. AI reduces the cost of producing software, including derivatives and competing implementations. At the same time, maintaining reliable software, managing dependencies, addressing vulnerabilities, and supporting users still require resources.

That imbalance may become more important as coding agents improve. Companies may find it cheaper to maintain independent forks or replace dependencies rather than contribute to existing projects, making the sustainability of open source maintenance even more difficult.

I am not convinced that restricting AI-assisted development addresses this problem effectively. It introduces compliance costs, raises unresolved legal questions, and may discourage adoption without providing much protection to maintainers.

For now, these licences are experiments. Their long-term relevance will depend on whether developers adopt them, whether organisations are willing to accept their restrictions, and eventually how courts interpret them.

But they already expose a contradiction. We have spent decades building a software ecosystem around the freedom to study, modify, and redistribute code. Now that AI is making those activities dramatically cheaper, some developers are trying to restrict the tools used to exercise that freedom.
