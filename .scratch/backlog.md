# The backlog: everything still to do, in the order of development

This is the one list the work follows (agreed with the person, 2026-11-05). It is ordered by **dependencies**: an item with no dependencies is at the top; an item that depends on others is below all of them. Size is not the criterion. Within a level the order is: the person's priorities first, then the items that unblock the most others. The list is generated from the dependency graph; when it changes, the graph changes first.

Rules:
1. **When an item is finished, it is deleted from this file** (its ticket and the git history keep the record), and the items that waited for it move up.
2. **When a new idea or decision comes up in a conversation, it is added here in the same turn**, with its dependencies, a size and its marker, and everything it changes (tickets, specs, glossary) is updated in the same turn.
3. Every item has a ticket (marker `T`); a ticket keeps its row until it is done. A new idea gets its ticket in the same turn, with status needs-info if it is only an idea or waits for a spec.
4. The status of a ticket says whether it can start: `ready-for-agent`, or `needs-info` and what it waits for (shown in the Wait column).
5. Every new built-in plugin ships a lesson and a teaching surface (plugin-lessons, plugin-teaching): items that create one depend on those.

Sizes are the agent's estimate, not measured: S under an hour or two, M one session, L two or three, XL many and a spec first. `T` marks an item that has a ticket (all of them). `wait` is something outside the work itself: a decision or hardware of the person, or quota for a live check. Last reordered: 2026-11-05 (83 items, 5 levels).
## Level 0: no dependencies

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| pt02 | T | M | The Tutor can read a plugin's view and run its checks, read-only and with limits | plugin-teaching 02 | - | 11 | - |
| li03 | T | M | Every claim in a Proposal carries evidence (files and lines; observed, inferred or unknown) and the core refuses citations that do not hold | layer-inference 03 | - | 7 | - |
| anim | T | XL | The animation engine: a language-neutral recording drawn with pieces (list, tree, graph, grid); part of it exists in Data | animation-and-data 01 | - | 6 | a spec first (what exists in Data and what the engine adds) |
| li02 | T | M | The fingerprint of a project (tree, manifests, entry points, documents, git summary) and a Tutor tool to read it | layer-inference 02 | - | 6 | - |
| lp02 | T | L | Python becomes a built-in plugin, on by default; every test unchanged | language-plugins 02 | - | 6 | - |
| lp07 | T | L | A plugin can ship a variant per system, use a program on the machine, or download one with permission | language-plugins 07 | - | 6 | - |
| pp01 | T | M | Actions carry a class and a scope (writes in the Project, outside, runs a program, network, secrets) | plugin-policies 01 | - | 6 | - |
| rc01 | T | M | An Assignment: the person writes it and sends it to a Builder; no one else can | roles-and-contract 01 | - | 6 | - |
| pl03 | T | M | Mechanical check that a lesson still names what its plugin has | plugin-lessons 03 | - | 5 | - |
| li04 | T | M | A Project is my own, someone else's to study, or new: asked once, kept, changeable | layer-inference 04 | - | 3 | - |
| prov | T | XL | Roles and Providers: the Tutor and the Builder become roles filled by provider plugins; the agent adapter becomes a (required) plugin. Part of migrating the rest of the existing features into plugins (Files, Code, Playback, the layers), each with its own specification, as the plugin-system spec left it | roles-and-providers 01 | - | 3 | the spec the plugin-system spec left out (which services stay single-instance, the list of named slots, the required plugins) |
| cbs | T | M | Spike: measure Codebase Memory MCP as a code-graph tool for the agents on Telegram, a Unity project and a Node monorepo, with and without it (indexing writes nothing into the project; one background process per account shares the person's cache; licence not looked at) | layer-inference 11 | - | 2 | quota |
| inst_spec | T | S | Write the Instances spec: a plugin declares a minimum number of instances and can run N times (N Builders each on a branch, N Tutors, N Canvases each on a layer); the Panel registry and the saved Layout name an instance | roles-and-providers 02 | - | 2 | the person decides the open points |
| pl02 | T | M | Leave the tour at any part; choose lessons; remember progress | plugin-lessons 02 | - | 2 | - |
| bp03 | T | S | Say why module pairs are hidden and let the person see them | big-projects 03 | - | - | - |
| bp05 | T | L | The cold analysis of a big project takes under 2 s: per-file facts extracted in parallel worker processes, resolved across files; incremental | big-projects 05 | - | - | - |
| collab | T | XL | Real-time cursors and shared work (needs a relay server) | collaboration 01 | - | - | an idea |
| ed | T | S | Let the person edit the input data of a recording (the named lists cover part of it) | animation-and-data 05 | - | - | - |
| jn | T | XL | Guided, game-like journeys with achievements: a sample Python Project that ships inside aidea, the interface reporting actions, a progress map | guided-journeys 01 | - | - | a spec first and the wording of Tutor story 31 (no score is kept) |
| jr | T | S | Missing dev-journal entries (presets, keyboard, Class and Direct removal, READING, Data layer, 2026-11-04 and 2026-11-05) | housekeeping 02 | - | - | - |
| la17 | T | S | Live check of the Tutor pointing at Data (and the two lines in `50-tutor.js`) | layout-and-data 17 | - | - | real Tutor (quota) |
| la17s | T | S | Check "Save image" in Electron (the download dialog was never clicked) | layout-and-data 17 note | - | - | - |
| ld10 | T | XL | A Panel on a second window | layout-and-data 10 | - | - | the person has one screen; ADR 0007 |
| lf01 | T | S | Live measurement of idea names and duplicates | live-findings 01 | - | - | real classes (quota) |
| lf05 | T | M | Long waits for an answer: measure 3, 10 and 30 minutes with the real Claude Code | live-findings 05 | - | - | real Claude (quota, up to 30 min) |
| li08 | T | L | A project-kind plugin for Unity (scenes, prefabs, ScriptableObjects) | layer-inference 08 | - | - | the person: what a project-kind plugin may return |
| lp05 | T | M | One Components layer for several languages, the language in each Node's info | language-plugins 05 | - | - | - |
| pw | T | M | Detect warnings (not only failures) when Play starts parts; restart only one part quickly | housekeeping 04 | - | - | how a warning is detected (a pattern the recipe declares, the stderr, an exit code) and shown |
| rc09 | T | S | Optional: rename the Tutor's Plan to "Learning plan" | roles-and-contract 09 | - | - | the person confirms the name |
| rl | T | S | Review leftovers: shared `make` helper, `chatUi.send` seam, test that the 2000 and 8000 limits match, split the secret detector out of `54-select.js`, `chat.ts` allowedTools list | housekeeping 03 | - | - | - |
| rt06 | T | S | Test: Play's failure message offers to open the Terminal | run-and-terminal 06 | - | - | - |
| rt07 | T | S | Page test of the Stop and Restart buttons | run-and-terminal 07 | - | - | - |
| rt10 | T | S | Live check: the Builder proposes a run recipe | run-and-terminal 10 | - | - | real Builder (quota) |
| sv | T | M | A release-numbers plugin (semver, `v1.0.0`): reads the commits since the last version tag and proposes the next number (`fix` raises the last digit, `feat` the middle one, a breaking change the first), says why, the person accepts. Not the git history plugin. Ships a lesson and a teaching surface | versions 01 | - | - | - |
| tb | T | S | Merge the Canvas's own title bar with the layer bar (needs a ticket) | housekeeping 01 | - | - | - |
| v1g01 | T | S | Live check: the Builder cannot write aidea files except by Proposals | v1-gaps 01 | - | - | real Builder (quota) |

## Level 1: depends only on levels below (24 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| rc04 | T | L | The Contract and the Differences become a plugin; the Tutor stops knowing them by name | roles-and-contract 04 | pt02 | 7 | - |
| pp02 | T | M | Guard rules match by class and scope, whoever acts | plugin-policies 02 | pp01 | 5 | - |
| pl04 | T | M | Creator Mode writes and keeps the lesson | plugin-lessons 04 | pl03 | 4 | - |
| li07 | T | M | Git history tells live code from legacy (tool `read_history`) | layer-inference 07 | li02 | 3 | - |
| lp03 | T | L | TypeScript and JavaScript become a built-in plugin with a variant per system | language-plugins 03 | lp02, lp07 | 3 | - |
| rc02 | T | M | The Tutor teaches how to write an Assignment (the person writes first, the Tutor checks) | roles-and-contract 02 | rc01 | 3 | - |
| dep | T | XL | The Deployment layer (C4-style level 1, an environment selector, instances pointing at Architecture, legend, Probe and class) | deployment 01 | li03 | 1 | a spec first |
| inst | T | XL | Instances: any plugin can be started several times | roles-and-providers 03 | inst_spec, prov | 1 | waits for the Instances spec, from which its boxes are written |
| li10 | T | L | A structural index of any language from a replaceable provider (Codebase Memory first) | layer-inference 10 | lp07, cbs | 1 | the comparison spike |
| agents | T | M | Another agent adapter (Codex, Kimi, DeepSeek over ACP): a spike, then one each, as provider plugins | roles-and-providers 04 | prov | - | the person picks which agent first |
| att | T | L | The Tutor reads sources the person attaches (a folder, a web page), as untrusted data, taught as a lesson | layer-inference 12 | li03 | - | an idea |
| bp04 | T | M | The Tutor reads the structure of a project fast (overview, callers and callees, one function's code) from the structural map, whichever source fills it | big-projects 04 | li02 | - | - |
| cmp | T | M | Compare two algorithms side by side on the same data | animation-and-data 02 | anim | - | an idea |
| dbg | T | XL | A visual debugger for people who are not engineers (Playback and Data cover part) | animation-and-data 07 | anim | - | say what Playback and Data still lack for this |
| hints | T | M | Short contextual hints the first time a part is used | plugin-lessons 06 | pl02 | - | an idea |
| li01 | T | M | Opening shows the fingerprint at once and never waits for the analysis; the layers fill in as it finishes | layer-inference 01 | li02 | - | - |
| li06 | T | L | Architecture patterns judged by the Tutor and checked by the core (layered, hexagonal, event-driven, plugin-based) | layer-inference 06 | li03 | - | - |
| perf | T | XL | A performance lens: how time and memory grow with the size of the data | animation-and-data 06 | anim | - | an idea |
| pieces | T | M | More drawing pieces for Data: hash table, call stack and recursion tree, state machine, grid, weighted graph | animation-and-data 03 | anim | - | an idea |
| pt03 | T | M | A lesson part can name a check; the teach loop closes the step when it passes | plugin-teaching 03 | pt02 | - | - |
| pt05 | T | M | The Run plugin declares a real surface; live check with the real Tutor | plugin-teaching 05 | pt02 | - | - |
| pt06 | T | L | A change inside a plugin reaches the person as a lesson and a Proposal they accept (the Tutor never acts) | plugin-teaching 06 | pt02 | - | the person: how a plugin applies an accepted Proposal |
| tl | T | L | A timeline view for concurrency | animation-and-data 04 | anim | - | an idea |
| vg | T | XL | The git versions plugin: commits and files changed, the Canvas at a chosen commit, all branches as an animated graph, the state of the working folder (shown only). Ships a lesson and a teaching surface | versions 02 | anim | - | a spec first |

## Level 2: depends only on levels below (13 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| rc05 | T | M | The person approves the Contract (the Plan Mode of the whole project) and it is versioned | roles-and-contract 05 | rc04 | 4 | - |
| pt04 | T | M | The surface is required for plugins the Builder writes, a warning for the rest | plugin-teaching 04 | pl03, pl04 | 3 | - |
| li05 | T | L | The Tutor teaches the three layers of a project the person studies: Proposals the person accepts, each explained with evidence; asks only the learning goal; study notes, not a Contract | layer-inference 05 | li02, li03, li04, li07 | 2 | - |
| la05 | T | L | Run a TypeScript or JavaScript function for Playback: separate Node process with `--permission` plus a fake-network guard (decided 2026-11-03) | language-adapters 05 | lp03 | 1 | - |
| lsp | T | XL | Reuse existing language servers for `analyze`, or a light parser instead of the TypeScript compiler | language-plugins 08 | li10 | - | - |
| net | T | L | Logical network level of Deployment (subnets, VLANs) | deployment 02 | dep | - | waits for a real network engineer's diagram |
| pkg | T | XL | Packaging: one installer per system and processor (Windows, macOS, Linux; x64 and arm64), signing and notarization on macOS, the variants of the built-in plugins (today aidea runs with `electron .`) | packaging 01 | lp03, lp07 | - | a spec first (signing accounts, the CI, how updates arrive) |
| pl05 | T | M | Split the old guide into the kernel trunk and one lesson per plugin (and the live check of aidea-guide 01) | plugin-lessons 05 | pl02, rc04, lp02 | - | the person: which parts are the kernel's |
| pm | T | M | Measure aidea with a very high number of heavy plugins (after the built-in features are plugins, so the measure is the real one) | housekeeping 05 | lp02, rc04 | - | - |
| pp03 | T | L | Detect and revert a write to the Project that nobody mediated | plugin-policies 03 | pp02 | - | - |
| pp04 | T | M | The screen says, per rule and plugin, prevented or detected, and why something was stopped | plugin-policies 04 | pp02 | - | - |
| pp05 | T | S | The person can lift a policy for one task, visibly and logged | plugin-policies 05 | pp02 | - | - |
| pp07 | T | S | The authored-layer guard becomes the first policy (same behaviour, on the policy mechanism) | plugin-policies 07 | pp02 | - | - |

## Level 3: depends only on levels below (5 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| rc06 | T | L | The Contract has tasks with status and owner; the Differences become progress | roles-and-contract 06 | rc05 | 3 | - |
| rc03 | T | M | A lesson: how to ask for a plugin in Creator Mode | roles-and-contract 03 | rc02, pt04 | 2 | - |
| la13 | T | L | The record of values for TypeScript and JavaScript (nothing is recorded today) | layout-and-data 13 note | la05 | - | - |
| li09 | T | M | The blind exam moves into the repository and runs with the Tutor (three or more projects, one not in Python, repeat runs) | layer-inference 09 | li05 | - | - |
| pr | T | L | Contribute to a public repository (fork, branch, pull request); `git clone` does not exist | layer-inference 13 | li05 | - | an idea |

## Level 4: depends only on levels below (5 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| lp04 | T | S | When no plugin reads a Project's language: a plain message, the structural index if there is one, and the lesson on how to ask for a plugin (nothing is sent for the person) | language-plugins 04 | rc03 | - | - |
| lp06 | T | M | Creator Mode can write a language plugin | language-plugins 06 | rc03, pt04 | - | - |
| pp06 | T | M | The Contract plugin offers its rule: what is not in the Contract is not developed | plugin-policies 06 | pp02, rc04, rc06 | - | - |
| rc07 | T | M | A Builder works in a plan mode for each task | roles-and-contract 07 | rc01, rc06 | - | - |
| rc08 | T | L | Assignments and tasks name an instance (several Builders and Tutors) | roles-and-contract 08 | rc01, rc06, inst | - | - |

## Tickets that are not work any more

Obsolete: live-findings 04, v1-gaps 11, tutor 10. Folded into other work: aidea-guide 01's live check (plugin-lessons 05).

## Not read in this pass

`.scratch/overnight/PLAN.md` and `LOG.md`, and `.scratch/future/research-deployment-notations.md`.
