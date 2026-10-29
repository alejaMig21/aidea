# Overnight log

What was done while the person slept, newest at the bottom. Every entry: the item, the commit, what was checked live (on the main screen), what looked better or worse, decisions taken for the person (marked DECISION, easy to change), and what is left.

Start: branch `overnight/autonomy` from `8ab1ac8` (the last commit of `feat/walking-skeleton`). To drop everything: `git checkout feat/walking-skeleton` and delete the branch. To keep it: merge it.

DECISION 1: ticket `live-findings/04` (a decision class that keeps being missed) was decided as option 2 (a hint with "Decide for me" after three misses), the option recommended to the person.

## 1. Viability check of hubstaff-automation and Telegram (real-projects/01)
Both are Python (587 and 209 files), so the analyser understands them. Report in `.scratch/real-projects/issues/01-open-the-real-projects.md`. Found and fixed: the page froze for minutes drawing the Components layer of Telegram (dots on every edge), and build folders (`dist`, `build`, `env`, `site-packages`) were analysed as project code. Found and ticketed: the Components layer is one long strip that does not scale (ticket 03, being built now) and a slow first open with no feedback (ticket 04). Your two folders were not changed.

## 2. Hide the Canvas (live-findings/06)
New top-bar button between the chat and right-panel ones. With the Canvas hidden the Builder and the Tutor share the width by their weights; the choice is saved. Guards: the Canvas cannot be hidden while both side panels are hidden (the last panel to go brings it back), and narrow windows (drawers) keep it. Checked headless at 1920, 1280 and 700 px: hide, persist after reload, one panel alone, last panel folded, show again; no horizontal overflow, no page errors. 404 tests pass.
