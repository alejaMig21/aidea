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
