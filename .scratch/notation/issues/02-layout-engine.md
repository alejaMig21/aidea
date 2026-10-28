# 02: A small deterministic layout engine in the core

**What to build:** The core computes positions and routes for directed graphs with a minimal layered layout, written in TypeScript with no dependency: nodes ordered by id (no randomness), ranks taken from edge direction, a way back for loops (an edge that returns upward), crossings kept low by a simple ordering pass, orthogonal routes with small elbows, edge labels given room, and one level of enclosing boundaries (a group whose box surrounds its children). The same input always gives the same output. It is exposed through the existing layout protocol as a reusable function, and the flowchart layout of the Algorithm graph switches to it (columns for branches side by side, merge points, loop back-edges routed around the loop), so it is demoable on the current Algorithm graph before the flowchart symbols arrive. Layout of other layers is not changed by this ticket.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Through the core protocol: laying out the same graph twice gives identical rectangles and routes.
- [ ] No two node rectangles overlap; edges do not pass through nodes; for a straight function the steps stay in one column, for an `if` the two branches sit side by side and rejoin below, for a loop the back edge goes around its body.
- [ ] A group is laid out as a box that contains all its children with a margin; nested one level is supported.
- [ ] Edge labels get reserved space and do not overlap nodes.
- [ ] Orthogonal routes use only horizontal and vertical segments with small elbows; the route of every edge is returned with the layout.
- [ ] Existing Algorithm graph behaviour (Playback highlighting, focus zoom) keeps working: all earlier tests pass.
- [ ] A larger sample (a function with nested loops and branches from the fixtures) is laid out in under a second.
