# The backlog: everything still to do, in the order of development

This is the one list the work follows (agreed with the person, 2026-11-05). It is ordered by **dependencies**: an item with no dependencies is at the top; an item that depends on others is below all of them. Size is not the criterion. Within a level the order is: the person's priorities first, then the items that unblock the most others. The list is generated from the dependency graph; when it changes, the graph changes first.

Rules:
1. **When an item is finished, it is deleted from this file** (its ticket and the git history keep the record), and the items that waited for it move up.
2. **When a new idea or decision comes up in a conversation, it is added here in the same turn**, with its dependencies, a size and its marker, and everything it changes (tickets, specs, glossary) is updated in the same turn.
3. A ticket keeps its row until it is done; when an item gets a ticket its marker changes from `D` or `I` to `T`.
4. A ticket is written for a `D` item when its dependencies are close to done.
5. Every new built-in plugin ships a lesson and a teaching surface (plugin-lessons, plugin-teaching): items that create one depend on those.

Sizes are the agent's estimate, not measured: S under an hour or two, M one session, L two or three, XL many and a spec first. Markers: `T` ticket, `D` decided without a ticket, `I` idea not decided. `wait` is something outside the work itself: a decision or hardware of the person, or quota for a live check. Last reordered: 2026-11-05 (87 items, 6 levels).
## Level 0: no dependencies

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| bp01 | T | M | Opening a big project is fast: one AST walk, effects only on demand, per-file cache outside the project (Telegram 5.2 s, target under 2 s cold and 0.5 s warm) | big-projects 01 | - | 1 | - |
| bp02 | T | M | The Components overview stays smooth with the test modules open (17 fps today, routes are the cost, target 30 fps) | big-projects 02 | - | 1 | - |
| pl01 | T | M | A plugin ships a lesson and the Tutor reads it | plugin-lessons 01 | - | 21 | - |
| pt01 | T | M | The manifest can declare a teaching surface (a read-only view and named checks) | plugin-teaching 01 | - | 19 | - |
| lp01 | T | M | The `language` slot in the plugin API, designed so that project-kind plugins and index providers fit the same family of slots | language-plugins 01 | - | 14 | - |
| li03 | T | M | Every claim in a Proposal carries evidence (files and lines; observed, inferred or unknown) and the core refuses citations that do not hold | layer-inference 03 | - | 7 | - |
| anim | D | XL | The animation engine: a language-neutral recording drawn with pieces (list, tree, graph, grid); part of it exists in Data | interviews-pending 4, ideas | - | 6 | - |
| li02 | T | M | The fingerprint of a project (tree, manifests, entry points, documents, git summary) and a Tutor tool to read it | layer-inference 02 | - | 6 | - |
| pp01 | T | M | Actions carry a class and a scope (writes in the Project, outside, runs a program, network, secrets) | plugin-policies 01 | - | 6 | - |
| rc01 | T | M | A Assignment: the person writes it and sends it to a Builder; no one else can | roles-and-contract 01 | - | 6 | - |
| li04 | T | M | A Project is my own, someone else's to study, or new: asked once, kept, changeable | layer-inference 04 | - | 3 | - |
| prov | D | XL | Roles and Providers: the Tutor and the Builder become roles filled by provider plugins; the agent adapter becomes a (required) plugin. Part of migrating the rest of the existing features into plugins (Files, Code, Playback, the layers), each with its own specification, as the plugin-system spec left it | ADR 0008, plugin-system spec 'Out of scope' | - | 3 | a spec per feature |
| cbs | I | M | Spike: measure Codebase Memory MCP as a code-graph tool for the agents on Telegram, a Unity project and a Node monorepo, with and without it (indexing writes nothing into the project; one background process per account shares the person's cache; licence not looked at) | person's idea, 2026-11-05 | - | 2 | real Tutor and Builder (quota) |
| inst_spec | D | S | Write the Instances spec: a plugin declares a minimum number of instances and can run N times (N Builders each on a branch, N Tutors, N Canvases each on a layer); the Panel registry and the saved Layout name an instance | ADR 0008 point 7; `.scratch/plugins/interview.md` 9 and 9b | - | 2 | the person |
| collab | I | XL | Real-time cursors and shared work (needs a relay server) | ideas | - | - | - |
| ed | I | S | Let the person edit the input data of a recording (the named lists cover part of it) | ideas | - | - | - |
| jr | D | S | Missing dev-journal entries (presets, keyboard, Class and Direct removal, READING, Data layer, 2026-11-04 and 2026-11-05) | `docs/journal/` | - | - | - |
| la17 | T | S | Live check of the Tutor pointing at Data (and the two lines in `50-tutor.js`) | layout-and-data 17 | - | - | real Tutor (quota) |
| la17s | T | S | Check "Save image" in Electron (the download dialog was never clicked) | layout-and-data 17 note | - | - | - |
| ld10 | T | XL | A Panel on a second window | layout-and-data 10 | - | - | the person has one screen; ADR 0007 |
| lf01 | T | S | Live measurement of idea names and duplicates | live-findings 01 | - | - | real classes (quota) |
| lf05 | T | M | Long waits for an answer: measure 3, 10 and 30 minutes with the real Claude Code | live-findings 05 | - | - | real Claude (quota, up to 30 min) |
| pw | D | M | Detect warnings (not only failures) when Play starts parts; restart only one part quickly | interviews-pending 1 | - | - | - |
| rc09 | T | S | Optional: rename the Tutor's Plan to "Learning plan" | roles-and-contract 09 | - | - | the person confirms the name |
| rl | D | S | Review leftovers: shared `make` helper, `chatUi.send` seam, test that the 2000 and 8000 limits match, split the secret detector out of `54-select.js`, `chat.ts` allowedTools list | `.scratch/code-review-2026-11-04.md` | - | - | - |
| rt06 | T | S | Test: Play's failure message offers to open the Terminal | run-and-terminal 06 | - | - | - |
| rt07 | T | S | Page test of the Stop and Restart buttons | run-and-terminal 07 | - | - | - |
| rt10 | T | S | Live check: the Builder proposes a run recipe | run-and-terminal 10 | - | - | real Builder (quota) |
| tb | D | S | Merge the Canvas's own title bar with the layer bar (needs a ticket) | interviews-pending 7 | - | - | - |
| v1g01 | T | S | Live check: the Builder cannot write aidea files except by Proposals | v1-gaps 01 | - | - | real Builder (quota) |

## Level 1: depends only on levels below (26 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| pt02 | T | M | The Tutor can read a plugin's view and run its checks, read-only and with limits | plugin-teaching 02 | pt01 | 11 | - |
| lp02 | T | L | Python becomes a built-in plugin, on by default; every test unchanged | language-plugins 02 | lp01 | 6 | - |
| lp07 | T | L | A plugin can ship a variant per system, use a program on the machine, or download one with permission | language-plugins 07 | lp01 | 6 | - |
| pl03 | T | M | Mechanical check that a lesson still names what its plugin has | plugin-lessons 03 | pl01 | 5 | - |
| pp02 | T | M | Guard rules match by class and scope, whoever acts | plugin-policies 02 | pp01 | 5 | - |
| li07 | T | M | Git history tells live code from legacy (tool `read_history`) | layer-inference 07 | li02 | 3 | - |
| rc02 | T | M | The Tutor teaches how to write an Assignment (the person writes first, the Tutor checks) | roles-and-contract 02 | rc01 | 3 | - |
| pl02 | T | M | Leave the tour at any part; choose lessons; remember progress | plugin-lessons 02 | pl01 | 2 | - |
| dep | D | XL | The Deployment layer (C4-style level 1, an environment selector, instances pointing at Architecture, legend, Probe and class) | interviews-pending 5 | li03 | 1 | a spec |
| inst | D | XL | Instances: any plugin can be started several times | the Instances spec | inst_spec, prov | 1 | - |
| agents | I | M | Another agent adapter (Codex, Kimi, DeepSeek over ACP): a spike, then one each, as provider plugins | ideas, harness research | prov | - | - |
| att | I | L | The Tutor reads sources the person attaches (a folder, a web page), as untrusted data, taught as a lesson | ideas | li03 | - | - |
| bp03 | T | S | Say why module pairs are hidden and let the person see them | big-projects 03 | bp02 | - | - |
| bp04 | T | M | The Tutor reads the structure of a project fast (overview, callers and callees, one function's code) from the structural map, whichever source fills it | big-projects 04 | bp01, li02 | - | - |
| cmp | I | M | Compare two algorithms side by side on the same data | ideas | anim | - | - |
| dbg | I | XL | A visual debugger for people who are not engineers (Playback and Data cover part) | ideas | anim | - | - |
| jn | D | XL | Guided, game-like journeys with achievements: a sample Python Project that ships inside aidea, the interface reporting actions, a progress map | interviews-pending 6 | pl01 | - | a spec; wording of Tutor story 31 |
| li01 | T | M | Opening shows the fingerprint at once and never waits for the analysis; the layers fill in as it finishes | layer-inference 01 | li02 | - | - |
| li06 | T | L | Architecture patterns judged by the Tutor and checked by the core (layered, hexagonal, event-driven, plugin-based) | layer-inference 06 | li03 | - | - |
| li08 | T | L | A project-kind plugin for Unity (scenes, prefabs, ScriptableObjects) | layer-inference 08 | lp01, pl01, pt01 | - | the person: what a project-kind plugin may return |
| lp05 | T | M | One Components layer for several languages, the language in each Node's info | language-plugins 05 | lp01 | - | - |
| perf | I | XL | A performance lens: how time and memory grow with the size of the data | ideas | anim | - | - |
| pieces | I | M | More drawing pieces for Data: hash table, call stack and recursion tree, state machine, grid, weighted graph | ideas | anim | - | - |
| sv | D | M | A release-numbers plugin (semver, `v1.0.0`): reads the commits since the last version tag and proposes the next number (`fix` raises the last digit, `feat` the middle one, a breaking change the first), says why, the person accepts. Not the git history plugin. Ships a lesson and a teaching surface | person's idea, 2026-11-04 | pl01, pt01 | - | - |
| tl | I | L | A timeline view for concurrency | ideas | anim | - | - |
| vg | D | XL | The git versions plugin: commits and files changed, the Canvas at a chosen commit, all branches as an animated graph, the state of the working folder (shown only). Ships a lesson and a teaching surface | interviews-pending 4 | anim, pl01, pt01 | - | - |

## Level 2: depends only on levels below (14 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| rc04 | T | L | The Contract and the Differences become a plugin; the Tutor stops knowing them by name | roles-and-contract 04 | pt01, pt02, pl01 | 7 | - |
| pl04 | T | M | Creator Mode writes and keeps the lesson | plugin-lessons 04 | pl01, pl03 | 4 | - |
| lp03 | T | L | TypeScript and JavaScript become a built-in plugin with a variant per system | language-plugins 03 | lp01, lp02, lp07 | 3 | - |
| li05 | T | L | The Tutor teaches the three layers of a project the person studies: Proposals the person accepts, each explained with evidence; asks only the learning goal; study notes, not a Contract | layer-inference 05 | li02, li03, li04, li07 | 2 | - |
| li10 | T | L | A structural index of any language from a replaceable provider (Codebase Memory first) | layer-inference 10 | lp01, lp07, cbs | 1 | the comparison spike |
| hints | I | M | Short contextual hints the first time a part is used | ideas | pl01, pl02 | - | - |
| net | I | L | Logical network level of Deployment (subnets, VLANs) | interviews-pending 5 | dep | - | a real network engineer's diagram |
| pp03 | T | L | Detect and revert a write to the Project that nobody mediated | plugin-policies 03 | pp02 | - | - |
| pp04 | T | M | The screen says, per rule and plugin, prevented or detected, and why something was stopped | plugin-policies 04 | pp02 | - | - |
| pp05 | T | S | The person can lift a policy for one task, visibly and logged | plugin-policies 05 | pp02 | - | - |
| pp07 | T | S | The authored-layer guard becomes the first policy (same behaviour, on the policy mechanism) | plugin-policies 07 | pp02 | - | - |
| pt03 | T | M | A lesson part can name a check; the teach loop closes the step when it passes | plugin-teaching 03 | pt02, pl01 | - | - |
| pt05 | T | M | The Run plugin declares a real surface; live check with the real Tutor | plugin-teaching 05 | pt02 | - | - |
| pt06 | T | L | A change inside a plugin reaches the person as a lesson and a Proposal they accept (the Tutor never acts) | plugin-teaching 06 | pt02 | - | the person: how a plugin applies an accepted Proposal |

## Level 3: depends only on levels below (9 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| rc05 | T | M | The person approves the Contract (the Plan Mode of the whole project) and it is versioned | roles-and-contract 05 | rc04 | 4 | - |
| pt04 | T | M | The surface is required for plugins the Builder writes, a warning for the rest | plugin-teaching 04 | pt01, pl03, pl04 | 3 | - |
| la05 | T | L | Run a TypeScript or JavaScript function for Playback: separate Node process with `--permission` plus a fake-network guard (decided 2026-11-03) | language-adapters 05 | lp03 | 1 | - |
| li09 | T | M | The blind exam moves into the repository and runs with the Tutor (three or more projects, one not in Python, repeat runs) | layer-inference 09 | li05 | - | - |
| lsp | I | XL | Reuse existing language servers for `analyze`, or a light parser instead of the TypeScript compiler | language-plugins spec, 'Later' | li10 | - | - |
| pkg | D | XL | Packaging: one installer per system and processor (Windows, macOS, Linux; x64 and arm64), signing and notarization on macOS, the variants of the built-in plugins (today aidea runs with `electron .`) | language-plugins spec | lp03, lp07 | - | - |
| pl05 | T | M | Split the old guide into the kernel trunk and one lesson per plugin (and the live check of aidea-guide 01) | plugin-lessons 05 | pl01, pl02, rc04, lp02 | - | the person: which parts are the kernel's |
| pm | D | M | Measure aidea with a very high number of heavy plugins (after the built-in features are plugins, so the measure is the real one) | person's note | lp02, rc04 | - | - |
| pr | I | L | Contribute to a public repository (fork, branch, pull request); `git clone` does not exist | interviews-pending 6 | li05 | - | - |

## Level 4: depends only on levels below (3 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| rc06 | T | L | The Contract has tasks with status and owner; the Differences become progress | roles-and-contract 06 | rc05 | 3 | - |
| rc03 | T | M | A lesson: how to ask for a plugin in Creator Mode | roles-and-contract 03 | rc02, pt04 | 2 | - |
| la13 | T | L | The record of values for TypeScript and JavaScript (nothing is recorded today) | layout-and-data 13 note | la05 | - | - |

## Level 5: depends only on levels below (5 items)

| ID | | Size | Work | Where | Depends on | Unblocks | Wait |
|---|---|---|---|---|---|---|---|
| lp04 | T | S | When no plugin reads a Project's language: a plain message, the structural index if there is one, and the lesson on how to ask for a plugin (nothing is sent for the person) | language-plugins 04 | lp01, rc03 | - | - |
| lp06 | T | M | Creator Mode can write a language plugin | language-plugins 06 | lp01, rc03, pt04 | - | - |
| pp06 | T | M | The Contract plugin offers its rule: what is not in the Contract is not developed | plugin-policies 06 | pp02, rc04, rc06 | - | - |
| rc07 | T | M | A Builder works in a plan mode for each task | roles-and-contract 07 | rc01, rc06 | - | - |
| rc08 | T | L | Assignments and tasks name an instance (several Builders and Tutors) | roles-and-contract 08 | rc01, rc06, inst | - | - |

## Tickets that are not work any more

Obsolete: live-findings 04, v1-gaps 11, tutor 10. Folded into other work: aidea-guide 01's live check (plugin-lessons 05).

## Not read in this pass

`.scratch/overnight/PLAN.md` and `LOG.md`, and `.scratch/future/research-deployment-notations.md`.
