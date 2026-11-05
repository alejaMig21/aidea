# The backlog: everything still to do, by effort

This is the one list the work follows (agreed with the person, 2026-11-05). Rules:

1. **When an item is finished, it is deleted from this file** (the ticket and the git history keep the record).
2. **When a new idea or decision comes up in a conversation, it is added here** in the same turn, with a size and its marker, and its source.
3. A ticket that is written for an item keeps the item here until it is done; change its marker from `D` or `I` to `T`.
4. Work is taken from the list; if the person names something else, it is added first.

All pending or half-done work, not only the first version: written tickets, decided work with no ticket yet, and ideas not decided. Sizes are the agent's estimate, calibrated on how long similar work took in this session; they are not measured. Last reviewed: 2026-11-05.

- **S**: under an hour or two (a check, a small fix, one test).
- **M**: one focused session.
- **L**: two or three sessions.
- **XL**: many sessions, and a spec or a design first.

`T` = a ticket exists. `D` = decided with the person but no ticket yet. `I` = an idea, not decided.

## S

| | Work | Where | Waits for |
|---|---|---|---|
| T | Live check of the Tutor pointing at Data (and the two lines in `50-tutor.js`) | layout-and-data 17 | real Tutor (quota) |
| T | Live check: the Builder proposes a run recipe | run-and-terminal 10 | real Builder (quota) |
| T | Live check: the Builder cannot write aidea files except by Proposals | v1-gaps 01 | real Builder (quota) |
| T | Play's failure message offers to open the Terminal: test it | run-and-terminal 06 | nothing |
| T | Stop and Restart buttons: page test | run-and-terminal 07 | nothing |
| T | Live measurement of idea names and duplicates | live-findings 01 | real classes (quota) |
| T | A Project in a language no plugin reads: plain message and an offer to ask the Builder | language-plugins 04 | language-plugins 01 |
| T | Check "Save image" in Electron (the download dialog was never clicked) | layout-and-data 17 note | nothing |
| D | Merge the Canvas's own title bar with the layer bar (needs a ticket) | interviews-pending 7 | nothing |
| D | Move the authored-layer guard onto the plugin guard mechanism (`ctx.guards`) | handoff | nothing |
| D | Missing dev-journal entries (presets, keyboard, Class/Direct removal, READING, Data layer, today) | `docs/journal/` | nothing |
| D | Review leftovers: shared `make` helper, `chatUi.send` seam, test that the 2000 and 8000 limits match, split the secret detector out of `54-select.js`, `chat.ts` allowedTools list | `.scratch/code-review-2026-11-04.md` | nothing |
| I | Let the person edit the input data of a recording (the named lists cover part of it) | ideas | |

## M

| | Work | Where | Waits for |
|---|---|---|---|
| T | A plugin ships a lesson and the Tutor reads it | plugin-lessons 01 | nothing |
| T | Leave the tour at any part; choose lessons; remember progress | plugin-lessons 02 | plugin-lessons 01 |
| T | Mechanical check that a lesson still names what its plugin has | plugin-lessons 03 | plugin-lessons 01 |
| T | Creator Mode writes and keeps the lesson | plugin-lessons 04 | plugin-lessons 01, 03 |
| T | Split the old guide into trunk and plugin lessons (and the live check of aidea-guide 01) | plugin-lessons 05 | the person: which parts are the kernel's; plugin-lessons 01, 02 |
| T | The `language` slot in the plugin API | language-plugins 01 | nothing |
| T | One Components layer for several languages, the language in each Node's info | language-plugins 05 | language-plugins 01 |
| T | Creator Mode can write a language plugin | language-plugins 06 | language-plugins 01 |
| T | Long waits for an answer: measure 3, 10 and 30 minutes with the real Claude Code | live-findings 05 | real Claude (quota, up to 30 min) |
| D | Detect warnings (not only failures) when Play starts parts; "restart only this part" quickly | interviews-pending 1 | nothing |
| D | Measure aidea with a very high number of heavy plugins | person's note | the plugin system (built) |
| D | A release-numbers plugin (semver, `v1.0.0`): reads the commits since the last version tag and proposes the next number (a `fix` raises the last digit, a `feat` the middle one, a breaking change the first), says why, and the person accepts or not; keeps the count so the person does not have to. A plugin of its own, NOT the git history plugin of the XL section | person's idea, 2026-11-04 | the plugin system (built); conventional commits (already used) |
| I | Compare two algorithms side by side on the same data | ideas | Data layer (built) |
| I | More drawing pieces for Data: hash table, call stack and recursion tree, state machine, grid, weighted graph (each) | ideas | Data layer |
| I | Short contextual hints the first time a part is used | ideas | plugin-lessons |
| I | Another agent adapter (Codex, Kimi, DeepSeek over ACP): a spike, then one each | ideas, harness research | plugin system |

## L

| | Work | Where | Waits for |
|---|---|---|---|
| T | Python becomes a built-in plugin, on by default; every test unchanged | language-plugins 02 | language-plugins 01 |
| T | TypeScript and JavaScript become a built-in plugin with a variant per system | language-plugins 03 | 01, 02, 07 |
| T | A plugin can ship a variant per system, use a program on the machine, or download one with permission | language-plugins 07 | language-plugins 01 |
| T | Run a TypeScript or JavaScript function for Playback: separate Node process with `--permission` plus a fake-network guard (decided 2026-11-03) | language-adapters 05 | language-plugins 03 |
| T | The record of values for TypeScript and JavaScript (nothing is recorded today) | layout-and-data 13 note | the line above |
| I | A timeline view for concurrency | ideas | |
| I | Reconstruct the layers of an existing project: a Tutor class that reads the code and proposes Business, Requirements and Architecture with the files each rests on | ideas | |
| I | The Tutor reads sources the person attaches (a folder, a web page), as untrusted data | ideas | |
| I | Contribute to a public repository (fork, branch, pull request); `git clone` does not exist | interviews-pending 6 | |
| I | Logical network level of Deployment (subnets, VLANs) | interviews-pending 5 | a real network engineer's diagram |
| D | **Teaching surface of a plugin**: what a plugin declares so the Tutor can teach and test it: its lesson (plugin-lessons), a read-only view of its state, and named checks the Tutor uses to evaluate what the person did (for example the Canvas: "a container with a relation to a database exists"). The Tutor never acts inside a plugin: a change goes through a Proposal the person accepts. Required for plugins the Builder writes (as the lesson is), a warning for others, if the person confirms. The person said (2026-11-04) that the Tutor being able to use plugins is a must; it had been parked as "later" by mistake | person's idea, 2026-11-04 | spec first; plugin-lessons 01 |

## XL

| | Work | Where | Waits for |
|---|---|---|---|
| T | A Panel on a second window (needs a second screen) | layout-and-data 10 | the person has one screen; ADR 0007 |
| D | **Instances: any plugin can be started several times.** A plugin declares a minimum number of instances (a role needs at least one) and the person can start N: N Builders (each its own provider and, in parallel, its own git branch), N Tutors (a second class without breaking the first; a DeepSeek Tutor beside a Codex one), N Canvases each showing a different layer at the same time. Every instance is its own session or view; the Panel registry (layout-and-data 18) and the saved Layout (19) must name an instance, not only a Panel; the manifest says the minimum and perhaps a maximum. Decided in ADR 0008 point 7 for roles and extended to every plugin on 2026-11-05; the plugin system spec left it out of scope on purpose ("the registry must not forbid it"), so there is no ticket | ADR 0008, `.scratch/plugins/interview.md` 9 and 9b | the plugin system (built); a spec |
| D | Packaging: one installer per system and processor (Windows, macOS, Linux; x64 and arm64), with signing and notarization on macOS, and the variants of the built-in plugins | language-plugins spec | nothing; today aidea runs with `electron .` |
| D | The versions plugin: commits and files changed, the Canvas at a chosen commit, all branches as an animated graph, the state of the working folder (shown only) | interviews-pending 4 | the plugin system (built); the animation engine |
| D | The animation engine: a language-neutral recording drawn with pieces (list, tree, graph, grid); part of it exists in Data | interviews-pending 4, ideas | |
| D | The Deployment layer (C4-style level 1, an environment selector, instances pointing at Architecture, legend, Probe and class) | interviews-pending 5 | a spec; the run recipe (built) |
| D | Guided, game-like journeys with achievements: a sample Python Project that ships inside aidea, the interface reporting actions, a progress map | interviews-pending 6 | a spec; wording of Tutor story 31 (no score kept) |
| I | A performance lens: how time and memory grow with the size of the data | ideas | the animation engine |
| I | A visual debugger for people who are not engineers (Playback and Data cover part) | ideas | |
| I | Real-time cursors and shared work (needs a relay server) | ideas | one file per Node (built) |
| I | Reuse existing language servers for `analyze`; or a light parser instead of the TypeScript compiler | language-plugins spec, "Later" | language-plugins 01 |

## Tickets that are not work any more

Obsolete: live-findings 04, v1-gaps 11, tutor 10. Folded into other work: aidea-guide 01's live check (plugin-lessons 05). Written as a draft and ticketed: plugin-lessons (5 tickets) and language-plugins (7 tickets).

## Not read in this pass

`.scratch/overnight/PLAN.md` and `LOG.md`, and `.scratch/future/research-deployment-notations.md`; the sizes above do not use them.
