// The backlog as data: id, k (T ticket), s (size), t (work), w (where), d (dependencies), ext (wait), file (folder/NN of its ticket), prio.
export const items = [
 {
  "id": "bp05",
  "k": "T",
  "s": "L",
  "file": "big-projects/05",
  "t": "The cold analysis of a big project takes under 2 s: per-file facts extracted in parallel worker processes, resolved across files; incremental",
  "w": "big-projects 05",
  "d": []
 },
 {
  "id": "bp04",
  "k": "T",
  "s": "M",
  "file": "big-projects/04",
  "t": "The Tutor reads the structure of a project fast (overview, callers and callees, one function's code) from the structural map, whichever source fills it",
  "w": "big-projects 04",
  "d": [
   "li02"
  ]
 },
 {
  "id": "li02",
  "k": "T",
  "s": "M",
  "file": "layer-inference/02",
  "t": "The fingerprint of a project (tree, manifests, entry points, documents, git summary) and a Tutor tool to read it",
  "w": "layer-inference 02",
  "d": []
 },
 {
  "id": "li04",
  "k": "T",
  "s": "M",
  "file": "layer-inference/04",
  "t": "A Project is my own, someone else's to study, or new: asked once, kept, changeable",
  "w": "layer-inference 04",
  "d": []
 },
 {
  "id": "li01",
  "k": "T",
  "s": "M",
  "file": "layer-inference/01",
  "t": "Opening shows the fingerprint at once and never waits for the analysis; the layers fill in as it finishes",
  "w": "layer-inference 01",
  "d": [
   "li02"
  ]
 },
 {
  "id": "li07",
  "k": "T",
  "s": "M",
  "file": "layer-inference/07",
  "t": "Git history tells live code from legacy (tool `read_history`)",
  "w": "layer-inference 07",
  "d": [
   "li02"
  ]
 },
 {
  "id": "li06",
  "k": "T",
  "s": "L",
  "file": "layer-inference/06",
  "t": "Architecture patterns judged by the Tutor and checked by the core (layered, hexagonal, event-driven, plugin-based)",
  "w": "layer-inference 06",
  "d": []
 },
 {
  "id": "li05",
  "k": "T",
  "s": "L",
  "file": "layer-inference/05",
  "t": "The Tutor teaches the three layers of a project the person studies: Proposals the person accepts, each explained with evidence; asks only the learning goal; study notes, not a Contract",
  "w": "layer-inference 05",
  "d": [
   "li02",
   "li04",
   "li07"
  ]
 },
 {
  "id": "li09",
  "k": "T",
  "s": "M",
  "file": "layer-inference/09",
  "t": "The blind exam moves into the repository and runs with the Tutor (three or more projects, one not in Python, repeat runs)",
  "w": "layer-inference 09",
  "d": [
   "li05"
  ]
 },
 {
  "id": "li08",
  "k": "T",
  "s": "L",
  "file": "layer-inference/08",
  "ext": "the person: what a project-kind plugin may return",
  "t": "A project-kind plugin for Unity (scenes, prefabs, ScriptableObjects)",
  "w": "layer-inference 08",
  "d": []
 },
 {
  "id": "li10",
  "k": "T",
  "s": "L",
  "file": "layer-inference/10",
  "ext": "the comparison spike",
  "t": "A structural index of any language from a replaceable provider (Codebase Memory first)",
  "w": "layer-inference 10",
  "d": [
   "lp07",
   "cbs"
  ]
 },
 {
  "id": "cbs",
  "k": "T",
  "s": "M",
  "ext": "quota",
  "t": "Spike: measure Codebase Memory MCP as a code-graph tool for the agents on Telegram, a Unity project and a Node monorepo, with and without it (indexing writes nothing into the project; one background process per account shares the person's cache; licence not looked at)",
  "w": "layer-inference 11",
  "d": [],
  "file": "layer-inference/11"
 },
 {
  "id": "lp07",
  "k": "T",
  "s": "L",
  "file": "language-plugins/07",
  "t": "A plugin can ship a variant per system, use a program on the machine, or download one with permission",
  "w": "language-plugins 07",
  "d": []
 },
 {
  "id": "lp05",
  "k": "T",
  "s": "M",
  "file": "language-plugins/05",
  "t": "One Components layer for several languages, the language in each Node's info",
  "w": "language-plugins 05",
  "d": []
 },
 {
  "id": "lp03",
  "k": "T",
  "s": "L",
  "file": "language-plugins/03",
  "t": "TypeScript and JavaScript become a built-in plugin with a variant per system",
  "w": "language-plugins 03",
  "d": [
   "lp07"
  ]
 },
 {
  "id": "la05",
  "k": "T",
  "s": "L",
  "t": "Run a TypeScript or JavaScript function for Playback: separate Node process with `--permission` plus a fake-network guard (decided 2026-11-03)",
  "w": "language-adapters 05",
  "d": [
   "lp03"
  ]
 },
 {
  "id": "la13",
  "k": "T",
  "s": "L",
  "t": "The record of values for TypeScript and JavaScript (nothing is recorded today)",
  "w": "layout-and-data 13 note",
  "d": [
   "la05"
  ]
 },
 {
  "id": "pl02",
  "k": "T",
  "s": "M",
  "file": "plugin-lessons/02",
  "t": "Leave the tour at any part; choose lessons; remember progress",
  "w": "plugin-lessons 02",
  "d": []
 },
 {
  "id": "pl05",
  "k": "T",
  "s": "M",
  "file": "plugin-lessons/05",
  "ext": "the person: which parts are the kernel's",
  "t": "Split the old guide into the kernel trunk and one lesson per plugin (and the live check of aidea-guide 01)",
  "w": "plugin-lessons 05",
  "d": [
   "pl02"
  ]
 },
 {
  "id": "pt06",
  "k": "T",
  "s": "L",
  "file": "plugin-teaching/06",
  "ext": "the person: how a plugin applies an accepted Proposal",
  "t": "A change inside a plugin reaches the person as a lesson and a Proposal they accept (the Tutor never acts)",
  "w": "plugin-teaching 06",
  "d": []
 },
 {
  "id": "rc05",
  "k": "T",
  "s": "M",
  "file": "roles-and-contract/05",
  "ext": "Decide what the plugin stores: the Contract is only a computed summary for now",
  "t": "The person approves the Contract (the Plan Mode of the whole project) and it is versioned",
  "w": "roles-and-contract 05",
  "d": []
 },
 {
  "id": "rc06",
  "k": "T",
  "s": "L",
  "file": "roles-and-contract/06",
  "t": "The Contract has tasks from the Architecture (first) and the Requirements (after), with status and owner; the Differences become progress",
  "w": "roles-and-contract 06",
  "d": [
   "rc05"
  ]
 },
 {
  "id": "rc08",
  "k": "T",
  "s": "L",
  "file": "roles-and-contract/08",
  "t": "Assignments and tasks name an instance (several Builders and Tutors)",
  "w": "roles-and-contract 08",
  "d": [
   "rc06",
   "inst"
  ]
 },
 {
  "id": "rc09",
  "k": "T",
  "s": "S",
  "file": "roles-and-contract/09",
  "ext": "the person confirms the name",
  "t": "Optional: rename the Tutor's Plan to \"Learning plan\" (the Plan of the rewritten Tutor is the one LearnHarness shows)",
  "w": "roles-and-contract 09",
  "d": []
 },
 {
  "id": "pp02",
  "k": "T",
  "s": "M",
  "file": "plugin-policies/02",
  "t": "Guard rules match by class and scope, whoever acts",
  "w": "plugin-policies 02",
  "d": []
 },
 {
  "id": "pp04",
  "k": "T",
  "s": "M",
  "file": "plugin-policies/04",
  "t": "The screen says, per rule and plugin, prevented or detected, and why something was stopped",
  "w": "plugin-policies 04",
  "d": [
   "pp02"
  ]
 },
 {
  "id": "pp05",
  "k": "T",
  "s": "S",
  "file": "plugin-policies/05",
  "t": "The person can lift a policy for one task, visibly and logged",
  "w": "plugin-policies 05",
  "d": [
   "pp02"
  ]
 },
 {
  "id": "pp07",
  "k": "T",
  "s": "S",
  "file": "plugin-policies/07",
  "t": "The authored-layer guard becomes the first policy (same behaviour, on the policy mechanism)",
  "w": "plugin-policies 07",
  "d": [
   "pp02"
  ]
 },
 {
  "id": "pp03",
  "k": "T",
  "s": "L",
  "file": "plugin-policies/03",
  "t": "Detect and revert a write to the Project that nobody mediated",
  "w": "plugin-policies 03",
  "d": [
   "pp02"
  ]
 },
 {
  "id": "pp06",
  "k": "T",
  "s": "M",
  "file": "plugin-policies/06",
  "t": "The Contract plugin offers its rule: what is not in the Contract is not developed",
  "w": "plugin-policies 06",
  "d": [
   "pp02",
   "rc06"
  ]
 },
 {
  "id": "rt10",
  "k": "T",
  "s": "S",
  "ext": "real Builder (quota)",
  "t": "Live check: the Builder proposes a run recipe",
  "w": "run-and-terminal 10",
  "d": []
 },
 {
  "id": "v1g01",
  "k": "T",
  "s": "S",
  "ext": "real Builder (quota)",
  "t": "Live check: the Builder cannot write aidea files except by Proposals",
  "w": "v1-gaps 01",
  "d": []
 },
 {
  "id": "la17",
  "k": "T",
  "s": "S",
  "ext": "real Tutor (quota)",
  "t": "Live check of the Tutor pointing at Data (and the two lines in `50-tutor.js`)",
  "w": "layout-and-data 17",
  "d": []
 },
 {
  "id": "la17s",
  "k": "T",
  "s": "S",
  "t": "Check \"Save image\" in Electron (the download dialog was never clicked)",
  "w": "layout-and-data 17 note",
  "d": []
 },
 {
  "id": "lf01",
  "k": "T",
  "s": "S",
  "ext": "real classes (quota)",
  "t": "Live measurement of idea names and duplicates",
  "w": "live-findings 01",
  "d": []
 },
 {
  "id": "lf05",
  "k": "T",
  "s": "M",
  "ext": "real Claude (quota, up to 30 min)",
  "t": "Long waits for an answer: measure 3, 10 and 30 minutes with the real Claude Code",
  "w": "live-findings 05",
  "d": []
 },
 {
  "id": "ld10",
  "k": "T",
  "s": "XL",
  "ext": "the person has one screen; ADR 0007",
  "t": "A Panel on a second window",
  "w": "layout-and-data 10",
  "d": []
 },
 {
  "id": "tb",
  "k": "T",
  "s": "S",
  "t": "Merge the Canvas's own title bar with the layer bar (needs a ticket)",
  "w": "housekeeping 01",
  "d": [],
  "file": "housekeeping/01"
 },
 {
  "id": "pw",
  "k": "T",
  "s": "M",
  "t": "Detect warnings (not only failures) when Play starts parts; restart only one part quickly",
  "w": "housekeeping 04",
  "d": [],
  "file": "housekeeping/04",
  "ext": "how a warning is detected (a pattern the recipe declares, the stderr, an exit code) and shown"
 },
 {
  "id": "pm",
  "k": "T",
  "s": "M",
  "t": "Measure aidea with a very high number of heavy plugins (after the built-in features are plugins, so the measure is the real one)",
  "w": "housekeeping 05",
  "d": [],
  "file": "housekeeping/05"
 },
 {
  "id": "sv",
  "k": "T",
  "s": "M",
  "t": "A release-numbers plugin (semver, `v1.0.0`): reads the commits since the last version tag and proposes the next number (`fix` raises the last digit, `feat` the middle one, a breaking change the first), says why, the person accepts. Not the git history plugin. Ships a lesson and a teaching surface",
  "w": "versions 01",
  "d": [],
  "file": "versions/01"
 },
 {
  "id": "prov",
  "k": "T",
  "s": "XL",
  "ext": "the spec the plugin-system spec left out (which services stay single-instance, the list of named slots, the required plugins)",
  "t": "Roles and Providers: the Tutor and the Builder become roles filled by provider plugins; the agent adapter becomes a (required) plugin. Part of migrating the rest of the existing features into plugins (Files, Code, Playback, the layers), each with its own specification, as the plugin-system spec left it",
  "w": "roles-and-providers 01",
  "d": [],
  "file": "roles-and-providers/01"
 },
 {
  "id": "inst_spec",
  "k": "T",
  "s": "S",
  "ext": "the person decides the open points",
  "t": "Write the Instances spec: a plugin declares a minimum number of instances and can run N times (N Builders each on a branch, N Tutors, N Canvases each on a layer); the Panel registry and the saved Layout name an instance",
  "w": "roles-and-providers 02",
  "d": [],
  "file": "roles-and-providers/02"
 },
 {
  "id": "inst",
  "k": "T",
  "s": "XL",
  "t": "Instances: any plugin can be started several times",
  "w": "roles-and-providers 03",
  "d": [
   "inst_spec",
   "prov"
  ],
  "file": "roles-and-providers/03",
  "ext": "waits for the Instances spec, from which its boxes are written"
 },
 {
  "id": "pkg",
  "k": "T",
  "s": "XL",
  "t": "Packaging: one installer per system and processor (Windows, macOS, Linux; x64 and arm64), signing and notarization on macOS, the variants of the built-in plugins (today aidea runs with `electron .`)",
  "w": "packaging 01",
  "d": [
   "lp03",
   "lp07"
  ],
  "file": "packaging/01",
  "ext": "a spec first (signing accounts, the CI, how updates arrive)"
 },
 {
  "id": "anim",
  "k": "T",
  "s": "XL",
  "t": "The animation engine: a language-neutral recording drawn with pieces (list, tree, graph, grid); part of it exists in Data",
  "w": "animation-and-data 01",
  "d": [],
  "file": "animation-and-data/01",
  "ext": "a spec first (what exists in Data and what the engine adds)"
 },
 {
  "id": "vg",
  "k": "T",
  "s": "XL",
  "t": "The git versions plugin: commits and files changed, the Canvas at a chosen commit, all branches as an animated graph, the state of the working folder (shown only). Ships a lesson and a teaching surface",
  "w": "versions 02",
  "d": [
   "anim"
  ],
  "file": "versions/02",
  "ext": "a spec first"
 },
 {
  "id": "dep",
  "k": "T",
  "s": "XL",
  "ext": "a spec first",
  "t": "The Deployment layer (C4-style level 1, an environment selector, instances pointing at Architecture, legend, Probe and class)",
  "w": "deployment 01",
  "d": [],
  "file": "deployment/01"
 },
 {
  "id": "jn",
  "k": "T",
  "s": "XL",
  "ext": "a spec first and the wording of Tutor story 31 (no score is kept)",
  "t": "Guided, game-like journeys with achievements: a sample Python Project that ships inside aidea, the interface reporting actions, a progress map",
  "w": "guided-journeys 01",
  "d": [],
  "file": "guided-journeys/01"
 },
 {
  "id": "ed",
  "k": "T",
  "s": "S",
  "t": "Let the person edit the input data of a recording (the named lists cover part of it)",
  "w": "animation-and-data 05",
  "d": [],
  "file": "animation-and-data/05"
 },
 {
  "id": "cmp",
  "k": "T",
  "s": "M",
  "t": "Compare two algorithms side by side on the same data",
  "w": "animation-and-data 02",
  "d": [
   "anim"
  ],
  "file": "animation-and-data/02",
  "ext": "an idea"
 },
 {
  "id": "pieces",
  "k": "T",
  "s": "M",
  "t": "More drawing pieces for Data: hash table, call stack and recursion tree, state machine, grid, weighted graph",
  "w": "animation-and-data 03",
  "d": [
   "anim"
  ],
  "file": "animation-and-data/03",
  "ext": "an idea"
 },
 {
  "id": "hints",
  "k": "T",
  "s": "M",
  "t": "Short contextual hints the first time a part is used",
  "w": "plugin-lessons 06",
  "d": [
   "pl02"
  ],
  "file": "plugin-lessons/06",
  "ext": "an idea"
 },
 {
  "id": "agents",
  "k": "T",
  "s": "M",
  "t": "Another agent adapter (Codex, Kimi, DeepSeek over ACP): a spike, then one each, as provider plugins",
  "w": "roles-and-providers 04",
  "d": [
   "prov"
  ],
  "file": "roles-and-providers/04",
  "ext": "the person picks which agent first"
 },
 {
  "id": "tl",
  "k": "T",
  "s": "L",
  "t": "A timeline view for concurrency",
  "w": "animation-and-data 04",
  "d": [
   "anim"
  ],
  "file": "animation-and-data/04",
  "ext": "an idea"
 },
 {
  "id": "att",
  "k": "T",
  "s": "L",
  "t": "The Tutor reads sources the person attaches (a folder, a web page), as untrusted data, taught as a lesson",
  "w": "layer-inference 12",
  "d": [],
  "file": "layer-inference/12",
  "ext": "an idea"
 },
 {
  "id": "pr",
  "k": "T",
  "s": "L",
  "t": "Contribute to a public repository (fork, branch, pull request); `git clone` does not exist",
  "w": "layer-inference 13",
  "d": [
   "li05"
  ],
  "file": "layer-inference/13",
  "ext": "an idea"
 },
 {
  "id": "net",
  "k": "T",
  "s": "L",
  "ext": "waits for a real network engineer's diagram",
  "t": "Logical network level of Deployment (subnets, VLANs)",
  "w": "deployment 02",
  "d": [
   "dep"
  ],
  "file": "deployment/02"
 },
 {
  "id": "perf",
  "k": "T",
  "s": "XL",
  "t": "A performance lens: how time and memory grow with the size of the data",
  "w": "animation-and-data 06",
  "d": [
   "anim"
  ],
  "file": "animation-and-data/06",
  "ext": "an idea"
 },
 {
  "id": "dbg",
  "k": "T",
  "s": "XL",
  "t": "A visual debugger for people who are not engineers (Playback and Data cover part)",
  "w": "animation-and-data 07",
  "d": [
   "anim"
  ],
  "file": "animation-and-data/07",
  "ext": "say what Playback and Data still lack for this"
 },
 {
  "id": "collab",
  "k": "T",
  "s": "XL",
  "t": "Real-time cursors and shared work (needs a relay server)",
  "w": "collaboration 01",
  "d": [],
  "file": "collaboration/01",
  "ext": "an idea"
 },
 {
  "id": "lsp",
  "k": "T",
  "s": "XL",
  "t": "Reuse existing language servers for `analyze`, or a light parser instead of the TypeScript compiler",
  "w": "language-plugins 08",
  "d": [
   "li10"
  ],
  "file": "language-plugins/08"
 },
 {
  "id": "tr08",
  "k": "T",
  "s": "L",
  "file": "tutor-rewrite/08",
  "t": "The Tutor stops knowing the layers, the differences, the Contract and the guide by name: it learns each one from its plugin's lesson, view and checks",
  "w": "tutor-rewrite 08",
  "d": [
   "pl05",
   "tr09"
  ]
 },
 {
  "id": "tr09",
  "k": "T",
  "s": "L",
  "file": "tutor-rewrite/09",
  "t": "The three authored layers (Business, Requirements, Architecture) become plugins with a lesson, a view and checks, so the Tutor uses them like any other",
  "w": "tutor-rewrite 09",
  "d": [],
  "ext": "the person decides whether the three authored layers become plugins"
 },
 {
  "id": "tr10",
  "k": "T",
  "s": "S",
  "file": "tutor-rewrite/10",
  "t": "The Learner graph starts empty in the first build: the person is its first learner",
  "w": "tutor-rewrite 10",
  "d": [
   "pkg"
  ]
 },
 {
  "id": "pt08",
  "k": "T",
  "s": "M",
  "file": "plugin-teaching/08",
  "ext": "Playback must first be a plugin",
  "t": "Playback declares a teaching surface (the recordings made, the step reached; checks) once it is a plugin",
  "w": "plugin-teaching 08",
  "d": [
   "prov"
  ]
 },
 {
  "id": "bnp",
  "k": "T",
  "s": "M",
  "file": "roles-and-contract/11",
  "t": "The Builder cannot propose changes to the layers: it stops and says in the chat what the Contract lacks",
  "w": "roles-and-contract 11",
  "d": []
 }
];
