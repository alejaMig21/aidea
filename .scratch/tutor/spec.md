# The Tutor: an agent that makes sure the person understands what they build

Status: built (audit 2026-11-04: see the ticket headers)

## Problem Statement

aidea lets a person build software with an AI builder, but the person can accept decisions they do not understand. The gaps that a university leaves (requirements, architecture, design reasons) stay open, and the layers they write are only as good as their understanding. The first version has the Tutor only as an empty column. What is missing:

- Nobody measures what the person already knows, so everything is explained from zero or not at all.
- Nobody plans what they must understand for this project, and nobody asks them anything before revealing the reasons behind a decision.
- The person writes each layer alone, with only a fixed quick tour to help.
- What the person demonstrates understanding of is not recorded anywhere, so every project starts blind.
- The layers are only drawings: the builder is not bound by them, and nothing shows when the built code drifts away from what the person agreed.

## Solution

The Tutor is a second agent in aidea, in the role LearnHarness gives its harness (https://github.com/amosblomqvist/learnharness; ideas only, it is AGPL-3.0), applied to this project's layers. It measures, plans, teaches and helps the person write each layer in their own words, and it records what they demonstrated in a Learner graph. It never edits code; it changes authored layers only through Proposals the person accepts. The accepted content of the Business, Requirements and Architecture layers is the **Contract** the builder must follow.

- **Measure:** a short Probe (at most five questions) before the first class of each layer, skipping what the Learner graph shows, with "I already know this" always available.
- **Plan:** the Tutor shows a Plan: the concepts to understand, in dependency order, and the open decisions of each layer. The person asks for changes. The Tutor asks only about what is in the Plan.
- **Teach:** each step is predict (a turn of its own), then one fact, then a check. Multiple-choice checks carry a confidence from 0 to 100; every question has an optional "what I thought" field. A wrong check is repaired before moving on.
- **Two kinds of class:** a **decision class** (short, stops the builder at a Blocking decision in Class mode) and a **layer class** ("Teach me through it": the Tutor builds a layer with the person; the person speaks first, the Tutor turns their words into a Proposal they confirm, and may then offer alternatives). Until the Tutor is available the button runs the fixed quick tour.
- **Contract:** the builder reads the Contract before building and departs from it only through a Proposal. aidea shows how complete the Contract is (a soft indicator, never a gate) and, after building, where the code drifts from it; drift becomes questions the Tutor can ask.
- **Learner graph:** a per-user, append-only store of Propositions and Reasoning chains, written by an extractor, an auditor and a program that merges without any model. The person's answers are kept apart as Evidence.

## User Stories

1. As a learner, I want to start a free class from the Tutor column, so that I can ask the Tutor to teach me something now.
2. As a learner, I want the Tutor to ask me questions in the Tutor column and wait for my answer, so that the conversation is one thing I can follow.
3. As a learner, I want multiple-choice questions to let me pick an option and then my confidence from 0 to 100, so that I show how sure I am.
4. As a learner, I want every question to offer an optional "what I thought" field, so that I can explain my reasoning.
5. As a learner, I want a way to say "I don't know", so that I am not forced to guess.
6. As a learner, I want to predict before the Tutor explains, so that I think before I read.
7. As a learner, I want the Tutor to explain one fact at a time after my prediction, and then check it, so that I do not drown.
8. As a learner, I want a wrong or unsure answer repaired before the Tutor moves on, so that confusion is not built on.
9. As a learner, I want a short Probe before the first class of each layer, limited to five questions about what the layer needs, so that the Tutor starts where I am.
10. As a learner, I want to say "I already know this" to skip a Probe question or a topic, so that I am not slowed down.
11. As a learner, I want the Tutor to skip what my Learner graph shows I understand, so that I am not asked twice.
12. As a learner, I want to see a Plan for my Project (concepts in dependency order and the open decisions of each layer) in the Tutor column, so that I know where I am going.
13. As a learner, I want to ask the Tutor to change the Plan, so that it fits me, without editing it by hand.
14. As a learner, I want the Tutor to ask only about what is in the Plan, so that classes stay on topic.
15. As a learner, I want to start "Teach me through it" on any layer, so that I build that layer with the Tutor.
16. As a learner, I want the Tutor to ask me in plain words what a layer element is (for example who a business is for) and let me answer in my own words first, so that I write my own layer.
17. As a learner, I want my words turned into a Proposal that I confirm, so that nothing enters my project without my approval.
18. As a learner, I want the Tutor to offer alternatives after I have answered, so that I see options I had not thought of.
19. As a learner, I want "Teach me through it" to run the fixed quick tour when the Tutor is not available, so that the button always works.
20. As a learner, I want "Teach me through it" on all five diagram layers, so that every layer is taught the same way.
21. As a learner in Class mode, I want the builder to stop at each Blocking decision until I have answered the Tutor, so that I think before accepting.
22. As a learner, I want the decision class to be short and to leave the reason and the rejected alternatives written in the Node's Rationale, so that the decision is explained later.
23. As a learner in Direct mode, I want the builder not to be stopped, so that I can work fast and still ask to learn on demand.
24. As a learner, I want to select any text and choose "just define" or "enter the Tutor", so that I can go deeper at any moment.
25. As a learner, I want the Tutor to read my layers, my code and my Playback recordings, so that its questions are about my project.
26. As a learner, I want the Tutor to be unable to read outside my Project folder and to be unable to run commands or change files, so that I can trust it.
27. As a learner, I want the Tutor to propose changes to the authored layers only as Proposals, so that I stay in control.
28. As a learner, I want the Tutor to ignore my personal plugins and instructions, so that it teaches in its own consistent way.
29. As a learner, I want what I demonstrated recorded in a Learner graph that lives outside my Projects, so that it follows me to the next project.
30. As a learner, I want my answers kept as Evidence apart from the graph, so that what I got wrong is not written as something I know.
31. As a learner, I want no score or level to be kept about me, so that progress means how much of the map I have covered.
32. As a learner, I want to delete an idea from my Learner graph, so that I control what is recorded.
33. As a builder-user, I want the builder to read the Contract before it builds, so that it follows what I accepted.
34. As a builder-user, I want the builder to depart from the Contract only through a Proposal I accept, so that nothing changes behind my back.
35. As a learner, I want an indicator of how complete my Contract is (for example customer and value proposition defined, at least one functional and one non-functional requirement, at least one container), so that I see what is missing without being blocked.
36. As a learner, I want aidea to show where the built code differs from the Contract (for example a requirement with no code, a boundary crossed), so that I notice drift.
37. As a learner, I want drift to become questions the Tutor can ask ("why does this requirement have no code now?"), so that I learn from it.
38. As a learner, I want to pick the model of the Tutor (already available), so that I control cost and quality.
39. As a learner, I want the Tutor to ask at the start of a class one question about an earlier idea, so that I recall without help. (Optional; may be dropped.)
40. As a developer, I want to be able to point the Tutor at another agent product later, so that I am not locked to one provider.

## Implementation Decisions

- **Roles.** The Tutor is several agent sessions behind the Agent adapter, each launched with its own instructions and without the person's plugins and instructions: a Prober (measures), a Teacher (plans and teaches), an Extractor and an Auditor (build the Learner graph from the Teacher's prose). A deterministic program merges. The first ticket verifies that the installed Claude Code can host these as separate sessions, how long a session may wait for a person's answer, and what a class costs.
- **Tools.** The core's Canvas tool server gives the Tutor roles tools to ask the person a question and wait, to set and revise the Plan, to hand over the Probe result, to read the project (layers, Nodes, code snippets inside the Project folder, Playback recordings) and to create Proposals. A question is rejected if it is not about a Plan item. Each question fixes its correct answer before it is shown. Tool errors go back to the model so it can correct itself.
- **No writes except two.** The Tutor roles have no shell and no write access to the Project. Their only writes are Proposals (through the same Proposal mechanism as the builder, validated by the same rules) and, through the pipeline, the Learner graph and the Evidence.
- **Read scope.** Reads are limited to the open Project's folder and the core's own data, through core tools, not direct file access.
- **Phases are derived, not gated.** Measure, plan and teach follow from what has happened (the Probe handed over; the first question about a Plan item), as in LearnHarness; there is no button that unlocks the next phase.
- **Question shape.** Predict is a turn of its own about the next untaught step, open-ended. Checks are multiple-choice (graded by the program, with confidence 0, 30, 50, 70, 90, 100, default 50) or free text (graded by the model against the answer committed beforehand). Every question has an optional "what I thought" field and a "don't know" option. These numbers come from LearnHarness and are a starting point to tune.
- **Evidence.** Each answer is stored as an Evidence entry: correct or not, confidence, the free text, the question and the class. Evidence lives in an append-only per-user ledger. No mastery score is stored; whatever is shown about progress is derived from the Evidence and the graph.
- **Learner graph.** Per-user append-only line-oriented files under the user's aidea folder, outside any Project: Propositions (name, statement, aliases, provenance: class and message, and when relevant the Project Node) and Reasoning chains (premises, conclusion, provenance). Built only from the Teacher's prose; the person's answers never enter it. A deterministic merger (no model) is the only writer; identifiers are derived from the normalised name so the same input gives the same graph. An idea can be deleted, together with its chains, but not edited. The data keeps connections and provenance so that a later version can draw it and add Practice.
- **Plan.** Stored per person and per Project outside the Project's repository. It lists concepts with dependencies and open decisions per layer. The person asks the Tutor for changes; the Tutor revises it.
- **Contract.** The accepted Nodes of the Business, Requirements and Architecture layers (including Rationale, requirement criteria, Architecture relations). The builder reads it through a tool and its instructions say to follow it; a change to an authored layer by the builder is a Proposal as today. The completeness indicator is derived from the layers (what exists), never blocks, and is shown in the Tutor column and on the layer cards. Drift (a requirement with no linked code, a relationship in the code that the Architecture does not allow, a Pattern group violation) is computed by the core from the layers and the derived layers and shown as differences; the Tutor can turn each into a question.
- **Class mode and Direct mode.** A per-Project setting as already specified. In Class mode a Blocking decision pauses the builder until the Tutor's question is answered; the answer, the reason and the rejected alternatives are written to the Node's Rationale through the Proposal. In Direct mode nothing pauses. Text selection works in both.
- **Layer class.** The "Teach me through it" button of each diagram layer starts a layer class led by the Tutor; while the Tutor is unavailable it runs the fixed quick tour that exists today. Each layer has its own teaching content (what it is, the guiding question, an example, what to ask), kept in one structure per layer, seeded from the Business help already written.
- **Tutor model.** The Tutor roles use the Tutor model chosen in the selectors; background roles (Extractor, Auditor) may use a cheaper model chosen at implementation after the spike measures cost.
- **Prompts.** The roles' instructions are written for aidea, not copied from LearnHarness. They are plain files in the application, not editable by the person in this version.
- **Tutor column.** The Tutor tab shows the conversation (questions as cards, answers, explanations), the Plan, the Contract indicator and the entry points ("Start a class", "Teach me through it"). The empty state remains when the Tutor is unavailable.

## Testing Decisions

- **Good test:** only external behaviour through the core's HTTP protocol, with a fake adapter that plays scripted tool calls for each Tutor role. No test calls a real model.
- **Through the protocol:** a question reaches the person and waits; an answer, confidence and "what I thought" become one Evidence line; a question outside the Plan is rejected; the correct answer is fixed before the question is shown; the Probe skips ideas already in the graph; the pipeline turns fixed Teacher prose into the expected Propositions and chains and merges duplicates into one (same input, same graph); deleting an idea removes its chains; a Proposal made by a Tutor role is validated like the builder's and appears pending; the Tutor tools cannot read outside the Project folder and no write tool exists; in Class mode the builder's Blocking decision waits for the answer and in Direct mode it does not; the Contract tool returns the accepted layers; the completeness indicator and the drift list are computed correctly on fixtures; the text-selection entry creates a class with that text.
- **Not tested automatically:** the quality of the Tutor's teaching, the look of the Tutor column and the quick tour. They are checked live (headless browser for the interface, and by the person), and the quality of real model behaviour by a short manual script run in the spike and again at the end.
- **Prior art:** the chat and builder-proposal tests with the scripted fake adapter, the permission tests and the authored-layer tests.

## Out of Scope

- Practice sessions (generated problems with a hint ladder). Planned for the next version; the graph is designed for it.
- Drawing the Learner graph inside aidea. Planned later.
- Background research and generated demos or visual explanations.
- Prompts editable by the person; voice dictation; other Tutor providers (the adapter allows them later).
- Practice scores, levels or any stored mastery number.
- Enforcing the Contract by blocking the builder's tools; the Contract is read and compared, not a gate.

## Further Notes

- Sources: `.scratch/tutor/research/01-learnharness.md` and `02-learnharness-deep.md`. Facts that shaped the decisions: phases are derived with no gates; the plan constrains the tutor's questions; the graph is built only from the Teacher's prose; the learner's answers are evidence, not graph content; LearnHarness reads any absolute path (aidea narrows it); it has nothing for co-authoring a document, proposing changes to a project or gating another agent, which are aidea's own design.
- Licence: LearnHarness is AGPL-3.0. aidea takes ideas and tool shapes only: no code, no prompt text and no close paraphrase of them.
- Open risks: whether Claude Code can run the roles as isolated sessions and how long it waits on a question (first ticket); cost per class; the quality of the extractor on real prose.
- Vocabulary: Tutor, Contract, Plan, Evidence, Decision class, Layer class, Probe, Learner graph, Proposition, Reasoning chain, Class mode, Direct mode, Blocking decision are in `GLOSSARY.md`.
