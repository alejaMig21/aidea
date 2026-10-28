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
- [x] No console errors; `npm test` passes.

## Review notes

Measured with a headless Chrome script (1000x700 and 1440x900) against a core on a temp port. For each text it compares the text box with every rectangle border (a text wholly inside a later-painted rect such as a package tab is not judged against the one behind it) and, for Business, the note text against its note. Business used a scratch project with 36 notes (long, very wide-letter and unbroken titles); Components used the `relations` fixture plus a scratch project with very long names.

- [x] 1 Business. Before (both sizes): 6 of 36 notes had a text line 116-135 px wider than the note (`WWWW MMMM` style titles; the old wrap counted 30 characters, not pixels). After: 0 escapes, 0 notes outside their block; long titles wrap to at most two lines and end with an ellipsis, the full title is the tooltip (it already was). Fix: `businessWrap` measures with a canvas at the note's width.
- [x] 2 Flowchart. Before: a loop exit left the bottom of the decision and dropped, jogged and dropped again: 2 elbows for `for`/`while`, 6 elbows for `while` with a `break` (a jog per row). After: it leaves the side facing the next step and drops straight to its top: 1 elbow on all five fixtures (for, while, nested, for with an if, while with a break); sound (no node crossed), deterministic. Tests in `test/layout-engine.test.ts`. No old expectation changed. The way back now comes into the loop from above when the exit takes the right side, so the two never share the decision's right corner.
- [x] 3 Components. On the `relations` fixture no label or member name sat on a border (the package name inside its tab is covered by the tab, so it only looked like a hit): not reproduced, nothing changed for it. Long names did reproduce: class, member, function and package names ran 50-200 px over their box. Now they are cut with an ellipsis (width estimated per character) with the whole name as a tooltip; clipped stub labels get the tooltip too. 0 hits on both fixtures at both sizes.
- [x] 4 Requirements. Before: chip 50 px from the card, the next column 320 px away. After: chip 24 px from the card, columns 260 px apart (`layoutRequirements`, test added), packets still run (3 trace edges with `data-packets`), broken style untouched. The old drawing also let 2 criteria lines and the Measure line run 27 and 14 px past the card edge: clipped to 38 characters.
- [x] No console errors in any run; typecheck and `npm test` pass (231 pass, 1 skipped).
- [ ] Not verified: Playback token along the new exit routes (routes only changed shape; the replay code follows the route points), hover tooltips (set in the markup, not hovered), a loop exit whose label cannot fit (falls back to the old route; no fixture).

Remaining problems:
- The way back still runs 24 px right of the rightmost node of its rows, so it is wide when the exit branch sits beside the body; hugging the body would make it cross the exit edge. Left as is.
- Character-width estimates for Components (7.4 px mono, 8.4 px for the class name); a different font could still overrun a few pixels.
