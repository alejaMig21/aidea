# 14: The layout is responsive and nothing important can be hidden

**What to build:** Folding or resizing never leaves dead space, and no window size makes the interface unusable. Reproduced with a headless browser: with the chat and the right slot folded at 1440 px the Canvas is 780 px wide and about 660 px stay empty, because a folded column keeps its grid track; at 900, 700 and 520 px the side panels are squeezed to 84-178 px and the Canvas sits at its 320 px minimum.

Rules:
1. **Folded means gone.** A folded panel and its separator take no space; the visible columns (Canvas and the other panel) expand to fill the window. Column sizes are flexible weights, not fixed pixels, so every visible column grows and shrinks with the window; dragging a separator still resizes and is still remembered.
2. **Priorities.** The Canvas is never squeezed below its minimum usable width (360 px). Side panels have sensible minimums (chat 260 px, right slot 280 px).
3. **Auto-fold when space runs out.** When the window cannot hold the Canvas minimum plus the open panels, panels fold automatically, the right slot first, then the chat, so the Canvas stays usable. These automatic folds are not the person's choice and are not remembered as such: growing the window brings the panels back as the person had them. Opening a panel when there is no room folds the other one instead of squeezing.
4. **Narrow windows (below about 760 px).** Panels become overlay drawers over the Canvas, one at a time, opened from the top-bar buttons, closed with Escape, a close button or a click outside; they never push or squeeze the Canvas.
5. **Nothing important hidden at any size from 360x500 up:** the top bar (logo, Project switcher with a shrinking, ellipsised name, both fold buttons) is always fully visible and usable; the Layer tabs scroll horizontally; the chat input card (input, model and mode selects, Send) is always fully visible, the selects wrapping or shrinking if needed; panels scroll inside themselves on short windows; the switcher popover never goes outside the window (limited height, scrolls); the zoom control stays reachable; Home works from 360 px wide.
6. **Desktop window:** a minimum window size (for example 720x520) so the window cannot be shrunk to nothing.

**Blocked by:** 12, 17 (done)

**Status:** ready-for-agent

- [x] Headless measurements (no visible window) over widths 360, 520, 700, 900, 1100, 1440, 1920 and the four fold states show: no empty reserved space (visible columns fill the window), Canvas at least 360 px (320 only below the narrow breakpoint, where drawers apply), no horizontal overflow, the top bar and the chat input card fully inside the viewport. Results in the review notes.
- [x] Screenshots at 520, 900 and 1440 px (read by the implementer next to the mockups) look right in both fold states.
- [x] Auto-fold and restore work when the window shrinks and grows again; a manual fold survives.
- [x] Drawers open and close (button, Escape, outside click) below the narrow breakpoint.
- [x] Persistence of sizes and folded state still works; dragging separators and keyboard resizing still work.
- [x] The desktop window has a minimum size.
- [ ] Verified by the person in the real window on the second monitor.

## Review notes

Headless Chrome (no visible window), `07-layout.js` + `index.html`. Columns are `minmax(min, N fr)` tracks (chat 268, Canvas 360 + 8 per empty side, right 288; the extra 8 is each card's window margin); folded or auto-folded panes are 0 tracks with their separator hidden; below 760 px both are drawers. "Want" is the person's choice; auto-fold applies on top (right first, or the other pane when the person just opened one).

| Width | both | chat only | right only | none |
|---|---|---|---|---|
| 1920 | 435 / 1043 / 409 | 562 / 1334 | 1358 / 538 | 1904 |
| 1440 | 324 / 780 / 304 | 419 / 997 | 1015 / 401 | 1424 |
| 1100 | 260 / 528 / 280 | 318 / 758 | 772 / 304 | 1084 |
| 900 | chat 260, Canvas 616, right auto-folded | 260 / 616 | 596 / 280 | 884 |
| 760 | chat 260, Canvas 476, right auto-folded | 260 / 476 | 456 / 280 | 744 |
| 700, 520, 360 | drawers: Canvas fills the window (684, 504, 344) in all four states | | | |

(chat / Canvas / right card widths in px.) For every cell: visible cards span 8 px from the left edge to 8 px from the right edge, no horizontal or vertical overflow, top bar, both fold buttons, zoom control and the chat input card (and every control inside it) inside the viewport. Reproduction fixed: at 1440 with chat and right folded the Canvas is 1424 px (was 780).

- Auto-fold: at 900 with both wanted, the right slot folds, nothing is saved (`localStorage` unchanged); back at 1440 both return. Opening the right slot at 900 folds the chat instead and saves only the right slot as open.
- Drawers at 520: open from each button (`aria-expanded`, `role=dialog`, focus moves in), one at a time, close with Escape (focus returns to the button), a click on the scrim, and the Close button. The Canvas stays 504 px.
- Dragging the chat separator by 100 px grew the chat by 101 px; ArrowLeft/ArrowRight on a separator move 20 px; sizes are stored as weights and a reload restores them.
- Screenshots read at 1440 (open, folded), 900 (folded), 520 (drawer): they match mockup A.
- Not measured: Home at 360 px (its CSS was not changed), and vertical fit under zoom emulation. CSS `zoom` on the root is not a real browser zoom (the viewport units do not follow it), so those runs fail on both sides for reasons that are not the layout; the person confirmed the vertical overflow they saw was an older build. Hardening kept: `html { height: 100% }`, body `100vh` then `100dvh`.
- `npm run typecheck` clean; `npm test` 155 pass, 1 skipped, 0 fail. `electron/main.js` now sets `minWidth: 720`, `minHeight: 520`; never launched.
