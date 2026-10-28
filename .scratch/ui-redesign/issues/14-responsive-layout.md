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

- [ ] Headless measurements (no visible window) over widths 360, 520, 700, 900, 1100, 1440, 1920 and the four fold states show: no empty reserved space (visible columns fill the window), Canvas at least 360 px (320 only below the narrow breakpoint, where drawers apply), no horizontal overflow, the top bar and the chat input card fully inside the viewport. Results in the review notes.
- [ ] Screenshots at 520, 900 and 1440 px (read by the implementer next to the mockups) look right in both fold states.
- [ ] Auto-fold and restore work when the window shrinks and grows again; a manual fold survives.
- [ ] Drawers open and close (button, Escape, outside click) below the narrow breakpoint.
- [ ] Persistence of sizes and folded state still works; dragging separators and keyboard resizing still work.
- [ ] The desktop window has a minimum size.
- [ ] Verified by the person in the real window on the second monitor.
