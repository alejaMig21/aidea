# 02: Run is a Panel of its own, with the new vocabulary

**What to build:** The test-data form and the Playback of the open function live in a panel called Run, no longer a tab that shares a slot with the Tutor. Tutor and Run can be visible at the same time, and each can be shown or hidden. The glossary replaces Column, Algorithm column and Tutor column with Panel, Layout, Preset and Run, and the interface says Panel where it said column.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Run and Tutor are two separate panels; opening one does not hide the other.
- [ ] Run is enabled only while a function is open, as the Algorithm column was.
- [ ] Narrow windows still open the panels as drawers over the Canvas.
- [ ] A test fails when the retired words (Algorithm column, Tutor column, "column" as the name of a window area) appear in user-facing text.
- [ ] The glossary defines Panel, Layout, Preset and Run, and retires Column, Algorithm column and Tutor column.
- [ ] Sizes and colours stay on the shared scale; verified live at 1920, 1280 and narrow.
