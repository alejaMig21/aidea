# 02: Run is a Panel of its own, with the new vocabulary

**What to build:** The test-data form and the Playback of the open function live in a panel called Run, no longer a tab that shares a slot with the Tutor. Tutor and Run can be visible at the same time, and each can be shown or hidden. The glossary replaces Column, Algorithm column and Tutor column with Panel, Layout, Preset and Run, and the interface says Panel where it said column.

**Blocked by:** None (can start immediately).

**Status:** resolved (commits dd8f525, 6ec5b37, f4011cc and the review fixes after it)

- [x] Run and Tutor are two separate panels; opening one does not hide the other. (Each is its own card with its own top-bar button and separator; a test keeps them apart.)
- [x] Run is enabled only while a function is open, as the Algorithm column was.
- [x] Narrow windows still open the panels as drawers over the Canvas. (Measured for Run, and a Run drawer closes when the Flow is left; the Builder and Tutor drawers were not re-measured after the change, their code path is the old one.)
- [x] A test fails when the retired words (Algorithm column, Tutor column, "column" or "right panel/slot" as the name of a window area, tabs of the Tutor) appear in user-facing text.
- [x] The glossary defines Panel, Layout, Preset and Run, and retires Column, Algorithm column and Tutor column.
- [~] Sizes and colours stay on the shared scale; verified live at 1920, 1280 and narrow. (Done in the real Electron window on the main monitor, but the three widths were set by resizing the viewport, not the window. The 1266 px width shows the layer bar cut while Run is open; that is ticket 11's problem and it gets worse here.)

## What happened

The first version (6ec5b37 and before) stacked Run and the Tutor as two foldable sections inside one card. The person corrected it: they had asked for completely separate sections. f4011cc made Run its own card between the Canvas and the Tutor, and generalised the layout code from two side panes to three (Builder, Run, Tutor). `test/panels-vocabulary.test.ts` fails if the cards are not in the order Builder, Canvas, Run, Tutor, or if one body is inside another's card.

## Review (fresh context, Standards and Spec reported separately), fixed

The guide still said "Tutor tab" and "right panel" (fixed, with tests); a Run drawer stayed open on an empty Run when the Flow was left (fixed); with the Canvas and the Builder hidden the first card touched the window edge (fixed with a margin rule); stale comments, the style guide's "right slot", `aria-label`s that said "Chat" for the Builder, and the glossary entry for Run (fixed); the shape test no longer depends on line endings. Decided: Run appears whenever a Flow is open unless the person hid it, and that choice stays (the first version re-opened it every time, against its own comment). The fold of Run is saved with the rest of the layout (the Builder's and the Tutor's already were).

## Measurements (real Electron window, visible, main monitor, widths by viewport)

At 1266x763: no function open, the cards are Builder 268 px, Canvas 582, Tutor 385, Run hidden with its button disabled; with a Flow open, Builder 260, Canvas 398, Run 288, Tutor 280, nothing nested; folding Run returns its room to the Canvas; folding the Tutor makes Run 320 px; a Run folded by the person stays folded when the Flow is opened again. At 1920x1080 the cards are 329, 709, 372 and 470 px; at 1280x720, 260, 412, 288 and 280 px; neither overflows sideways. With the Canvas and the Builder hidden, Run starts at 8 px. At 700 px Run opens as a drawer and closes when the Flow is left. No page errors. Screenshots in the session scratchpad: `s-1266.png`, `s-1920.png`, `s-1280.png`, `s-narrow.png`, `s-tutor-folded.png`, `t-canvas-hidden.png`.

Dragging the separators by hand at 1920 px (a real mouse drag): each separator moves its pane in the right direction and stays within its limits, but it does not stay under the pointer and it also resizes the panes that are not its neighbours. Dragging the Run separator 80 px left grew Run by 116 px and shrank the Builder by 26 and the Tutor by 36; dragging the Tutor separator 60 px right shrank the Tutor by 56 and gave 25, 18 and 12 px to the Canvas, Run and Builder. The cause is that sizes are weights (`fr`) shared by all panes. It was already true with two side panes and is more visible with three. Ticket 08 (the docking engine) replaces this model; until then it is a known limit. At 1266 px a drag has almost no room (the Canvas minimum binds): 80 px moved Run 10 px.

Not measured: a second monitor; the Builder and Tutor drawers after the change; an automatic fold of Run at widths where four cards do not fit (traced by hand in the review, not seen).
