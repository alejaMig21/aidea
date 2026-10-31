# 02: Run is a Panel of its own, with the new vocabulary

**What to build:** The test-data form and the Playback of the open function live in a panel called Run, no longer a tab that shares a slot with the Tutor. Tutor and Run can be visible at the same time, and each can be shown or hidden. The glossary replaces Column, Algorithm column and Tutor column with Panel, Layout, Preset and Run, and the interface says Panel where it said column.

**Blocked by:** None (can start immediately).

**Status:** implemented (commit dd8f525); review pending

## Verification notes (2026-10-31)

Live, in the real Electron shell with a visible window on the main monitor (isolated recents, preferences and Learner files, 1266x763), with a real double-click on a function. Measured: before a function is open only the Tutor panel is shown (703 px tall); with a Flow open the Tutor and Run panels are both shown, 351 px each, each scrolling on its own; folding Run gives the Tutor the room (661 px) and keeps Run's title (42 px); folding the Tutor does the same the other way; at 700 px wide the right slot opens as a drawer holding both panels; no page errors (`r-both.png`, `r-tutor-folded.png`, `r-narrow.png` in the session scratchpad). The 700 px check resized the viewport, because the shell does not answer window-size calls over CDP, not the window. Not measured: the 1920 px width, a second monitor. Fold state of a panel is not saved (decided to keep the slice small; ticket 09 stores Layouts). The old tab bar is gone: the Tutor and Run no longer switch, they stack.

- [ ] Run and Tutor are two separate panels; opening one does not hide the other.
- [ ] Run is enabled only while a function is open, as the Algorithm column was.
- [ ] Narrow windows still open the panels as drawers over the Canvas.
- [ ] A test fails when the retired words (Algorithm column, Tutor column, "column" as the name of a window area) appear in user-facing text.
- [ ] The glossary defines Panel, Layout, Preset and Run, and retires Column, Algorithm column and Tutor column.
- [ ] Sizes and colours stay on the shared scale; verified live at 1920, 1280 and narrow.
