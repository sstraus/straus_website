---
title: "The French Fridge Hack Is Not About the Fridge"
date: 2026-10-14
tags: [security, iot, ot, ai, asset-management]
---

# The French Fridge Hack Is Not About the Fridge

On the night of October 11, someone took control of the refrigeration systems in hundreds of French supermarkets and forced them into a continuous defrost cycle, pushing temperatures in fridges and freezers up to 50°C for hours. By the morning entire refrigerated and frozen sections had to be emptied, tonnes of food went in the bin, some equipment caught fire, and the head of Les Mousquetaires was talking about losses in the tens of millions of euros. The first reports spoke of a few hundred stores, then on October 13 the French Finance Minister told Parliament that around 700 of the country's roughly 10,000 supermarkets had been hit, across Intermarché, Netto, Coopérative U, Carrefour, Monoprix and others.

What I find interesting is not the vulnerability itself, which we don't even know yet, but how little sophistication may have been needed to cause that much physical damage, and how familiar the underlying problem is to anyone who has ever tried to answer a simple question: what is actually connected to our network, and what is it running?

## What we actually know

The CERT-FR published its alert [CERTFR-2026-ALE-012](https://www.cert.ssi.gouv.fr/alerte/CERTFR-2026-ALE-012/) on October 12, describing numerous compromises of remote refrigeration controllers: Danfoss AK-SM and AK-SC, Copeland xweb and Dixell xweb. The common thread in the alert is not a specific CVE but management interfaces exposed directly to the Internet on equipment that was not patched. Danfoss said that most of the affected units were legacy AK-SM800 and AK-SC355 controllers that no longer receive software or security updates, and Copeland described its own case as a discontinued, end-of-life generation of controllers. So we are not talking about a single unlucky product family, but about a whole category of equipment with the same profile.

It is worth being precise about what we don't know, because this story is very easy to embellish. As far as public sources go, there is no evidence that AI was used in the attack, and no evidence that the compromised controllers were used to move laterally into other systems. Everything I say below about those two aspects is a reflection on where this kind of risk is going, not a reconstruction of what happened in France.

## Devices nobody wants to touch

These controllers are not traditional IT assets. They are operational devices, usually installed years ago by specialised contractors, maintained outside corporate IT, and expected to run for ten or fifteen years without much attention. Most companies can tell you quite precisely which laptops run an outdated operating system, which servers are behind on patches and which applications carry known vulnerabilities, because that is where they invested in endpoint protection and vulnerability management. Ask the same organisation about its refrigeration controllers, building management systems, HVAC, industrial gateways, cameras or access control, and the answer becomes much vaguer. Some of these devices are invisible to endpoint management, others exist in the inventory only as an IP or a MAC address, with no firmware version, no support status and no clear function attached, and quite often nobody can tell you who is responsible for them.

A refrigeration controller is typically managed by an external contractor, reachable through a remote access gateway, and excluded from the normal patching process because nobody wants to risk interrupting a critical physical operation. This is the contradiction I keep running into. The equipment is important enough that nobody dares to touch it, but not visible enough to get the same security attention as a corporate server, and the result is a growing population of connected devices running software that is years behind.

## AI changes the economics, not the problem

Old firmware on forgotten devices is not news, and it has been a known problem for at least a decade. What is changing is the cost of exploiting it. Finding exposed devices, fingerprinting their firmware, correlating product versions with published vulnerabilities and preparing an attack path used to be a lot of manual and rather tedious work, and today a good part of it can be assisted by AI, combining Internet scan results, device fingerprints, CVE databases and vendor documentation into a list of likely targets in a fraction of the time. AI does not make every vulnerability exploitable, but it reduces the cost of reconnaissance and analysis, and that matters a lot when the same outdated equipment sits in thousands of locations.

This is where IoT and OT are particularly exposed, because many devices share the same firmware, the same configuration patterns and the same remote management interfaces. In France, competing supermarket chains with completely different corporate IT ended up in the same incident because parts of their operational technology depended on similar products and similar maintenance practices. It is a form of concentration risk that traditional IT security assessments rarely capture, since nobody thinks of "the refrigeration vendor" as a shared dependency in the same way they think of a cloud provider.

The point I would hold on to is a very concrete economic divergence. The speed at which AI can help identify and analyse vulnerabilities is increasing, while the replacement cycle of industrial hardware stays at ten or fifteen years.

> The attacker's cost of finding old equipment keeps falling, while the defender's cost of replacing it does not move at all.

Replacing a refrigeration controller, an industrial gateway or a building automation system is nothing like updating a laptop. The equipment often still works perfectly, and replacing it means specialised technicians, downtime, compatibility testing and sometimes changes to the infrastructure around it, while the vendor may have stopped supporting the firmware long before the hardware reaches the end of its useful life. Organisations are left with devices that remain operationally valuable but become harder and harder to secure, and every month the gap between the two curves gets a bit wider.

## The device as a bridge

There is another aspect that deserves attention, even if, again, there is no public evidence of it in the French case. An IoT device is not necessarily the final target, because it can also be a bridge. A compromised controller can directly damage physical operations, as we have just seen, but depending on how the network is designed it can also be an entry point towards management networks, shared credentials, internal services, or systems that were never meant to be reachable from outside.

Not every hacked fridge is a path into the corporate network, and proper segmentation prevents exactly that. The problem is that many environments have accumulated exceptions over the years to support remote maintenance, vendor access and plain operational convenience, and these connections are poorly documented, often to the point that the people responsible for cybersecurity don't know they exist.

## Inventory is not intelligence

This is why I think the real lesson here is about asset intelligence rather than about a single vulnerable product. Knowing that a device exists is useful, but what lets you assess the actual risk is knowing its exact model, firmware, known vulnerabilities, lifecycle status, network exposure and relationships with other assets. A controller with unsupported firmware isolated from external access is a very different risk from the same controller exposing its management interface to the Internet, which is precisely the situation the CERT-FR describes, and a vulnerable device on a sensitive operational network deserves different attention from one that is properly segmented. Without that context, vulnerability management turns into processing CVE lists instead of understanding which weaknesses can actually hurt the business.

AI can help the defensive side as well, with better device classification, firmware identification, vulnerability correlation and analysis of network relationships, which makes it possible to understand environments that were simply too expensive to document by hand. But it only works if the underlying discovery is reasonably complete. No model can reliably assess a device the organisation does not know exists, or infer a firmware version from an incomplete inventory without introducing a lot of uncertainty.

## An expensive demonstration

The French incident is a good reminder that cybersecurity is no longer just about protecting information. A compromised refrigeration controller destroys food, a building management system can stop operations, an industrial gateway can expose production equipment, and all of this can happen without ransomware, without data theft and without touching a single traditional endpoint. For years we have treated old firmware and unmanaged IoT as technical debt to be paid off progressively, and that assumption gets harder to defend when attackers can find and analyse vulnerable equipment faster and faster while many organisations still struggle to keep an accurate inventory of what they have connected.

The honest question is whether our ability to discover, understand and protect these devices is improving as quickly as the tools available to attack them. For now, the French supermarkets have provided a rather expensive demonstration of what happens when the answer is no.

*Sources: [CERT-FR alert CERTFR-2026-ALE-012](https://www.cert.ssi.gouv.fr/alerte/CERTFR-2026-ALE-012/), [AP on the 700 affected supermarkets](https://www.local10.com/business/2026/10/13/cyberattack-targeting-refrigeration-systems-hits-700-supermarkets-french-government-says/), [Al Jazeera, with the Reuters report on the ANSSI investigation](https://www.aljazeera.com/news/2026/10/13/unprecedented-cyberattack-hits-french-supermarkets-causing-food-losses), [BleepingComputer](https://www.bleepingcomputer.com/news/security/cyberattack-shuts-down-refrigerators-at-french-supermarkets/).*
