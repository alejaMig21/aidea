# 12: Pause and step, and the trace table of the flowchart

**What to build:** Two things the notation spec asked for that tickets 01 and 03 left out. (1) A "Pause and step" mode for the live motion of every diagram layer: a control next to the Animations switch freezes the loop (packets, dashes and glow stop where they are) and lets the person advance one hop at a time (Next hop, Previous hop, Resume live): a hop is one packet moving from one end of an edge to the other. On the flowchart it advances the Playback token one step when a recording exists. (2) A trace table beside the flowchart while a recording is replayed: variables as columns, one row per step reached so far, the current row highlighted, filled as the token moves and emptied on restart, using the values the recording already carries (the Algorithm column already shows the values at each step; the table shows their history). The table can be folded away and respects the narrow-window layout.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A visible, keyboard-reachable control freezes and resumes all motion on any layer; while paused, Next hop and Previous hop move one packet at a time along its edge, and the position is deterministic (the same hop number gives the same place).
- [ ] The paused state is remembered only for the session, is cleared when the layer or Project changes, and does not fight the global Animations switch or reduce-motion (either of those off means no motion at all and the stepping controls are hidden).
- [ ] On the flowchart with a recording, Next and Previous step the replay token one step and the existing Playback controls stay consistent with it.
- [ ] The trace table shows one row per step reached, columns for the variables of the recording, the current row highlighted, and the output column when the function prints; it can be folded away; long values are clipped with a tooltip.
- [ ] Stepping back removes rows after the current step; restarting empties the table; a recording with an error ends with an error row.
- [ ] Verified with a headless browser (no visible window) at 1440x900 and 1000x700: screenshots of the paused state and of the table mid-replay read by the implementer; packet positions at two hop numbers; no console errors; `npm test` passes.

## Review notes

New `48-stepmode.js` (Pause and step) and `48-trace-table.js`; small hooks: `45-notation.js` (`notationStepping` freezes dashes/glow through the existing `motion-paused` class, fires a `notation-sync` event) and `60-playback.js` (`pbShowStep` fires `playback-step`). No core change: `/playback` already returns per-step `locals`; `output` is one string for the whole run, so it appears on the last row only.

Verified with a headless Chrome script (1440x900 and 1000x700, core on `studio-c4` and `playback`), screenshots read:

- [x] Visible, keyboard-reachable (native buttons) control next to Animations; paused freezes dashes and glow (`motion-paused`) and hides the loop packets; Next/Previous hop move one stepping dot along one edge; hop 1 and hop 2 gave (119.5,165) and (356.5,305), and going back and forward again returned the same places. A hop is the packet of edge number h (drawing order) arriving at its end; hop 0 waits at the start of edge 0.
- [x] Cleared on layer change (live again, controls collapsed); the controls disappear when Animations go off and come back live when turned on. Reduce-motion starts with Animations off, so the same path hides them (not run with the real media query).
- [x] Flowchart with a recording: Next/Previous call the Playback step (position `3 / n` agreed, trace table rows followed).
- [x] Trace table: one row per step reached, columns for the recording variables, current row highlighted, Fold button, narrow width fits; Previous removes the last row; Record again starts at one row.
- [ ] Output column on the last row and the error row of a failing run were written but not exercised with a printing or failing recording.
- [ ] Long-value tooltip (`title` set when a value is cut at 24 characters) not checked visually.
- [x] No console errors; `npm run typecheck` and `npm test` pass (232 pass, 1 skipped).

Differences from the prototype: one Pause/Resume toggle plus Previous/Next buttons in the top bar instead of a card under the diagram; the table is a foldable overlay on the Canvas (bottom, above the zoom controls), not a side card; hops are per edge for all layers, not narrated block by block; at 1100 px and below the buttons show only icons.

Remaining: hop order is drawing order, not the story order; at 1000 px the layer bar scrolls a little more because the controls take room in the top bar; stepping hops does not highlight the edge on the flowchart while a recording exists (the Playback token is used instead).
