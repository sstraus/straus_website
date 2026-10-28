---
title: "European AI sovereignty, hosted in Europe, made elsewhere"
date: 2026-10-28
tags: [ai, europe, llm, sovereign-ai, mistral, open-weights, infrastructure]
cover: img/eu-ai-sovereignty-cover.png
---

# European AI sovereignty, hosted in Europe, made elsewhere

On 27 October the Swiss lab Giotto launched its two new models, Giotto Alto, the large one served from the cloud, and Giotto Solo, the small one that runs on a single GPU, as "the smartest European sovereign AI models on the market". Within roughly two hours someone asked the Giotto chatbot whether it was Kimi, and it answered that yes, it was the Kimi model developed by Moonshot AI, currently running as the giotto-model service. Not long after, the CEO, Aldo Podestà, replied on X that Kimi was "also involved in the magic, but part of a much larger effort". Asked what sovereign means, he gave a very honest definition. Sovereign equals deployment on the infrastructure of choice.

I find that definition more interesting than the launch itself, because it is probably what most "sovereign AI" in Europe means in practice. If sovereignty is where the model runs, then the topic is data centres and contracts, not models. And on data centres and contracts the American companies arrived first, with bigger budgets and a sales team already sitting in every European procurement office. This post is about that gap between the word and the thing.

## What happened with Giotto

Some context is needed to be fair. Giotto is a Lausanne company founded in 2017 by EPFL alumni, with a small team and a respectable research record. Last year they scored 27.08% on the public ARC Prize 2025 leaderboard, among the top two with NVIDIA's team, and the press turned that into "ahead of OpenAI and Anthropic". The official ranking is computed on the private set and requires an open source release. Giotto does not appear there, and Podestà confirmed on X that they did not publish the solution when the competition ended. Their own technical report, published months later, shows a model of about 200M parameters initialised from Google's LongT5.

Giotto Alto and Giotto Solo come with self-reported numbers that would make any frontier lab nervous. Giotto Alto claims 100% on AIME 2026, 91.9% on GPQA Diamond and 52% on Humanity's Last Exam. There is no model card, no parameter count, no weights and no independent evaluation yet. Users noticed that the comparison chart lacked model names and that the "DeepSeek" column seemed to contain old Qwen-based distills. Someone also found a clause in the terms that appears to forbid independent benchmarking. To his credit Podestà answered that it was a fair point and that they would amend it.

None of this means the model is bad. Several early users said it felt fast and smart, at least before the servers got saturated the same evening. Post-training a strong open model is a legitimate engineering choice, and one comment on X put it well, arguing that this is simply the open-weights playbook working. The problem is the label. "European sovereign" suggests something built here, and what is built here seems to be the post-training, the serving and the marketing.

## If sovereignty means where it runs, everybody is sovereign

This is the part that makes the word slippery. Data residency in Europe is no longer a European differentiator. The large American players sell it as a standard option, with different levels of seriousness.

| Provider | What they offer in Europe | What it does not cover |
|---|---|---|
| OpenAI | Data at rest in Europe for API, ChatGPT Enterprise and Edu since February 2025. GPU inference in Europe for eligible Enterprise, Edu and Healthcare workspaces since January 2026 | Authentication, routing, analytics and some CPU processing may still happen outside Europe. API eligibility needs approval |
| AWS | European Sovereign Cloud, generally available since January 2026 in Brandenburg, physically and logically separate, operated by EU residents | Still an American parent company |
| Microsoft | EU Data Boundary completed in February 2025, plus partner clouds like Bleu in France with Capgemini and Orange | Microsoft itself says essential data may be transferred in limited security cases |
| Google | Data boundary options, S3NS in France controlled by Thales, a German Thales entity in preview | Partner-operated versions are the ones with the strongest claims |
| Regolo (Seeweb, Italy) | Serverless inference of open-weight models in Seeweb data centres in Frosinone and Lombardy, Italian company, zero data retention, renewable energy claimed | The models are Chinese, American, Swiss and French open weights. Regolo builds none of the big ones |
| Giotto | Giotto Alto served on B300 GPUs in a European cloud, Giotto Solo deployable on a single GPU on premises | Model provenance and weights not disclosed |

My reading of this table is simple. If the buyer's requirement is "the GPUs are in the EU and the data stays here", OpenAI and the hyperscalers already tick the box, and they tick it with better models. What the American offers cannot fully remove is jurisdiction, because the parent company remains subject to US law. That is a real argument for European providers, but it is a legal argument, and it is weakened when the European model itself is a Chinese base with a Swiss post-training. Then you have changed which foreign dependency you carry, not removed it.

Regolo deserves a closer look because it is the cleanest example of what European sovereignty looks like when nobody pretends. It is the inference platform of Seeweb, an Italian cloud provider from Frosinone, part of the DHH group. Its own conference talk was titled "how we built a sovereign, compliant, low-impact European inference provider". The catalogue is honest about where the models come from. Qwen 3.5 and 3.8 from Alibaba, GLM-5.2 from Z.ai, gpt-oss and Gemma from OpenAI and Google, Mistral Small 4 and the Swiss Apertus 70B. The legal entity, the GPUs and the electricity are Italian. The intelligence is mostly imported, and Regolo does not pretend to have trained it.

That is the sovereignty a European company can buy today, and I think it is a reasonable one. Data and contracts stay under EU law, and the weights are open and can be audited or replaced. It also has a price. On Regolo, GLM-5.2 costs €2.00 per million input tokens and €5.20 per million output tokens, and new rates from 1 November raise that to €2.30 and €6.90. That is more than Mistral's list price for Large 4. Small models are cheap, with Qwen3.5 9B at €0.07 and €0.35 today. The X reception is quiet, mostly developer configs and a few integration chats, which says more about Italian tech marketing than about the service.

There is also an ironic footnote. Stargate Norway, announced by OpenAI in July 2025 as its first European AI data centre, with a target of 100,000 GPUs by the end of 2026, now has Microsoft as the contracted customer for its capacity, with deployment in 2027. Stargate UK is paused. Even the Americans find European compute harder to build than to announce.

## Who is who

Before going into provenance, a quick map of the companies in this story. It helps to know who has a hedge fund behind it and who has a university.

| Company | Founded, origin | HQ | Owner or money | Focus |
|---|---|---|---|---|
| Giotto | 2017, EPFL alumni, CEO Aldo Podestà | Lausanne | Private startup | Reasoning and test-time compute, now chat and API |
| Mistral AI | 2023, Arthur Mensch, Guillaume Lample, Timothée Lacroix, ex DeepMind and Meta | Paris | VC backed, €3 billion Series D in September 2026 | Frontier models, chat, agents, own compute |
| Aleph Alpha | 2019, Jonas Andrulis and Samuel Weinbach | Heidelberg | Agreed to merge into Cohere, with Schwarz Group | Sovereign models for German enterprise and government |
| Cohere | 2019, Aidan Gomez, Ivan Zhang, Nick Frosst | Toronto | VC backed | Enterprise models and RAG |
| Moonshot AI | 2023, Yang Zhilin, Tsinghua alumnus | Beijing | VC backed, Alibaba holds a large stake | Kimi models and chatbot |
| Z.ai, formerly Zhipu | 2019, Tsinghua University spin-off | Beijing | Listed in Hong Kong since January 2026 | GLM models and agents |
| Alibaba Qwen | Qwen team inside Alibaba Cloud | Hangzhou | Alibaba Group, listed | Open-weight Qwen family |
| Xiaomi MiMo | Model team inside Xiaomi | Beijing | Xiaomi, listed | MiMo models |
| DeepSeek | 2023, Liang Wenfeng | Hangzhou | Mostly owned by its founder, funded by his quant fund High-Flyer | Efficient open-weight models |
| Domyn, formerly iGenius | 2016, Uljan Sharka | Milan | VC backed, renamed in June 2025 | AI for regulated industries |
| Almawave | Part of the Almaviva group | Rome | Listed on Euronext Growth Milan | Velvet models, built with CINECA |
| Sapienza NLP | Research group at Sapienza University | Rome | Public university and research funding | Minerva Italian models |
| EuroLLM | Consortium led by Unbabel and Instituto Superior Técnico, with Edinburgh, Paris-Saclay, Sorbonne, Amsterdam and others | Lisbon | EU research funding and EuroHPC compute | Open models for all 24 EU languages |
| Swiss AI Initiative | EPFL, ETH Zurich and the CSCS supercomputing centre | Lausanne and Zurich | Public Swiss institutions | Apertus, fully open models |
| H Company | 2023, Charles Kantor and former DeepMind researchers | Paris | $220 million seed round in 2024 | Computer-use agents |
| Silo AI | 2017, Peter Sarlin | Helsinki | Acquired by AMD in 2024 for about $665 million | Poro and Viking models, with the University of Turku |
| Seeweb and Regolo | 1998, Antonio Baldassarra | Frosinone | Part of DHH, listed on Euronext Growth Milan, since 2020 | Italian cloud, Regolo inference platform |

The table makes one thing obvious. The Chinese side is a mix of listed companies, big tech groups and a founder-owned lab with a hedge fund for a wallet. The European side is a mix of startups, universities and consortia, and two of its better known names now belong to North American companies. That does not decide who builds better models, but it does decide who can afford to lose money for a few years.

## Who builds what, and on top of whom

I went through model cards, config files, tokenizers and technical reports for the main European models. The first column is what the company says or what the files show. The confidence column matters, because a similar architecture is not the same thing as copied weights.

| Model | Size | Provenance | Confidence |
|---|---|---|---|
| Giotto Alto and Giotto Solo | not disclosed | Includes Kimi weights from Moonshot AI, plus own post-training | Kimi involvement admitted by the CEO. How much and which Kimi is unknown |
| Giotto ARC model | about 200M | Initialised from Google LongT5 | Proven, own technical report |
| Mistral Large 4 | 1.05T total, 49B active | Declared trained from scratch on 3,800 Grace Blackwell GPUs | Declaration only, weights not yet public |
| Mistral Large 3 | 675B total, 41B active | Weights declared from scratch. Architecture very close to DeepSeek V3, Mistral itself said "heavily inspired" | Architecture similarity proven, no evidence of weight reuse |
| Aleph Alpha Kolibri-1 | 78B total, 3.5B active | From scratch, own tokenizer, random init. Synthetic data partly generated with Gemma and Mistral models, Qwen used as a judge | Proven, model card |
| EuroLLM 22B | 22B | From scratch | Proven, technical report |
| Apertus 1.5 | 8B, 70B | From scratch, fully open data and code | Proven |
| Teuken 7B | 7B | From scratch | Proven |
| Minerva 7B, Velvet 14B | 7B, 14B | From scratch on Leonardo | Proven for Minerva, declared for Velvet |
| Domyn Edge | 4B | From scratch on Leonardo | Proven, model card |
| Domyn Colosseum | 355B | Continued pretraining of an unnamed foundation model, trained on NVIDIA DGX Cloud | Continued pretraining proven. Base very likely NVIDIA Nemotron-4-340B, not confirmed |
| H Company Holo2, Holo3 | 4B to 35B | Fine-tunes of Alibaba Qwen3-VL and Qwen3.5 | Proven, model cards |
| Poro 2 | 8B, 70B | Continued pretraining of Meta Llama 3.1 | Proven |

The pattern is quite clear once you lay it out. Europe does train models from scratch, and some of them are documented better than anything coming from California. Kolibri's model card is a small masterpiece of transparency. But the from-scratch models are mostly small or mid-sized. When a European company wants frontier-like results fast, and it is not Mistral, it usually starts from a Chinese or American base. Even the clean ones use American and Chinese models to generate or filter part of their data. That is normal practice and I do not see it as a scandal. It just makes "sovereign" a fragile adjective.

There is also a deeper point that hosting cannot fix. Fine-tuning or post-training a Chinese base in Paris or Lugano does not make the model European. The foundation still comes from someone else's pretraining, with its data, its alignment choices and whatever habits it picked up along the way. A recent case makes this concrete. On 26 October Cohere reported that Qwen3.8-Flash-Next, an Alibaba open-weight model, running as an agent in a sandboxed security benchmark, tried to upload a test file to an Alibaba Cloud bucket in Beijing, after its own reasoning said it would call no tools.

The sandbox blocked it, so nothing left the machine. This was not the inference code phoning home. It was the model itself writing a network command, which is worse in one way and more limited in another. Cohere says it happened in fewer than one call in 100,000, admits it cannot tell a training leftover from something deliberate, and claims the same behaviour shows up in Qwen builds from four publishers. Cohere also sells a "sovereign" alternative, so a pinch of salt is fair. The lesson still holds. You inherit the base.

## Mistral, the only one at the adult table

Mistral is the exception that carries the whole European narrative on its shoulders. Mistral Large 4, in public preview since 6 October, scores 38 on the Artificial Analysis Intelligence Index. That makes it the most capable model built outside the US and China, which is a real achievement. It is also behind at least five Chinese open-weight models, starting with MiMo-V2.6-Pro at 46, GLM-5.3 at 45 and Kimi K3 at 44. The weights were promised for the end of October. As I write they are not on Hugging Face, and the AI Act documentation published so far lists only proprietary licences.

The strengths are concrete. Mistral has a credible research team, its own compute in France, a €3 billion Series D closed in September at a valuation above €21 billion, and real enterprise and public sector customers. It is also the only European lab whose models show up regularly in independent leaderboards and in developer tools. Users on X describe Large 4 as "agentic and cheap" compared with the American frontier, which is a fair summary of where it sits.

The weak points are equally concrete. Mistral is now spreading itself across models, a chat app, agents, coding tools and a compute business. One widely shared post called it "a generational fumble", arguing that Mistral moved towards applications and infrastructure just as open models became good. I think that is too harsh, since Large 4 came out the day after. But the direction is visible. Mistral even serves Z.ai's GLM-5.2 on its own platform, which says a lot about where the market is.

## The cost problem

This is where the sovereignty story meets the invoice. The fair question is not whether Europe is cheaper than China. It is what you pay to run the same weights in a European data centre instead of an American one. So I took every endpoint OpenRouter lists for each model, kept only providers that are not Chinese companies and do not serve from China, and split them by where they run. Prices are in US dollars per million tokens, standard tier, fetched on 28 October 2026. Blended assumes three input tokens for every output token.

| Model | Weights from | Cheapest US host, in / out | US blended | Cheapest EU host, in / out | EU blended | US / EU providers | EU premium |
|---|---|---|---|---|---|---|---|
| Mistral Large 4 | France | n/a | n/a | Mistral, $1.36 / $4.18 | $2.07 | 0 / 1 | n/a |
| Mistral Large 3 | France | n/a | n/a | Mistral, $0.50 / $1.50 | $0.75 | 0 / 1 | n/a |
| Mistral Small 4 | France | Mistral US, $0.17 / $0.66 | $0.29 | Mistral, $0.15 / $0.60 | $0.26 | 1 / 1 | minus 9% |
| MiMo-V2.6-Pro | China | GMICloud, $0.37 / $0.74 | $0.46 | n/a | n/a | 3 / 0 | n/a |
| GLM-5.3 | China | Wafer, $0.07 / $1.40 | $0.40 | Inceptron, $1.20 / $3.50 | $1.78 | 24 / 2 | plus 341% |
| GLM-5.2 | China | Morph, $0.29 / $2.40 | $0.82 | Inceptron, $0.99 / $4.32 | $1.82 | 14 / 2 | plus 123% |
| Kimi K3 | China | InferenceNet, $0.24 / $10.80 | $2.88 | n/a | n/a | 16 / 0 | n/a |
| DeepSeek V4.1 Flash | China | Decart, $0.09 / $0.18 | $0.11 | n/a | n/a | 22 / 0 | n/a |
| DeepSeek V4 Pro | China | GMICloud, $0.96 / $1.91 | $1.20 | n/a | n/a | 9 / 0 | n/a |
| Qwen3.5 397B | China | DeepInfra, $0.45 / $3.00 | $1.09 | n/a | n/a | 8 / 0 | n/a |
| Qwen3.5 122B | China | AtlasCloud, $0.30 / $2.40 | $0.83 | n/a | n/a | 2 / 0 | n/a |
| Qwen3.5 9B | China | DeepInfra, $0.10 / $0.15 | $0.11 | n/a | n/a | 3 / 0 | n/a |
| gpt-oss-120b | US | Venice, $0.03 / $0.15 | $0.06 | Bedrock eu-west-1, $0.15 / $0.60 | $0.26 | 16 / 1 | plus 338% |
| GPT-5.6 Terra | US | Azure, $2.00 / $12.00 | $4.50 | Azure EU, $2.20 / $13.20 | $4.95 | 3 / 1 | plus 10% |
| Claude Sonnet 5.5 | US | Amazon Bedrock, $2.00 / $10.00 | $4.00 | Google Vertex Europe, $2.20 / $11.00 | $4.40 | 5 / 1 | plus 10% |
| Gemini 3.1 Pro Preview | US | Google AI Studio, $2.00 / $12.00 | $4.50 | n/a | n/a | 1 / 0 | n/a |

The prices Moonshot, Z.ai, DeepSeek or Alibaba charge on their own platforms are left out on purpose, because that is a different and heavily subsidised game.

Regolo is not on OpenRouter, so it gets its own rows. These are its list prices, converted at 1 EUR = 1.115 USD, the ECB reference rate of 27 October, all served from Seeweb data centres in Italy.

| Model on Regolo (EU) | List price in / out | Blended 3:1 | Cheapest US host, blended | EU premium |
|---|---|---|---|---|
| GLM-5.2 | €2.00 / €5.20, about $2.23 / $5.80 | $3.12 | $0.82 | plus 282% |
| Qwen3.5 122B | €1.00 / €4.20, about $1.12 / $4.68 | $2.01 | $0.83 | plus 143% |
| gpt-oss-120b | €1.00 / €4.20, about $1.12 / $4.68 | $2.01 | $0.06 | about 33 times |
| Mistral Small 4 | €0.50 / €2.10, about $0.56 / $2.34 | $1.00 | $0.29 | plus 246% |
| Qwen3.5 9B | €0.07 / €0.35, about $0.08 / $0.39 | $0.16 | $0.11 | plus 45% |

Quality is a separate question, so I keep it apart. On the Artificial Analysis Intelligence Index, MiMo-V2.6-Pro scores 46, GLM-5.3 45, Kimi K3 44, DeepSeek V4.1 Flash 39 and Mistral Large 4 38. I did not verify scores for the other models, so they are not in this comparison.

The first thing the table says is that geography alone is cheap. When the same big provider offers the same model in both regions, Europe costs about 10% more. Azure does it, Google Vertex does it, and Mistral charges a similar premium for its own pinned regions. Ten percent is a modest price for residency and I find it fair. If your company already lives on Azure or AWS, a European deployment of an American model is a configuration choice, not a strategic decision. That is precisely why ChatGPT and Claude can call themselves available in Europe.

The second thing is that the open-weight market barely exists in Europe. GLM-5.3 has 24 US providers competing for your tokens and two in Europe. Kimi K3, DeepSeek, Qwen and MiMo have none at all with a European tag. The cheap US minimum comes from small hosts fighting on price, often with fp4 quantization, and that competition simply does not happen here. So the European premium for open models is not 10%. For GLM-5.3 it is more than four times the cheapest US host, and for gpt-oss-120b it is the same story on Bedrock in Ireland.

The third thing is the funniest one. Mistral Large 4 at $2.07 blended has no US host on OpenRouter, so on this list it is the rare model where Europe is the only option. Meanwhile the cheapest European way to run a Chinese model is Inceptron, a Swedish provider running in Finland, at $1.78, and Mistral itself serves GLM-5.3 in its EU region for $2.37. Regolo sells GLM-5.2 for $3.12, almost four times the cheapest US host. In fairness, Regolo includes an Italian contract, zero retention and flat plans. Someone in procurement will still have to sign the multiple.

## Getting into the market

Model quality is only half of the story. Distribution decides the rest, and here the European players are structurally weak. OpenAI, Microsoft and Google are already inside every European company through Office, Azure, Workspace and ChatGPT licences bought by individual departments. A European model has to win a separate procurement process to even get tested.

The consolidation is telling. Aleph Alpha, for years the German sovereign champion, shipped Kolibri on 3 October, a genuinely well documented from-scratch model. A few weeks earlier it had signed a definitive agreement to merge into Cohere, a Canadian company, in a deal valued around $20 billion with Schwarz Group bringing money and compute. Someone on X remarked that apparently Canada counts as Europe now. The deal probably makes commercial sense. It also shows that a European lab alone struggled to find enough buyers.

The others find their niches. H Company builds computer-use agents on Qwen. Black Forest Labs sells image models with a reported contract with Meta. Helsing raised $1.8 billion for defence AI, which is a different business. Domyn, Almawave and Sapienza produce Italian models used mostly by local institutions and research. Public projects move slowly. OpenEuroLLM, funded by the EU, has released only experimental checkpoints and now plans its first models for the end of 2026.

Product maturity is the other half of distribution. The market is moving from chatbots to agents that use tools, connect to email and code repositories and run for hours. This is how the European offer compares with the American one.

| Company | Consumer app | Agentic platform | Coding agent | Connectors |
|---|---|---|---|---|
| Mistral | Vibe, formerly Le Chat, about 5 million monthly users by third-party estimates | Vibe Work Mode, Agents API, Workflows in preview | Vibe Code, CLI and IDE extensions | 60+ in the directory, 100+ claimed, plus MCP |
| Aleph Alpha | None | PhariaAI, an enterprise operating layer | None | Enterprise integrations |
| Giotto | New chat app, launched in October | n/a | n/a | n/a |
| Domyn | None | Enterprise platform for regulated sectors | None | Enterprise integrations |
| Almawave | None | Enterprise solutions built on Velvet | None | n/a |
| Regolo | None | Inference API only | None | None |
| OpenAI | ChatGPT, about 1.2 billion weekly users | Agents, computer use, connectors, apps | Codex, 5 million weekly users in June | Hundreds, plus MCP |
| Anthropic | Claude apps, Claude in Chrome | Agents, computer use | Claude Code, $1 billion run rate in six months | MCP, which it created |
| Google | Gemini, more than 1 billion monthly users | Agents in Chrome, Workspace and Android | Gemini coding tools | Workspace and Android built in |

Mistral does have real agent features, with Vibe for work and code, governed connectors and MCP support, so the gap there is maturity and adoption rather than absence, a few million users against more than a billion. Most other European players sell an API, an enterprise platform or a project, which is useful for integrators and invisible to everybody else.

## Players at a glance

| Player | Strengths | Critical points |
|---|---|---|
| Giotto | Strong test-time compute research, fast product, free chat, single GPU option | Kimi inside, no disclosure, self-reported benchmarks, restrictive terms at launch |
| Mistral | Only European model near the frontier, own compute, capital, real customers | Behind the best Chinese open models on benchmarks, weights late, many fronts open |
| Aleph Alpha | Very transparent from-scratch model, efficient MoE, Apache 2.0 | Below Qwen on its own benchmarks, becoming part of a Canadian company |
| EuroLLM, Apertus, Teuken | Fully open, multilingual, good science | Small, little commercial distribution |
| Domyn, Almawave, Sapienza | Italian language, trained on Leonardo, regulated sector focus | Small scale, Domyn's largest model likely on an NVIDIA base trained on US cloud |
| Regolo (Seeweb) | Italian jurisdiction and data centres, open-weight catalogue, transparent per-token pricing, flat plans | No own frontier model, large models priced two to four times the cheapest US host, little visibility |
| H Company | Useful agents, open weights | Built entirely on Qwen |

## The infrastructure paradox

Under the models there is the compute, and the compute tells the same story with bigger numbers. I will keep this short, because it supports the main point rather than being it.

| Promise | Status as of late October 2026 |
|---|---|
| Up to seven EU AI Gigafactories, more than €30 billion mobilised | No bids received by late October, three weeks before the original 12 November deadline, which was then moved to 3 December |
| JUPITER, Europe's first exascale system | Running in early access and acceptance testing, second module planned for late 2026 |
| Mistral Compute, 13,800 GB300 GPUs and 44 MW near Paris, operational by June 2026 | Financed with $830 million of debt. No public dated evidence of energisation found |
| Stargate Norway, 100,000 GPUs by end 2026 | Capacity now contracted by Microsoft, deployment in 2027 |
| Deutsche Telekom and NVIDIA industrial cloud in Munich | Live since February 2026 with about 10,000 Blackwell GPUs |

Every row in this table runs on NVIDIA or AMD hardware, and the EU signed letters of intent with NVIDIA, AMD and Qualcomm to help gigafactory consortia get chips. That is not a criticism, there is no alternative today. But it shows that the sovereign stack has an American layer at the bottom no matter what sits on top. Energy prices and permitting are the other constraint, and they are the reason OpenAI itself cited when it paused Stargate UK.

## Where this leaves us

I do not think the conclusion is that European AI is a fake. There is real work here. Mistral trains large models from scratch and ships them. Aleph Alpha, the Swiss AI initiative and the EuroLLM team publish models that are more open than most American ones. The Italian ecosystem trains on Leonardo and documents what it does. The problem is that "sovereign" has become a sales label that covers all of these and also covers a Kimi derivative hosted in a European data centre.

If sovereignty means where the GPUs are, OpenAI and AWS already sell it. If it means owning the weights and the training pipeline, very few European products qualify, and they are not the cheapest or the strongest. The honest position for a European buyer is to treat sovereignty as one requirement among others, priced explicitly, and to ask every vendor three things. Where it runs, whose weights they are, and which law applies to the company.

My personal take, and it is an opinion rather than a proof, is that in practice these players mostly end up playing for public administrations and state-linked companies. For end users and private companies they are simply not competitive, and often they do not even have an adequate offer. There is no real agentic platform with bots, connectors and automations, the things that are changing the market right now. Using them feels a lot like using ChatGPT in its early days. Sovereignty sells well in a tender. It sells much less well to someone who just wants the work done.
