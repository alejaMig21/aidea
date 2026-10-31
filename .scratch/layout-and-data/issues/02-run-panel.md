# 02: Run is a Panel of its own, with the new vocabulary

**What to build:** The test-data form and the Playback of the open function live in a panel called Run, no longer a tab that shares a slot with the Tutor. Tutor and Run can be visible at the same time, and each can be shown or hidden. The glossary replaces Column, Algorithm column and Tutor column with Panel, Layout, Preset and Run, and the interface says Panel where it said column.

**Blocked by:** None (can start immediately).

**Status:** resolved (commits dd8f525 and the review fixes after it)

Review (fresh context, Standards and Spec reported separately) found: the guide still said "Tutor tab" (fixed, with a test), stale "column" and "Algorithms tab" in comments (fixed), no row in `ui-style.md` for a Panel title (added). Kept on purpose: the "Function" header inside Run (it shows the function's name; renaming it is cheap later) and `rightShowPanel("run")` re-opening Run when a Flow is opened. Not done: the 50/50 split when both panels are open squeezes the Tutor at short heights (measured 330 px each at 1280x720, 510 px each at 1920x1080); ticket 08 replaces this stacking with free docking. The hardcoded `#202531` in Run's divider was already there.

Measured later in the same window: at 1920x1080 and 1280x720 the Tutor and Run panels are both shown (510 and 330 px each), the right slot is 590 and 389 px wide, and nothing overflows sideways (`r-1920.png`, `r-1280.png`). Those two widths were measured by resizing the viewport, like the 700 px one.

## Verification notes (2026-10-31)

Live, in the real Electron shell with a visible window on the main monitor (isolated recents, preferences and Learner files, 1266x763), with a real double-click on a function. Measured: before a function is open only the Tutor panel is shown (703 px tall); with a Flow open the Tutor and Run panels are both shown, 351 px each, each scrolling on its own; folding Run gives the Tutor the room (661 px) and keeps Run's title (42 px); folding the Tutor does the same the other way; at 700 px wide the right slot opens as a drawer holding both panels; no page errors (`r-both.png`, `r-tutor-folded.png`, `r-narrow.png` in the session scratchpad). The 700 px check resized the viewport, because the shell does not answer window-size calls over CDP, not the window. Not measured: the 1920 px width, a second monitor. Fold state of a panel is not saved (decided to keep the slice small; ticket 09 stores Layouts). The old tab bar is gone: the Tutor and Run no longer switch, they stack.

- [ ] Run and Tutor are two separate panels; opening one does not hide the other.
- [ ] Run is enabled only while a function is open, as the Algorithm column was.
- [ ] Narrow windows still open the panels as drawers over the Canvas.
- [ ] A test fails when the retired words (Algorithm column, Tutor column, "column" as the name of a window area) appear in user-facing text.
- [ ] The glossary defines Panel, Layout, Preset and Run, and retires Column, Algorithm column and Tutor column.
- [ ] Sizes and colours stay on the shared scale; verified live at 1920, 1280 and narrow.
