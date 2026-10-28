# 11: Notation polish found when reviewing the prototypes

**What to build:** Four visual defects the person agreed with, checked and fixed in the real implementation (not the prototype). Each is measured first at 1000x700 and 1440x900 with a headless browser; if it no longer occurs, say so in the review notes and add nothing.

1. **Business at 1000 px.** Note text wraps badly and nothing may cross the edge of a block or note. (The decorative flows are removed by ticket 10, so only the text and note sizing are in scope here: a long title wraps to at most two lines then ends with an ellipsis, and the full text stays in the tooltip.)
2. **Flowchart loop exit.** The exit of a loop that leaves the loop (the "done" or "No" exit) takes a long detour to the step after the loop. Shorten it: the exit should leave the decision on the side that faces the next step and meet it with the fewest elbows the layout engine can manage, without crossing nodes. Same for the way back arrow, which should hug the loop body.
3. **Components labels.** A relationship label or a member name must never sit on a package border or run over a box edge. Names too long for a box are clipped with an ellipsis and keep a tooltip. Labels move off borders.
4. **Requirements trace gap.** The trace link from a requirement card to its chip leaves a wide empty gap. Bring the chips closer to the card (a small fixed gap), keep the packet running along the link, and keep the broken-link style.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Each of the four defects has a before and after measurement or screenshot reading in the review notes (before may be "not reproducible").
- [ ] Business: at 1000x700 and 1440x900 every note's text stays inside its note and every note inside its block, asserted by a headless script; long titles end with an ellipsis and show the full title in the tooltip.
- [ ] Flowchart: on the fixture functions with a loop (for, while, nested) the loop exit has at most two elbows more than the direct path and no edge passes through a node; existing flowchart tests pass (update an expectation only if a coordinate legitimately changes and say so).
- [ ] Components: no label or text overlaps a package or box border on the `relations` fixture; long names are clipped with tooltips.
- [ ] Requirements: the gap between card and chip is a fixed small value; packets still run.
- [ ] No console errors; `npm test` passes.
