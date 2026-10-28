# 09: The Components layer is drawn UML-style

**What to build:** The Components layer is drawn from the analysis of ticket 08 (spec: Components). A module is a package (box with a tab) holding class boxes with three compartments (name; attributes; methods) and small function boxes; visibility marks (`+`, `-`, `#`) appear on members and are labelled as derived from Python naming in the legend; static members are underlined, abstract classes italic. Inheritance is a hollow triangle, an import a dashed open arrow labelled `import`, a call a plain arrow. Resolution decides the stroke: resolved solid, inferred dashed, unresolved grey dashed marked "?" and never animated. Resolved and inferred relationships flow in their direction and carry message packets in a loop. The legend lists the notation, counts the unresolved relationships and says why they exist (dynamic Python) and what the layer leaves out (composition and aggregation are not inferred). Positions come from a layout of packages in columns with classes stacked inside, routed with the layout engine's routes. Focus zoom, trace links, broken links and node selection keep working.

**Blocked by:** 01, 02, 08

**Status:** ready-for-agent

- [ ] Through the core protocol: the Components layout places class boxes inside their package with the three compartments' heights accounted for, no overlaps, identical results for the same input, and returns routes for relationships.
- [ ] Packages, classes, functions, visibility, static, abstract, inheritance, imports and calls are drawn as described; unresolved relationships are grey dashed with "?" and do not move.
- [ ] Selecting a Node, the trace-link badges, broken links and zoom-to-footprint behave as before.
- [ ] The legend shows the counts of unresolved relationships.
- [ ] Verified headless: screenshots of a fixture with classes, inheritance, imports and an unresolved call next to the prototype's Components tab, differences listed in the review notes; packet positions sampled at two moments; no console errors.
