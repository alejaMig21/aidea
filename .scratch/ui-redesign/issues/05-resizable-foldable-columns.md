# 05: Resizable, foldable columns and the Tutor column

**What to build:** The work session is chat on the left, Canvas in the centre, right slot on the right. Chat and right slot can be resized by dragging their edge and folded away (also from buttons in the top bar). Sizes and folded state are remembered between sessions. The Canvas takes the remaining width and keeps a minimum usable width that the other areas cannot take. The right slot has a Tutor tab, always present, whose empty state says plainly that the Tutor is not available yet and what it will do, with its entry point disabled.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Dragging the chat edge resizes it; a button folds and unfolds it.
- [ ] Same for the right slot.
- [ ] However the areas are resized, the Canvas never goes below its minimum width.
- [ ] Sizes and folded state are still there after closing and reopening aidea.
- [ ] The Tutor tab is always present and explains the Tutor is not available yet.
- [ ] Checked live on narrow and wide windows; result noted in the ticket.

## Review notes

- No core change, so no automated test seam. `npm run typecheck` and `npm test` pass (112 passed, 1 skipped, 0 failed); `node --check` passes on the new file. Nothing was run in a real window, so NO live criterion is ticked.
- Added: `src/ui/features/07-layout.js` (resize by pointer drag and arrow keys on `role="separator"` handles, fold buttons, persistence in `localStorage` key `aidea.layout` inside try/catch, right-slot tab registry `rightRegisterTab(id, label, pane)`, the always-present Tutor tab with a disabled input and button). `src/ui/index.html`: grid is now side | chat | separator | Canvas | separator | right slot; chat moved from the bottom footer to a left column; two fold buttons in the top bar; right slot markup.
- Canvas minimum: the Canvas track is `minmax(var(--canvas-min), 1fr)` (320px) and the other tracks are `minmax(0, wanted)`, so CSS shrinks side panes first; drag values are also clamped in JS.
- The existing `#panel` (Proposals, Algorithm test data, Playback) stays where it was, now inside the right slot below the tab panes and always visible. Ticket 08 should turn it into the Algorithm tab.
- To check live: dragging each edge resizes; arrow keys on a focused edge resize (Right grows the chat, Left grows the right slot); each top-bar button folds and unfolds; sizes and folded state survive a restart; on a narrow window the Canvas stays at least 320px and the side panes shrink; the Tutor tab says the Tutor is not available and its input and button are disabled; chat, permission cards, Proposals and the Algorithm panel still work in the new layout (the chat log now fills the column instead of a 40vh strip).
- Known gaps: the project list column (`#side`) is neither resizable nor foldable; it only shrinks (up to 200px) when space is short.
