# 02: A small deterministic layout engine in the core

**What to build:** The core computes positions and routes for directed graphs with a minimal layered layout, written in TypeScript with no dependency: nodes ordered by id (no randomness), ranks taken from edge direction, a way back for loops (an edge that returns upward), crossings kept low by a simple ordering pass, orthogonal routes with small elbows, edge labels given room, and one level of enclosing boundaries (a group whose box surrounds its children). The same input always gives the same output. It is exposed through the existing layout protocol as a reusable function, and the flowchart layout of the Algorithm graph switches to it (columns for branches side by side, merge points, loop back-edges routed around the loop), so it is demoable on the current Algorithm graph before the flowchart symbols arrive. Layout of other layers is not changed by this ticket.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Through the core protocol: laying out the same graph twice gives identical rectangles and routes.
- [x] No two node rectangles overlap; edges do not pass through nodes; for a straight function the steps stay in one column, for an `if` the two branches sit side by side and rejoin below, for a loop the back edge goes around its body.
- [x] A group is laid out as a box that contains all its children with a margin; nested one level is supported.
- [x] Edge labels get reserved space and do not overlap nodes.
- [x] Orthogonal routes use only horizontal and vertical segments with small elbows; the route of every edge is returned with the layout.
- [x] Existing Algorithm graph behaviour (Playback highlighting, focus zoom) keeps working: all earlier tests pass.
- [x] A larger sample (a function with nested loops and branches from the fixtures) is laid out in under a second.

## Review notes

Engine: `src/core/layered.ts` (`layered(nodes, edges, groups?)` returns `{ rects, routes, groups }`). The Algorithm graph uses it through `layoutFlow`; `/algorithm` now also returns `routes` (one per edge, same order) and a frame that includes every route point. `50-algorithm.js` draws the routes as polylines (arrows, labels and step markup unchanged).

- [x] Same graph twice gives identical rectangles and routes (protocol test; input order does not matter, tested on the pure function).
- [x] No node overlaps and no edge through a node: asserted on a straight function, an `if`, a loop, a 10-block nested sample, and 300 random graphs (throwaway fuzz script, not committed). A straight function stays in one column; `if` branches sit side by side with the join below; the loop back edge runs on a lane right of the body.
- [x] A group is a box around its children with a 20 px margin and other nodes stay outside (pure-function test; no protocol route produces groups yet, so groups are not covered through HTTP).
- [x] Edge labels sit in the gap between rows beside the edge; the test checks that no label box covers a step (width estimated at 6.5 px per character).
- [x] Routes are horizontal and vertical segments only, returned for every edge.
- [x] All earlier tests pass. One expectation changed in `test/algorithm.test.ts`: the frame is 592 wide instead of 568 because it now includes the way back (step rectangles are unchanged).
- [x] The 10-block sample (over 100 steps) lays out soundly; the engine takes about 30 ms in the worst fuzz case.
- [x] Looked at `more.risky` and `shapes.Scorer.classify` in headless Chrome: edges drawn as elbows, labels readable, no node crossed. Playback highlighting was not looked at in the browser (its tests pass).

Known limits (also `ponytail:` comments in the code): column placement is a simple pull towards neighbours, not a full compaction; parallel edges can share a horizontal run in the gap; a long label can run sideways over a neighbouring edge (never over a node); group boxes get one clearing pass each, so several crowded overlapping groups may still collide; a back edge whose source or target has a node to its right leaves or enters through the gap instead of the side.
