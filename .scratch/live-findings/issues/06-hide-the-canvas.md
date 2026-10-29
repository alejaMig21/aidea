# 06: The person can hide the Canvas

**What to build:** The chat (left) and the right slot can already be folded from the top bar, and the layout remembers it. The Canvas in the middle cannot, so a person who wants to talk to the builder or the Tutor with more room has to shrink the other panes by hand. Add the same fold for the Canvas: a button in the top bar next to the other two, the remaining panes share its room, and the choice is remembered like theirs. At least one pane must always stay on screen: hiding the Canvas while both side panes are folded is not possible (the button is disabled, with a title that says why), and folding a side pane while the Canvas is hidden unfolds the Canvas instead of leaving an empty window. In narrow windows, where the side panes are drawers, the Canvas is the base and is not hidden.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Hiding the Canvas gives its room to the visible side panes, in proportion to their sizes; showing it again restores the previous sizes.
- [ ] The choice survives a reload and is saved with the other layout choices; a saved state with every pane folded is repaired to show the Canvas.
- [ ] The last visible pane cannot be folded: its button is disabled with a plain title (or the Canvas comes back, as written above).
- [ ] Keyboard and screen reader: the new button is a toggle with `aria-pressed`, a label, and the separator keys of the remaining panes still work.
- [ ] Animations and the Canvas's own state (zoom, selected layer, open legend) are not lost by hiding and showing it again.
- [ ] Verified with a headless browser: screenshots with the Canvas hidden, with chat and right visible, with only one visible, and after a reload; the narrow-window case; no console errors.
