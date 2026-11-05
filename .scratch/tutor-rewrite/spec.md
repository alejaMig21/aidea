# The Tutor, rewritten: the LearnHarness method, and everything else through plugins

Status: draft (2026-11-05), waiting for the person to read and approve; tickets in `issues/`

Source: the person's decision of 2026-11-05 (the Tutor needs a total rewrite: most of its features were designed before plugins could be taught and used), `.scratch/tutor/research/01-learnharness.md` (the LearnHarness method), ADR 0008, ADR 0009 and ADR 0010.

## Problem

The Tutor of today was built when aidea was not made of plugins. It has classes tied to an entry point (a layer, a difference, selected text, a plugin in the quarantine, "How aidea works"), a Probe per layer with a fixed list of concepts, a Plan that mixes concepts and layer decisions, tools that build the authored layers, and sections for the Contract and the Differences. It has no practice phase. Plugins can now ship a lesson, a read-only view and named checks, so the Tutor no longer needs to know any part of aidea by name.

## Solution

The Tutor works literally as LearnHarness does, and uses plugins for everything about aidea.

1. **One continuous conversation.** The person needs an Open Project, and may ask the Tutor anything. What they ask is their goal. There are no classes of different kinds: the interface can attach context to a question (a selected text, a Node, a difference, a plugin waiting in the quarantine) and that is all.
2. **Measure, in the same chat.** The Tutor asks the goal if it is not clear, and asks questions to find, for each prerequisite topic, the hardest thing the person reliably gets right and the easiest thing they get wrong or do not know. It stops when every topic is bracketed and the goal is concrete.
3. **Plan.** A dependency map of what to learn, without what the person already knows. It is shown, explained in a few sentences, and the Tutor waits for the person's go-ahead. It is a hypothesis: it is revised in the open, and its items keep their ids.
4. **Teach loop, one fact per step.** The person predicts, the Tutor explains starting from the prediction, then checks with a question and the person's confidence. A miss is repaired before going on. When the topic is a plugin, the Tutor teaches from the plugin's lesson and checks with the plugin's named checks: instead of "pick the right option" it asks the person to do something and the check says whether they did.
5. **Practice, in its own session.** The person or the Tutor can ask for it. Problems target ideas already taught but not reliably recalled, in three forms (recall, discrimination, composition), with hints one level at a time and a grader. A practical problem is a manual task in a plugin, verified by its checks.
6. **Memory.** The Learner graph keeps the ideas and the evidence, built apart from the conversation. A check that passed is evidence of "did it". The graph starts empty in the first build.

## How aidea is taught

The Tutor knows no part of aidea by name. Each plugin ships a lesson, a read-only view and named checks (plugin-lessons, plugin-teaching); what is not a plugin is covered by the short kernel trunk. For this to be true as a rule and not as a hope: nothing that is part of aidea ships without its lesson and its surface, and a mechanical check fails when a lesson names something that no longer exists (plugin-lessons 03). The purpose of a layer is the lesson of the layer.

## The layers, the Contract and the Builders

- Helping to form the architecture, forming a Contract and the like is the Tutor **using the plugins that own them**: it teaches how, checks with their checks, and turns the person's words into Proposals the person accepts. It never writes a layer or a plugin by itself (ADR 0009).
- **The Contract belongs to a plugin.** The Tutor and the Builders never talk to each other. The Builder reads the Contract from the Contract plugin, through tools that plugin offers to Builders (roles-and-contract 10); the Tutor reads its view and runs its checks.
- **The person starts a Builder by writing in the Builder's chat**, for example "read the Contract and start with the first task". Nothing else sends or starts anything: not a button the Tutor can press, not an automatic step. If the Builder ignores the Contract, the policy of the Contract plugin (what is not in the Contract is not developed) stops or reverts the action.

## Decisions (agreed with the person)

1. The Tutor needs an Open Project, always. The person may ask anything.
2. The Tutor plugin works as LearnHarness; the layers, the Contract and everything else are plugins it uses.
3. Practice can be asked for by the person or by the Tutor.
4. The Learner graph is reset when the first build is made (the person is its first learner).
5. The person asks a Builder for work by writing in its chat; there is no Assignment card and no Send button. Builders get the tools that plugins offer.
6. The Tutor teaches and has no autonomy over the Project (ADR 0009 stands).

## Suggested slices (tracer bullets)

1. The session: one conversation, any question, no kinds of class (tr 01).
2. Measure and Plan inside it (tr 02, 03).
3. The teach loop, using lessons and checks of plugins (tr 04), with evidence from checks (tr 06).
4. Practice (tr 05).
5. The panel (tr 07), and the Tutor stops knowing layers, differences, the Contract and the guide by name (tr 08, after the plugins own them).
6. Whether the three authored layers become plugins (tr 09), the first build's empty graph (tr 10).

## Not here

- Background jobs of LearnHarness (research, demo, visual): not asked for.
- The Tutor acting on the Project in any way.
- A score or level about the person: a check says whether something was done, nothing more.

## Open

- Whether the three authored layers (Business, Requirements, Architecture) become plugins, so the Tutor learns them like any other (tr 09). The Contract and the Differences already do (roles-and-contract 04).
- How much of the current Learner graph pipeline (extractor, auditor, merger) is kept as it is.
