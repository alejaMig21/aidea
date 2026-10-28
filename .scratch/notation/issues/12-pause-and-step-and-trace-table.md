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
