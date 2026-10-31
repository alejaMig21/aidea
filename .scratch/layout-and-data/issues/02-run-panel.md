# 02: Run is a Panel of its own, with the new vocabulary

**What to build:** The test-data form and the Playback of the open function live in a panel called Run, no longer a tab that shares a slot with the Tutor. Tutor and Run can be visible at the same time, and each can be shown or hidden. The glossary replaces Column, Algorithm column and Tutor column with Panel, Layout, Preset and Run, and the interface says Panel where it said column.

**Blocked by:** None (can start immediately).

**Status:** resolved (commits dd8f525 and the review fixes after it)

Review (fresh context, Standards and Spec reported separately) found: the guide still said "Tutor tab" (fixed, with a test), stale "column" and "Algorithms tab" in comments (fixed), no row in `ui-style.md` for a Panel title (added). Kept on purpose: the "Function" header inside Run (it shows the function's name; renaming it is cheap later) and `rightShowPanel("run")` re-opening Run when a Flow is opened. Not done: the 50/50 split when both panels are open squeezes the Tutor at short heights (measured 330 px each at 1280x720, 510 px each at 1920x1080); ticket 08 replaces this stacking with free docking. The hardcoded `#202531` in Run's divider was already there.

## Measurements of the corrected version (real Electron window, main monitor, widths by viewport)

At 1266x763: with no function open the cards are Builder 268 px, Canvas 582, Tutor 385 and Run hidden with its button disabled; with a Flow open Run is a card of 288 px between the Canvas (398) and the Tutor (280), nothing is nested; folding Run gives the room back to the Canvas, folding the Tutor makes Run 320 px; at 1920x1080 the cards are 329, 709, 372 and 470 px; at 1280x720 260, 412, 288 and 280 px; neither overflows sideways; at 700 px Run opens as a drawer; no page errors (`s-1266.png`, `s-1920.png`, `s-1280.png`, `s-narrow.png`, `s-tutor-folded.png`). What the screenshots show: with four cards at 1266 px the Canvas is 398 px and the layer bar is cut (the "Components" tab is clipped), which makes the clipped-bar problem worse while Run is open; ticket 11 owns it. Not measured: a second monitor; dragging the new separator by hand (arrow keys and the drag code share the one path of the other two, but only the layout maths was exercised).

Measured earlier, before the correction: at 1920x1080 and 1280x720 the Tutor and Run panels are both shown (510 and 330 px each), the right slot is 590 and 389 px wide, and nothing overflows sideways (`r-1920.png`, `r-1280.png`). Those two widths were measured by resizing the viewport, like the 700 px one.

## Correction (2026-10-31)

The first version (commits dd8f525, 6ec5b37) stacked Run and the Tutor as two foldable sections inside one card. That was wrong: the person had asked for completely separate sections. The correction makes Run its own card between the Canvas and the Tutor, with its own top-bar button (disabled until a function's Flow is open) and its own separator; the Tutor is again alone in its card, with a title like the Builder's. The layout code now handles three side panes (Builder, Run, Tutor). `test/panels-vocabulary.test.ts` fails if Run is put inside the Tutor's card or the other way round. The stacking notes below describe the first version and no longer apply; the measurements of the corrected version are at the end.

## Verification notes of the first version (2026-10-31)

Live, in the real Electron shell with a visible window on the main monitor (isolated recents, preferences and Learner files, 1266x763), with a real double-click on a function. Measured: before a function is open only the Tutor panel is shown (703 px tall); with a Flow open the Tutor and Run panels are both shown, 351 px each, each scrolling on its own; folding Run gives the Tutor the room (661 px) and keeps Run's title (42 px); folding the Tutor does the same the other way; at 700 px wide the right slot opens as a drawer holding both panels; no page errors (`r-both.png`, `r-tutor-folded.png`, `r-narrow.png` in the session scratchpad). The 700 px check resized the viewport, because the shell does not answer window-size calls over CDP, not the window. Not measured: the 1920 px width, a second monitor. Fold state of a panel is not saved (decided to keep the slice small; ticket 09 stores Layouts). The old tab bar is gone: the Tutor and Run no longer switch, they stack.

- [ ] Run and Tutor are two separate panels; opening one does not hide the other.
- [ ] Run is enabled only while a function is open, as the Algorithm column was.
- [ ] Narrow windows still open the panels as drawers over the Canvas.
- [ ] A test fails when the retired words (Algorithm column, Tutor column, "column" as the name of a window area) appear in user-facing text.
- [ ] The glossary defines Panel, Layout, Preset and Run, and retires Column, Algorithm column and Tutor column.
- [ ] Sizes and colours stay on the shared scale; verified live at 1920, 1280 and narrow.
