# aidea v1: audit of the 55 user stories against the code

Branch `overnight/autonomy`. Method: read the spec, tickets, ADRs and the code; evidence is a test name or file (ticket titles were not trusted). Interface-only behaviour is backed by `.scratch/electron-smoke-report.md` (headless run of the real Electron shell) where noted, since the spec says the interface has no automated tests.

## Summary

| Status | Count |
|---|---|
| DONE | 47 |
| PARTIAL | 7 (22, 23, 26, 35, 48, 53, 55) |
| MISSING | 0 |
| CHANGED | 1 (41) |

Legend: DONE = behaviour exists and a test or headless check shows it. PARTIAL = part of the story works, the rest does not. CHANGED = the project decided otherwise (cited).

## Stories

| # | Story | Status | Evidence |
|---|---|---|---|
| 1 | Open a Python repo as a Project | DONE | test/protocol.test.ts "opening a Python Project returns Nodes..."; src/core/routes/projects.ts |
| 2 | List of Projects to switch | DONE | test/protocol.test.ts "an opened Project appears in the Projects list", test/recents.test.ts; src/ui/features/06-topbar.js (switcher, not a left column: see ui-redesign) |
| 3 | Pan and zoom freely | DONE | src/ui/features/00-canvas.js:11 (pan/zoom); smoke report check 5. No automated test (interface) |
| 4 | Six named Layers | DONE | src/ui/index.html:173-174 (six `data-layer` tabs, order 1 to 6) |
| 5 | Business layer is the Business Model Canvas | DONE | test/business-canvas.test.ts "the nine blocks sit in the canonical canvas arrangement"; src/core/authored.ts:26 |
| 6 | Requirements layer holds user stories | DONE | test/requirements-kinds.test.ts; src/ui/features/46-requirements.js |
| 7 | Architecture layer shows pieces and technology | DONE | test/architecture-data.test.ts, test/architecture-layout.test.ts |
| 8 | Node carries Rationale with rejected alternatives | DONE | test/authored.test.ts:13; src/core/authored.ts (rationale.why / rejected) |
| 9 | Rationale in the side panel on select | DONE | src/ui/features/20-authored.js:22 `showRationale`; ticket 03 (right panel, not the Tutor column proper) |
| 10 | Pattern groups with role-labelled Nodes | DONE | test/pattern-groups.test.ts:60, :163 |
| 11 | Pattern group flagged when code violates it | DONE | test/pattern-groups.test.ts:79, :114; src/ui/features/46-patterns.js |
| 12 | Components layer computed from code | DONE | test/components-overview.test.ts, test/derived.test.ts:120 |
| 13 | Classes as Nodes with members | DONE | test/derived.test.ts:17; test/components-relations.test.ts |
| 14 | Each function as an Algorithm graph | DONE | test/algorithm.test.ts, test/flowchart-symbols.test.ts |
| 15 | Zoom from a class into its methods' graphs | DONE | test/focus.test.ts:147 (zoom to method/class); smoke report check 5 |
| 16 | Zoom from Algorithm graph into code text | DONE | test/derived.test.ts:30 (`/source`); src/ui/features/10-derived.js:34 |
| 17 | Zoom centers on the Node's Footprint | DONE | test/focus.test.ts:52 (framing computed by the core, src/core/routes/focus.ts) |
| 18 | Zoom out returns to the origin Node | DONE | test/focus.test.ts:74 |
| 19 | Several-place Footprint framed, rest dimmed | DONE | test/focus.test.ts:64 |
| 20 | Trace links from requirements/decisions to code | DONE | test/focus.test.ts:40; src/core/traces.ts |
| 21 | Dead Trace link marked Broken | DONE | test/focus.test.ts:90, :115 |
| 22 | Derived layers recompute on hand edits | PARTIAL | test/derived.test.ts:120 "editing a file by hand and reopening the Project changes the derived layers": recompute happens on reopen only. No file watcher, no refresh button found in src/ui or src/core/routes/projects.ts. Canvas can go stale until reopened |
| 23 | "Open in my editor" on the Code layer | PARTIAL | Works: src/core/routes/derived.ts:28 `/open-in-editor`, button src/ui/features/10-derived.js:18, tests test/derived.test.ts:85, :94, :102, test/robustness.test.ts:67. Gaps: the editor is chosen only by env var `AIDEA_EDITOR` (no setting in the UI), default is VS Code (`code` / Code.exe) and the call passes `--goto file:line`, which is VS Code syntax; other editors need a wrapper via `AIDEA_EDITOR_ARGS` |
| 24 | Playback from a real recorded execution | DONE | test/playback.test.ts:31 (records steps and values), :95 (replay never re-runs) |
| 25 | Pause, step, scrub | DONE | tickets notation/12 and polish/02; smoke report check 5 (step/play/pause/slider, token moves). No automated test (interface) |
| 26 | Sample inputs from tests or typed | PARTIAL | Typed works (form per parameter, src/ui/features/60-playback.js:201; test/playback.test.ts:190). Reading inputs from the Project's tests is not built; admitted in .scratch/aidea-v1/issues/09-playback.md:19 |
| 27 | Playback limited to effect-free functions or fakes | DONE | test/playback.test.ts:72 (refused, names call and line), :81 (fake lets it play), :86 (hidden effect stopped at run time), :121 (import alias), :127 (reads only inside Project), :138 (native code), :115/:157 (timeouts). Limit: src/core/playback.py:19 states it is a safety net by name, "NOT a sandbox"; code written to dodge it can; Python runs with the default interpreter, the Project's own venv only when asked (test :170) |
| 28 | Chat with the builder in a bottom bar | DONE | test/chat.test.ts:63; src/ui/features/30-chat.js |
| 29 | Builder is my own Claude Code | DONE | test/chat.test.ts:87, :110 (launched unmodified, no `--bare`, no `--strict-mcp-config`); src/core/adapter/claude.ts:93-103 |
| 30 | Sign in with own subscription, no API key | DONE | src/core/adapter/claude.ts:6 (no `--bare`), :45 (tells the person to run `/login`); test/chat.test.ts:130; fixture test/fixtures/streams/real-signed-out.jsonl |
| 31 | Never read or store credentials | DONE | rg for credential/keychain/oauth/apiKey/ANTHROPIC_API in src and electron finds only the comment at src/core/adapter/claude.ts:7. The spawn passes `process.env` through (claude.ts:17) but aidea reads no secret itself. No test asserts the absence directly; the property is by construction |
| 32 | See sub-agents the builder started | DONE | test/chat.test.ts:73 (nested under parent tool call); src/core/adapter/claude.ts:48; src/ui/features/30-chat.js:34-36 (`nested` lines). Shown as indented tool lines, no dedicated sub-agent list |
| 33 | Changes arrive as highlighted Proposals | DONE | test/proposals.test.ts:97; src/ui/features/70-proposals.js |
| 34 | Accept or reject each Proposal | DONE | test/proposals.test.ts:132, :234 |
| 35 | Builder cannot write authored layers except via tools | PARTIAL | Enforced only by deny rules for `Write`, `Edit`, `MultiEdit` on `.aidea/**` (src/core/routes/chat.ts:40; test/chat.test.ts:115). `Bash` (for example `echo > .aidea/x`), `NotebookEdit` and any other writer are not denied; in a mode that lets commands run, or with a permissive user rule, the builder can write the files directly. Hand-broken files are caught on load (story 37), so the Canvas does not break, but the "cannot" is not guaranteed. Also spec says "except through aidea's tools": the deny list is a convention, not a guard in the core |
| 36 | Hand-edit authored files | DONE | test/authored.test.ts:13; ADR 0005 (one file per Node) |
| 37 | Hand edits validated on load | DONE | test/authored.test.ts:50, test/focus.test.ts:132, test/problems.test.ts |
| 38 | Authored layers are text files in the repo | DONE | `.aidea/<layer>/*.json` (test/proposals.test.ts:317, :333); ADR 0005 |
| 39 | Permission request as a card with approve/reject | DONE | test/permission.test.ts:91, :101, :109; ticket live-findings/07 (card wraps) |
| 40 | Existing permission rules respected | DONE | Claude Code settles its own rules first and only unresolved requests reach `--permission-prompt-tool` (claude.ts:105-110); builder keeps the person's settings (test/chat.test.ts:102-110). Behaviour with the real Claude Code checked by hand in LOG item 10 |
| 41 | Short Probe at Project creation | CHANGED | The Probe is offered before the first class of each layer, at most five questions, always skippable (.scratch/tutor/spec.md story 9; src/core/probe.ts; src/ui/features/51-probe.js; test/probe.test.ts). Nothing runs at Project creation. Decided in the Tutor spec; the v1 tickets 13 and 10 are marked superseded |
| 42 | Tutor is a separate session | DONE | test/tutor-session.test.ts:105, :286 (class and builder chat side by side) |
| 43 | Tutor ignores my plugins and instructions | DONE | test/tutor-session.test.ts:334; test/learner-graph.test.ts:360; claude.ts:100 (`--setting-sources ""`, `--strict-mcp-config`, `--disable-slash-commands`, `--tools ""`, `--no-session-persistence`) |
| 44 | Builder stops at each Blocking decision (Class mode) | DONE | test/decision-classes.test.ts:110, :143 |
| 45 | Blocking limited to layers 1-3 Nodes, tech choices, Pattern groups | DONE | test/decision-classes.test.ts:128 (changed Node and Pattern group block; removal and Direct do not); src/core/decision-class.ts. A "technology choice" is an Architecture Node, so it is covered by the Node rule, not by a separate check |
| 46 | Predict or choose before the reveal | DONE | test/teach-loop.test.ts (predict, then explain, then check); src/core/teach.ts; src/core/tutor.ts:36-46 |
| 47 | Answers recorded as Propositions and Reasoning chains | DONE | test/learner-graph.test.ts:78, :183 (answers go to Evidence, Teacher prose to the graph) |
| 48 | Tutor skips what the Learner graph shows is understood | PARTIAL | Probe: enforced by the core, a question about an idea on the graph is refused (test/probe.test.ts:92; src/core/probe.ts:2, tool `known_ideas`). Plan: concepts on the graph show as "covered" (test/plan.test.ts:174) but only for display. Teacher classes: no tool or instruction gives the Teacher the graph, so a class can teach an idea the person already holds (rg for "learner"/"graph" in src/core/teach.ts, tutor.ts finds no read of it). Only the review question uses the graph (test/review-question.test.ts) |
| 49 | Switch Class and Direct mode | DONE | test/decision-classes.test.ts:81, :92 (per Project, remembered) |
| 50 | Select text, ask for a definition | DONE | test/select-text.test.ts:38 |
| 51 | Select text, enter the Tutor on it | DONE | test/select-text.test.ts:82 |
| 52 | Learner graph separate from any Project | DONE | test/learner-graph.test.ts:322 "stores... live outside the Project"; src/core/main.ts:8 (`~/.aidea/learner`) |
| 53 | Broken links and unimplemented requirements become questions | PARTIAL | Broken links: yes (src/core/drift.ts:27 `broken-trace`; test/drift.test.ts:101, :142 class started from a difference; src/ui/features/53-drift.js). Unimplemented requirements: only when marked `built: true` ("built-without-code"); a requirement with no code that is not marked built is deliberately NOT drift (drift.ts:3, test/drift.test.ts:101), so the plain "requirement nobody implemented" case gives no question |
| 54 | Clear message when Claude Code is missing or not signed in | DONE | test/chat.test.ts:122 (`not_installed`), :130 (`not_signed_in`, once), :137; claude.ts:45, :138-139; src/ui/features/50-tutor.js:181 handles both for the Tutor column; test/tutor-session.test.ts:298 |
| 55 | Point aidea at a different agent for the Tutor later | PARTIAL | The Agent adapter interface exists with roles (src/core/types.ts:73-78) and `startCore({adapter})` takes any adapter (src/core/server.ts:26), proven by the fake adapters in tests. But there is one adapter for all roles, no per-role selection, no setting or env var; src/core/main.ts always builds the Claude adapter. The spec says "selectable per role (builder, tutor)": the seam is there, the choice is not |

## Decisions in the spec: honoured or not

| Decision | Result |
|---|---|
| Core does the domain work, interface is thin, Footprint framing in the core | Honoured (src/core/routes/focus.ts; test/focus.test.ts:52) |
| "Everything is TypeScript" | Not literally: the interface is plain JavaScript (ADR 0003) and the Python analysis runs as `.py` scripts next to src/core (ADR 0002, 0004). Recorded decisions, not drift |
| Agent adapter, bare mode not used, credentials never touched | Honoured (claude.ts:6-7; test/chat.test.ts:110) |
| Permissions: aidea's prompt tool, user rules first | Honoured (claude.ts:105-110; test/permission.test.ts) |
| Canvas tool server for builder and Tutor | Honoured (src/core/routes/mcp.ts) |
| Authored store with schema validation on load | Honoured (authored.ts; ADR 0005 changed the layout to one file per Node, old single files still read) |
| Deriver needs nothing beyond the Project's Python | Honoured for Python (system `python`, no install). Now also TypeScript/JavaScript (ADR 0004; uses the `typescript` package as a runtime dependency) |
| Trace link engine: Footprint, Broken links, Pattern violations | Honoured |
| Playback in the Project's own Python environment | DONE (v1-gaps ticket 08): the Project's venv (.venv, venv, env) is the default; unticking the option or `useProjectPython: false` uses aidea's Python; a broken interpreter is reported in words (test/playback.test.ts) |
| Tutor: separate isolated session, Probe, predict-then-reveal, Practice deferred | Honoured, and extended (Tutor spec: Plan, Contract, drift) |
| Learner graph: per-user, append-only, extractor + auditor + deterministic merger | Honoured (test/learner-graph.test.ts) |
| Blocking decision definition | Honoured (decision-classes tests) |
| Interface layout and read-only Canvas | Honoured; the Projects list is a top-bar switcher and Home screen, not a left column (ui-redesign spec) |
| Product name has no Anthropic or Claude Code names | Honoured in package.json (`aidea`); the Electron window title was not checked |
| "To verify: how long Claude Code waits on a slow MCP tool call while a person answers" | Not verified: ticket 10 was superseded; LOG item 6 says real waits of 3, 10 and 30 minutes were not measured; the core sets `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` (claude.ts:18-19) |
| Out of Scope: other languages | Overridden by ADR 0004: TypeScript/JavaScript analysis, flow and run were added |
| Out of Scope: permission mode and model selector "later" | Built (ticket 17 done) |
| Out of Scope: multiple builders, Practice, embedded editor, embedded terminal, hand-made Nodes, other Tutor providers | Honoured: none found in src |
| "Interface has no automated tests" | Not exact: test/legend-check.test.ts drives a page; harmless |

## What stands between this and a first version

1. **Guard the authored layers for real (story 35).** Deny `Bash` writes into `.aidea/`, `NotebookEdit`, and other writers, or add a core-side check that refuses any change to `.aidea/` not made by an accepted Proposal. Ticket: "The builder cannot write .aidea files by any tool except Proposals".
2. **Verify the real Claude Code path end to end (spec "To verify").** Measure long waits (3, 10, 30 minutes) on a Tutor question, the decision-class hint, plain idea names and narration with the live model; none were covered live (LOG items 6 and 10). Ticket: "Measure how long Claude Code waits for a person's answer and record it in an ADR".
3. **Keep derived layers true after hand edits (story 22).** Recompute on file change or on window focus, or add a visible "Refresh" action, so the Canvas does not go stale. Ticket: "Derived layers refresh when files change on disk".
4. **Make the Tutor skip what the Learner graph shows (story 48).** Give the Teacher a read of the graph (or filter the Plan) and refuse a step about an idea already held, as the Probe does. Ticket: "Teacher classes skip ideas already on the Learner graph".
5. **Unimplemented requirements become questions (story 53).** Offer a requirement with no code and not marked built as a Tutor question, perhaps as a softer kind of difference. Ticket: "A requirement with no code yet can become a Tutor question".
6. **Sample inputs from the Project's tests (story 26).** Read call arguments from existing tests, or from a recorded call, to prefill the Playback form. Ticket: "Playback prefilled from the Project's tests".
7. **Choose the editor (story 23).** Add an editor setting in the interface and per-editor "go to line" arguments (VS Code, JetBrains, vim, Sublime). Ticket: "Choose which editor 'Open in my editor' uses".
8. **Choose the agent per role (story 55).** Read a per-role adapter choice at startup (env var or preference) and route builder and Tutor roles through it. Ticket: "Select the Agent adapter per role".
9. **Playback runs in the Project's environment by default (spec decision).** Detect a Project venv and use it unless told otherwise, or record the deviation in an ADR. Ticket: "Playback uses the Project's own Python by default".
10. **Housekeeping from the smoke report.** `open()` shadows `window.open` (src/ui/features/00-canvas.js), layer bar clipped at 1280 px, validation block overlaps the Requirements header. Ticket: "Fix three small interface bugs from the Electron smoke report".
11. **Record the changes of mind.** Add a short ADR or spec note that the Probe moved from Project creation to each layer (story 41) and that Out of Scope "other languages" was lifted (ADR 0004 covers the second; the first is only in the Tutor spec). Ticket: "Update the v1 spec with decisions made since".
