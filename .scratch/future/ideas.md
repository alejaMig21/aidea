# Ideas for future versions

Not tickets and not scheduled. Each line says where the idea came from; the settled design behind the first four is in `docs/adr/0004` and `0005` and the notes below.

## Settled direction (from the performance and teamwork grill)

- **Language adapters first** (ADR 0004): analyse, flow graph and run one function, behind one interface; Python first, TypeScript and JavaScript second so aidea can run on aidea.
- **Animation engine inside Algorithms:** a language-neutral recording of a run from the adapters; drawing pieces for a list, a weighted graph, a tree and a grid (stack, queue and heap are a list with a role label); and **bindings** that say which variable is which piece. The builder declares the bindings of code it wrote, the Tutor infers them for code written by others, and the person is never obliged to answer, only able to correct. Every binding records its origin and an inferred one is drawn as an assumption. Bindings live in `.aidea/`, written by a core tool, never as comments in code.
- **Performance lens** over Components and Algorithms, after the engine: first question is how time and memory grow with the size of the data. Measured in the same adapters; no estimates promised before then.
- **Teamwork:** one file per Node (ADR 0005). Real-time cursors wait for hand-editable graphs and need a relay server. What a person understands stays private.

Order: teamwork storage any time; language adapters, then the engine, then the lens.

## Pieces and features parked for later

- More drawing pieces: hash table, linked list, text with highlighted ranges, state machine, call stack and recursion tree.
- Compare two algorithms side by side on the same data.
- Let the person edit the input data of an animation.
- A timeline view for concurrency.
- A deployment view for networks and infrastructure (C4 has one; today Architecture does not draw where each part runs).
- Reconstruct the layers of an existing project: a Tutor class that reads the code and proposes Business, Requirements and Architecture, each Proposal citing the files it rests on.
- The Tutor reading sources the person attaches (a folder, a web page), read-only and treated as untrusted data.

## Added by the person on 2026-10-29 (overnight session)

- **A visual debugger for people who are not engineers.** Debuggers have a thousand options and most people only use "next step" and read the variables. Close that gap: say in plain words what each step did, and let the person guess the next value before stepping (tickets in `.scratch/run-in-plain-words`). Later: show a variable's history, jump to the step where a value changed, explain an exception where it happened.
- **The Tutor teaches aidea itself.** A "Teach me through aidea" class for the app's own parts (ticket in `.scratch/aidea-guide`). Later: short contextual hints the first time a part is used, and an end-of-class pointer to the part of the app that fits.
- **aidea understands the aidea repository.** Needs the TypeScript and JavaScript adapter (`.scratch/language-adapters`), then a report of what is useful when reading a real, large repository (`.scratch/real-projects/issues/02`).
- **The person's own projects** (`hubstaff-automation`, `Telegram`): work with aidea on them; first a read-only viability check (`.scratch/real-projects/issues/01`).
- The bridge between the person and their own apps: while aidea is being built that gap still exists, so at the moment of truth the person needs to understand everything that happens. Whatever is built should favour showing what happens over hiding it.

## Added by the person on 2026-10-30

- **The interface spread over N screens.** The person works with several monitors: the Canvas on one and the Builder and the Tutor on another. Layout **presets** chosen from a menu (no dragging of columns needed), for example "everything on one screen", "Canvas alone on screen 2, Builder and Tutor on screen 1". Needs the three areas to be separate windows of the same running app that share one core and one state, and the Canvas can already be hidden per window (tonight's fold button) which is the first brick. Open questions: one Electron window per area or a free split, remembering the preset per set of monitors, and what happens when a monitor is unplugged.

## Added by the person on 2026-10-31 (parked until the first version is finished)

- **Guided journeys, game-like, for a person who has never programmed.** Tutorials that treat the person as a complete beginner and teach 100% of the aidea workflow in two journeys: (1) working on a public repository that is not theirs (understand it first; fetching it; maybe contributing), (2) a new project from zero (idea, Business, Requirements, Architecture, first code, running it). Existing support: "How aidea works" (`.scratch/aidea-guide`), "Teach me through it" on each layer, Probe, Plan, New project on Home. Gaps found: game feel (missions, visible progress, prompts on the real interface), a zero-tech vocabulary, no `git clone`, no reconstruction of Business/Requirements from code, no fork/branch/PR teaching, no environment setup, and the guide predates the Panels, Files, Code, Run and the saved Layout. Open decisions: tension with "no score or level is kept about the person" (Tutor spec story 31), whether "someone else's repo" means understand only or also contribute, and the default language for a beginner. Next step when resumed: `/grill-with-docs`, then `/to-spec` and `/to-tickets`.

## Added by the person on 2026-10-31 (plugins, terminal, versions; not scheduled, after the first version)

- **Plugins, as in Visual Studio.** For aidea to be an interesting product it should accept plugins the person installs. WHICH kinds of plugin is still to be debated (candidates: a new Panel, a language adapter, a layer or a kind of drawing, Tutor content, a Preset pack). Needs a grill before any ticket: the extension points, the plugin API, how a plugin is installed, enabled and removed, and what a plugin is allowed to do (it runs code the person did not write).
- **A terminal section.** A Panel to run commands and watch the processes they start, as an IDE does. Open points: the shell runs in the Project folder; how it relates to the Builder's permission cards and to Run and Playback; whether a native pseudo-terminal dependency is acceptable (ADR 0003 says no new dependencies without a reason); what the person sees of processes aidea itself started.
- **Project versions as a plugin we write ourselves.** Visualise the versions of the project (its git history: commits, branches, what changed). The authored layers live in `.aidea/` inside the repository, so a past version also holds the layers as they were: the Canvas at a past version is the interesting part. It should be the first plugin, which makes it the test of the plugin design.
- **Networking in the Architecture layer.** Today it draws C4 boxes (Person, Software System, Container, Component, with an `external` flag) and relations that carry a label and a `technology` (for example HTTPS or SQL), so a service talking to another service, a database or an outside system can be shown. It does not draw where each part runs (hosts, ports, networks, boundaries between them): that is the deployment view already parked above.

## Added by the person on 2026-10-31 (run the whole project)

- **Run the whole project, not one function.** The Run panel plays one function; it cannot start a project, and its name suggests it can. The executor should bring up everything (backend, frontend, ...) by itself. An orchestrating agent is one option and may be too much; see `.scratch/future/interviews-pending.md`, topic 1.

## DeepSeek Harness and Creator Mode (noted 2026-11-04)

- DeepSeek announced Creator Mode for its open-source Harness agent platform on 2026-11-02: plugins built from plain English (sidebar 3D viewers, a paper reader, a statistics page over conversation data, a video editor, a theme). Sources are news pages only; the plugin API, the security model and the licence were not found. Not read: the Harness repository or docs.
- Why it matters to aidea: (1) a possible further agent adapter, as Codex or OpenCode (ADR 0001 keeps aidea from owning an agent loop); (2) the idea to copy for topic 2 (plugins): the Builder writes a plugin from a description into the quarantine folder, aidea scans it, the person installs it. Open: could aidea own pieces (layers, Contract, Tutor) as plugins of such a harness? Needs the plugin API first.
- Followed up on 2026-11-04 with a primary-source read of the repository (MIT, version 0.2.2-alpha.3, developer preview): `.scratch/harness/research/02-deepseek-harness.md`. Verdict there: a further ACP adapter is plausible (needs a spike and a pinned version); building aidea itself as plugins of it is not advised; copying the Creator mode ideas is cheap.
