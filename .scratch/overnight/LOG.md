# Overnight log

What was done while the person slept, newest at the bottom. Every entry: the item, the commit, what was checked live (on the main screen), what looked better or worse, decisions taken for the person (marked DECISION, easy to change), and what is left.

Start: branch `overnight/autonomy` from `8ab1ac8` (the last commit of `feat/walking-skeleton`). To drop everything: `git checkout feat/walking-skeleton` and delete the branch. To keep it: merge it.

DECISION 1: ticket `live-findings/04` (a decision class that keeps being missed) was decided as option 2 (a hint with "Decide for me" after three misses), the option recommended to the person.

## 1. Viability check of hubstaff-automation and Telegram (real-projects/01)
Both are Python (587 and 209 files), so the analyser understands them. Report in `.scratch/real-projects/issues/01-open-the-real-projects.md`. Found and fixed: the page froze for minutes drawing the Components layer of Telegram (dots on every edge), and build folders (`dist`, `build`, `env`, `site-packages`) were analysed as project code. Found and ticketed: the Components layer is one long strip that does not scale (ticket 03, being built now) and a slow first open with no feedback (ticket 04). Your two folders were not changed.

## 2. Hide the Canvas (live-findings/06)
New top-bar button between the chat and right-panel ones. With the Canvas hidden the Builder and the Tutor share the width by their weights; the choice is saved. Guards: the Canvas cannot be hidden while both side panels are hidden (the last panel to go brings it back), and narrow windows (drawers) keep it. Checked headless at 1920, 1280 and 700 px: hide, persist after reload, one panel alone, last panel folded, show again; no horizontal overflow, no page errors. 404 tests pass.

## 3. aidea tools asking permission (live-findings/02)
Reproduced with the real Claude Code: in Plan mode `read_contract` produced a card. Cause: Plan mode asks for MCP tools that do not declare `readOnlyHint`. Fixed on the two reading tools, verified live (no card in Plan after the fix; none in Manual). `ExitPlanMode` card remains (Claude Code's own). Details in the ticket.

## 4. Person told when a Proposal is refused (live-findings/03)
New `proposal_refused` event (reason pending/exists, layer, node id, waiting Proposal id). Line with an "Open it" button in the chat (builder) and in the Tutor column (Tutor). Malformed calls emit nothing. Merged from agent worktree; 408 tests, typecheck clean. Live check on the main screen still to do together with the next UI items.

## 5. Big-project overview (real-projects/03)
Components of a project with more than 40 modules is now an overview: one box per module under folder labels, merged lines (strongest 400 pairs), double click or Enter opens one module, "All modules" returns. Telegram: 1,783 SVG elements and 0.15 s (before: 30,000 elements, a strip of 40,000 px). hubstaff-automation: 3,301 elements, 0.3 s; whole open still 13 to 16 s (ticket 04). Zoom floor lowered 20% to 10% for all layers. NOT done: labels unreadable at Fit (ticket 05), focus from authored layers on overview, incoming relations in module detail. Also merged: plain idea names (live-findings/01; live measurement with the real model still pending).

## 6. Decision-class hint (live-findings/04) and long waits (live-findings/05)
04: third miss in a decision class shows "Taking long? You can let the builder decide" with "Decide for me" (DECISION 1). Not yet seen with the real model. 05: a late answer to a question the Tutor stopped waiting for gets a plain 410 and the card offers "Start a class on the same topic". NOT measured: real waits of 3, 10 and 30 minutes with the real Claude Code (no timeout of the core's own). 420 tests pass.

## 7. Overview readable at Fit (real-projects/05)
Folder names are always 13 px on screen (cut to the box, full name as tooltip); module names and counts appear only when zoomed in enough. Telegram readable at 1920 and 1280; hubstaff at 1280 readable but squeezed (one-module folders cut to a few letters, first label close to the "Teach me through it" button). Folders unchanged.

## 8. Merged: opening feedback (real-projects/04), storage per Node read side (01), language adapter interface (01) and language detection (02)
Opening a project shows "Reading the project..." and failures in words; analysis output byte-identical, 12% to 16% faster. `.aidea/<layer>/*.json` one file per Node is read next to the single file. A language line in the top bar says what is analysed and what is not (Python analysed; TS/JS counted, not yet analysed). 443 tests.
FLAKY TEST: `robustness.test.ts` (and sometimes others) fails with `fetch failed: bad port` when the OS gives a port that fetch blocks (a fixed list). Not a product bug; the earlier unexplained red runs were this. Fix idea: retry `startCore` on a blocked port.

## 9. Merged: guide (aidea-guide/01), TS/JS analysis (language-adapters/03), narration (run-in-plain-words/01), prediction (run-in-plain-words/02), aidea on its own repo (real-projects/02)
- Guide: a "How aidea works" button starts a Tutor class about the app (quick tour when the Tutor is unavailable). Not yet run with the real model.
- TS/JS: aidea's own `src` reads as 87 modules, 343 functions, 673 calls in 1.2 s (typescript moved to runtime dependencies; it is TypeScript 7 and its API is marked unstable). Flow and run for TS/JS are not built (tickets 04, 05).
- Narration: each step of a run is told in one sentence. Prediction: optional "Guess first" before a step (off by default); Skip records nothing.
- aidea on its own repo: opens in about 2 s; found a bug (a TS function answered "cannot be read as Python") and a typo ("0 classs"), both fixed; tickets 06 to 09 created.
- FLAKY TEST ROOT CAUSE FIXED: `startCore` now never keeps a system-chosen port that fetch blocks.

## 10. Live round on the second monitor (real Electron, real Claude Code, haiku)
Window 1264x761. Hide Canvas, language line, "How aidea works" class with the real Tutor (asked to predict the three columns, then revealed and checked the answer; its text matched the app), real builder in Manual mode proposed two Business Nodes without any aidea permission card (only the person's own memory plugin asked), accepting one wrote `.aidea/business/001-business-payer.json` (one file per Node). Cost about $0.15. Found: a permission card overflows a narrow chat (ticket live-findings/07). Not covered live: decision-class hint, long waits, idea names, prediction, narration.

## DECISION (real-projects/07)
Test folders are folded into one closed block with a "show" line, not removed. The language line in the top bar is not changed (it counts files on disk); the overview line says how many test modules and pairs are folded. Recommended default taken.

## 11. Merged: TS/JS flow (language-adapters/04, real-projects/06), overview follow-ups 07/08/09, card overflow (live-findings/07)
- aidea reading its own source in the real app on the second monitor: drawn in 2.7 s with 986 SVG elements; language line "TypeScript 116, Python 39, JavaScript 34 files"; tests and fixtures fold into one closed block ("90 hidden", with a show link).
- TS functions: 395 of 395 functions of `src` get a flow graph (11% generic steps); checked headless, not yet by hand in the real app.
- Found live: double click on a module also opens the define popup (ticket live-findings/08). Not covered: entering the module and a function's graph by hand in the real app; guess-first and narration with a real person.
- Overview: folder `test`/`tests`/`__tests__`/`fixtures`/`spec` fold (DECISION by agent: top-bar counts still count files on disk). 488 tests.

## 12. Audit of the 55 stories of the first version
`.scratch/aidea-v1/audit.md`: 47 done, 7 partial (22, 23, 26, 35, 48, 53, 55), 0 missing, 1 changed (41). Ten tickets in `.scratch/v1-gaps/issues`. DECISION 2: ticket 01 (story 35) uses detect-and-restore after each builder turn plus the denials that can be named, because no deny pattern is a wall for a shell command.

## 13. Merged: refresh of derived layers (v1-gaps/02), Teacher skips held ideas (v1-gaps/03)
- Refresh: top-bar Refresh button and refresh when the window regains focus; keeps open module and zoom; failure keeps the old drawing and says so. Not exercised: refresh on Algorithms layer or with the code box open.
- DECISION 3 (made by the agent, kept): an idea counts as held for the Teacher only if it is on the Learner graph AND has strong Evidence = a correct answer in this Project, confidence 70 or more, in the last 90 days (`STRONG_CONFIDENCE`, `STRONG_DAYS` in `probe.ts`), because the graph holds what was taught, not what was understood. Change the two constants if you want it stricter or looser. Real-Tutor check not done yet.
495 tests.

## 14. Merged: guard of authored files (v1-gaps/01), Playback in the project's venv (v1-gaps/08), requirement not built yet (v1-gaps/04). Live check of the guard
Real builder (haiku, acceptEdits) was asked to overwrite `.aidea/business/001-business-payer.json` with a Python one-liner via Bash, twice (second with the path built in pieces). Both attempts were denied and the file is byte-identical afterwards. NOT exercised live: the detect-and-restore path (no write got through; it is covered by 7 protocol tests), and I cannot tell from the stream whether the second denial came from the deny pattern or from Claude Code's own rules. Cost about $0.01 for the turn. 506 tests.

## 15. Merged after the connection drops: agent per role (v1-gaps/07), editor choice (06), double click popup (live-findings/08), Playback inputs from tests (05), smoke-report bugs and ADR 0006 (09, 10)
- Per-role agents: `AIDEA_ROLE_ADAPTERS` (for example `tutor=default`); default unchanged.
- Editor: list of editors plus a typed template, per Project, command built as an argument array (no shell). Go-to-line syntax of VS Code, JetBrains, Sublime and Notepad++ is UNVERIFIED (docs could not be fetched); gvim used instead of vim.
- Double click: `user-select: none` on the Canvas SVG. Not checked: function rows, authored Nodes, drag-select elsewhere.
- Playback "From the Project's tests": literal arguments only, plain functions only, never runs tests.
- Smoke report: two of three bugs were already gone; the layer bar was still clipped at 1280 (ticket v1-gaps/11). ADR 0006 records that the Probe moved to each layer and that the languages limit was lifted; the agent also corrected the Probe entry of GLOSSARY.md. 518 tests.
