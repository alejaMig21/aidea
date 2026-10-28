# 09: The Components layer is drawn UML-style

**What to build:** The Components layer is drawn from the analysis of ticket 08 (spec: Components). A module is a package (box with a tab) holding class boxes with three compartments (name; attributes; methods) and small function boxes; visibility marks (`+`, `-`, `#`) appear on members and are labelled as derived from Python naming in the legend; static members are underlined, abstract classes italic. Inheritance is a hollow triangle, an import a dashed open arrow labelled `import`, a call a plain arrow. Resolution decides the stroke: resolved solid, inferred dashed, unresolved grey dashed marked "?" and never animated. Resolved and inferred relationships flow in their direction and carry message packets in a loop. The legend lists the notation, counts the unresolved relationships and says why they exist (dynamic Python) and what the layer leaves out (composition and aggregation are not inferred). Positions come from a layout of packages in columns with classes stacked inside, routed with the layout engine's routes. Focus zoom, trace links, broken links and node selection keep working.

**Blocked by:** 01, 02, 08

**Status:** done

- [x] Through the core protocol: the Components layout places class boxes inside their package with the three compartments' heights accounted for, no overlaps, identical results for the same input, and returns routes for relationships.
- [x] Packages, classes, functions, visibility, static, abstract, inheritance, imports and calls are drawn as described; unresolved relationships are grey dashed with "?" and do not move.
- [x] Selecting a Node, the trace-link badges, broken links and zoom-to-footprint behave as before.
- [x] The legend shows the counts of unresolved relationships.
- [x] Verified headless: screenshots of a fixture with classes, inheritance, imports and an unresolved call next to the prototype's Components tab, differences listed in the review notes; packet positions sampled at two moments; no console errors.

## Review notes

Core: `src/core/components-layout.ts` (`layoutComponentsDiagram`), served by `GET /layout?layer=components` as `{ rects, compartments, routes }`. UI: `src/ui/features/47-components.js`, called from `draw()` in `00-canvas.js`. Verified with `test/components-layout.test.ts` (6 tests), `npm run typecheck`, the full `npm test` (199 pass, 0 fail, 1 skipped) and a headless Chrome script (1440x900) on the `relations` and `traced` fixtures.

- [x] Through the protocol: class boxes sit inside their package under a tab header, compartment heights follow member counts (`compartments[class]` gives the y of each compartment), no overlaps, identical results for the same Project twice, routes returned for relationships.
- [x] Drawn: packages with a tab, three-compartment classes, function boxes, `+ - ~` marks, underlined static, italic abstract (class and method), inheritance as a hollow triangle at the base, imports as dashed open arrows labelled `import`, calls as open arrows. Unresolved: grey dashed with `?`, `data-tone="unresolved"`, no packets, computed animation `none`.
- [x] Selecting a Node (class, method row, function, package opens the code box), zoom to footprint and zoom out (headless on `traced`: 8 elements dimmed, Components shown, Zoom out returns to Architecture). Broken links are covered by the existing protocol tests; `has-broken` styling is on authored cards only and untouched.
- [x] Legend lists shapes, visibility marks (stated as derived from Python naming), arrows, the unresolved count (3 on `relations`) with the dynamic-Python reason, and what is not shown.
- [x] Hover a class lights its relationships (4 lit for `Circle`); no console errors besides the pre-existing `/favicon.ico` 404.
- Packets (headless, 900 ms apart, 13 on the `relations` fixture), first four: (571,448) then (580,484); (593,331) then (676,331); (582,409) then (582,454); (587,407) then (620,421).

Layout: a package per column (220 px gap), classes and top-level functions stacked in source order. Rectangles never depend on relationships. Routes leave the right side of the source and enter the facing side of the target through channels in the gaps; a hop over a column runs along a lane above all packages. Several calls between the same two boxes merge into one route (`count`) and take the weakest resolution. Relationships with no target (outside base class, unresolved call) are 30 px stubs out of the source box.

Changed old expectations: `test/focus.test.ts` frames for `billing.charge` and `orders.place` (function boxes now sit inside a package: x=14, y=48, 220x30; the next package column starts 220 px after the previous). Added a focus test: zooming to a method keeps its class box lit, and to a class keeps its members lit (`litBy` in `routes/focus.ts`).

Differences from the prototype:
- Edges are plain grey with accent packets (as in the prototype); only unresolved takes a tone. Resolved calls and inheritance are solid with a packet but no flowing dashes (the kit's `data-flow` makes lines dashed, which would hide the solid/dashed meaning); inferred calls and imports are dashed and flow.
- Unresolved is a short stub with the name and a `?` beside it, not a bubble on a line, because there is no target box. An outside base class (`ABC`, `Mixin`) is a stub with a hollow triangle and carries no packet.
- No trace table, step mode or guillemets on `import`; `~` marks special names (the prototype has no such mark); properties show without `()`.
- Calls are drawn box to box (class, function or package), not method to method.

Remaining problems:
- Many cross-column calls make a dense bundle of parallel routes in the gaps (visible between `render` and `shapes`); channels are spread but crossings are not minimised.
- One column per module: a Project with many modules is very wide (no wrapping into bands).
- Long member names are not clipped (width estimated at 7.4 px per character).
- The shared legend "Colours" row still says "Unresolved or inferred: grey, dashed, never moving" (`45-notation.js`, left alone to avoid merge conflicts); inferred edges do move here, as the ticket asks.
