# Layout, edge routing, and dynamic-Python honesty

Research date: 2026-10-28. Scope: (A) layered layout and edge routing conventions practical for a dependency-free JS/SVG interface; (B) how tools handle unresolved or dynamic relations in Python-derived graphs.

## TL;DR

1. Almost every serious diagram tool uses the same family: layered ("Sugiyama-style") layout. Steps: break cycles, assign ranks, order nodes per rank to reduce crossings, assign coordinates, route edges. Dot, dagre and ELK all follow it.
2. Dot and dagre are deterministic for identical input but not stable: a small edit can reshuffle the picture. aidea can get identical-input determinism for free by using no randomness and a fixed tie-break order.
3. Orthogonal routing is not free. Graphviz `splines=ortho` ignores ports and (in dot) edge labels; ELK supports orthogonal routing and ports properly but is a large GWT-compiled bundle under EPL-2.0.
4. dagre (MIT) gives layered layout plus compound nodes and edge-label sizes, but only emits polyline bend points, not orthogonal routes.
5. Reimplementing a minimal layered layout in the Node core (no dependency) is a few hundred to ~1500 lines of TypeScript (opinion). Rank by longest path, order by barycenter sweeps with a fixed tie-break, place on a grid, route with simple Manhattan elbows. Unrouted long edges are the hard part.
6. For Python, no static tool is complete: PyCG reports ~99.2% precision and ~69.9% recall; code2flow states no algorithm can be perfect for dynamic languages.
7. Tools are honest in different ways: code2flow documents heuristic fallbacks, pyan documents what it leaves out, py2puml restricts itself to type annotations, so its output is only as good as the annotations.
8. No standard notation for "approximate edge" exists that I could find. Dashed lines are a common visual convention, but I found no spec or paper that standardises it.
9. Recommendation: every derived edge carries an explicit `resolution` state (resolved / inferred / unresolved), drawn differently (solid / dashed / listed-not-drawn), plus a per-layer note on what the analysis cannot see.
10. Confidence: high on the algorithm family and licences stated; medium on draw.io and Structurizr (pages did not load); low on sizes and effort estimates (opinion).

## Comparison table

| Tool | Layout engine | Orthogonal routing | Determinism | Licence | Plain JS? |
|---|---|---|---|---|---|
| Graphviz dot | Layered (Gansner et al.) | `splines=ortho`, but "does not handle ports or, in dot, edge labels" | Deterministic, "not stable" per a third-party man page; pointer-ID ordering caused run-to-run variation in a forum thread | EPL (not verified here) | No (C binary) |
| dagre | Layered, network simplex ranking | No, polyline `points` only | Not stated | MIT | Yes |
| ELK / elkjs | Layered (also stress, force, tree, etc.) | Yes, default `ORTHOGONAL`, respects port constraints | Not stated; has a "Randomization Seed" option | EPL-2.0 | elkjs is GWT-compiled JS |
| Mermaid | ELK default since v12, dagre selectable | Via ELK | Inherited | Not stated on the page | Yes, but bundles engines |
| PlantUML | Graphviz default, Smetana (Java port of Graphviz), ELK (alpha) | ELK "supports only orthogonal" | Inherited | Not verified | No (Java) |
| Structurizr | `autoLayout` with direction and separations | Not stated | Not stated | Not verified | n/a |
| draw.io | Layout menu and edge styles | Not verified (pages 404) | Not verified | Not verified | n/a |

## A. Layout and edge routing

### What the sources say

**Original paper.** Sugiyama, Tagawa, Toda, "Methods for Visual Understanding of Hierarchical System Structures", IEEE Transactions on Systems, Man, and Cybernetics, SMC-11(2), pp. 109-125, 1981, DOI 10.1109/TSMC.1981.4308636. Source: [Kozo Sugiyama (Wikipedia)](https://en.wikipedia.org/wiki/Kozo_Sugiyama), plus a [TU Braunschweig bib record](https://ibr.cs.tu-bs.de/bib/xml/STT81.xml?lang=en) that drops "System" from the title. I did not read the paper itself.

**Graphviz dot paper.** Gansner, Koutsofios, North, Vo, "A Technique for Drawing Directed Graphs", IEEE Transactions on Software Engineering 19(3), pp. 214-230, 1993 (month disagrees across sources). PDF at [graphviz.org/documentation/TSE93.pdf](https://www.graphviz.org/documentation/TSE93.pdf) fetched as compressed binary, so I could not read it. Bibliographic facts come from the [search record](https://patents.google.com/patent/US4953106A) of the related AT&T patent and the dot manual citation. The four-step structure (rank, order, position, splines) is from my background knowledge, not verified in this session.

**Graphviz docs.** `rankdir` values TB (default), BT, LR, RL, "valid only for the dot layout engine": [rankdir](https://graphviz.org/docs/attrs/rankdir/). On orthogonal edges: "Currently, the routing does not handle ports or, in dot, edge labels": [splines](https://graphviz.org/docs/attrs/splines/). Determinism: a [Graphviz forum thread](https://forum.graphviz.org/t/how-to-plot-the-same-graph-repeatedly/1148) names pointer-as-ID ordering and `rand` as the two sources of variation. The "deterministic but not stable" wording comes from a third-party man page seen in search results, so treat it as medium confidence.

**ELK layered.** Described as "Arranges as many edges as possible into one direction by placing nodes into subsequent layers"; credits Sugiyama et al. 1981; default crossing minimisation `LAYER_SWEEP`; default edge routing `ORTHOGONAL`, with port constraints respected; compound graphs with cross-hierarchy edges when enabled; edge labels placed by a configurable strategy: [ELK layered reference](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html). The page does not claim determinism but exposes a randomization seed and model-order options, so determinism is achievable with fixed options (inference, not stated). Licence is EPL-2.0 per [the ELK repo licence](https://github.com/eclipse-elk/elk/blob/master/LICENSE.md). elkjs is "generated from ELK's Java code base using GWT", layout only, workers supported: [elkjs](https://github.com/kieler/elkjs). Its licence was not stated on the page I fetched.

**dagre.** "a JavaScript library that makes it easy to lay out directed graphs on the client-side", MIT, with only the `dagrejs` org fork receiving updates: [dagre README](https://github.com/dagrejs/dagre). Its wiki says it follows Gansner et al. (network simplex ranking by default, Brandes-Koepf coordinates, compound graph support, label width/height inputs, and per-edge `points`): [dagre wiki](https://github.com/dagrejs/dagre/wiki). Limits: layout only, nodes need known sizes, no orthogonal routing described. Maintenance beyond "receiving updates" was not verified.

**Mermaid.** ELK is the default engine since v12.0.0, dagre selectable, "tiny" build omits ELK and falls back to dagre: [Mermaid layouts](https://mermaid.js.org/config/layouts.html). Decisions are a Diamond shape with alias `decision`; subgraphs are supported, with the limit "If any of a subgraph's nodes are linked to the outside, subgraph direction will be ignored": [flowchart syntax](https://mermaid.js.org/syntax/flowchart.html). Subgraphs can be collapsed to one node with crossing edges redirected.

**PlantUML.** Graphviz default, Smetana is "a port from C to Java of GraphViz/DOT" ([Smetana](https://plantuml.com/smetana02)); ELK is bundled but described as alpha and "supports only orthogonal layout" ([layout engines](https://plantuml.com/layout-engines), [ELK page](https://plantuml.com/elk), via search snippets).

**Structurizr.** `autoLayout [tb|bt|lr|rl] [rankSeparation] [nodeSeparation]`, defaults 300 px for both separations; the page does not name the engine: [Structurizr DSL language reference](https://docs.structurizr.com/dsl/language).

**draw.io.** I could not load its layout or edge-style pages (404). No claims made.

### Practical reading for aidea

- The shared convention that engineers expect: flow in one direction (top-to-bottom or left-to-right), nodes in layers, few crossings, right-angle or smooth edges, labels near the edge midpoint, subgraphs as boxes around members.
- Every tool above that offers a compound box admits some friction: Mermaid ignores subgraph direction when members link outside; PlantUML notes ELK and Graphviz handle package edges differently. Expect compound boxes to be the hardest part.
- Orthogonal routing with edge labels is a known weak spot even in Graphviz.

### Recommendation for aidea (opinion)

1. Do not vendor ELK or dagre now. aidea ships zero runtime dependencies; dagre is MIT and small to vendor but yields polylines, and ELK's EPL-2.0 plus a GWT bundle is a heavy fit for a "plain JS/SVG" interface. Revisit only if hand-written layout proves inadequate.
2. Implement a minimal layered layout in the Node core, returning rectangles and edge polylines; the interface keeps drawing what it is given. Order of magnitude (opinion, not measured): 300-600 lines of TypeScript for rank-by-longest-path plus barycenter ordering plus grid coordinates plus elbow routing; 1000-1500 if adding dummy nodes for long edges, edge-label slots and one level of compound boxes. Ongoing cost is tuning, not writing.
3. Determinism rules: sort nodes and edges by stable id before layout, no randomness, fixed iteration counts, ties broken by id. This gives same-input-same-output; stability across edits is a separate goal (keep previous layer order as the initial order when available).
4. Route edges as Manhattan elbows (vertical-horizontal-vertical between layers) in the core; accept some overlap rather than chase optimal routing. Put labels at the midpoint of the longest horizontal segment.
5. Lay out compound boxes (subgraphs) by laying out children first, then treating the box as one rectangle, as Mermaid's collapsible subgraph does: crossing edges attach to the box.

## B. Dynamic languages and unresolved relations

### What the sources say

**PyCG.** Static inter-procedural analysis computing "assignment relations between program identifiers of functions, variables, classes, and modules"; reported precision about 99.2%, recall about 69.9%, about 0.38 s per 1k lines: [PyCG arXiv abstract](https://arxiv.org/abs/2103.00587) (ICSE 2021). I did not read the full paper, so what it cannot resolve is not verified. The repo is Apache-2.0 and archived: "PyCG is archived. Due to limited availability, no further development improvements are planned.": [PyCG repo](https://github.com/vitsalis/PyCG).

**code2flow.** "No algorithm can generate a perfect call graph for a dynamic language." Documents dropped calls (undefined in analysed files, lambdas, factory-generated functions, renamed or passed functions), skipped ambiguous same-name functions, and wrong links such as an external `searcher.search()` linked to a local `search()`, plus a heuristic fallback when a variable cannot be resolved. MIT: [code2flow README](https://github.com/scottrogowski/code2flow). Quotes are from the fetch summary, treat wording as paraphrase.

**pyan.** Uses edges solid black; defines edges dotted gray, off by default. Names limits: linear name binding, string annotations and `Optional[X]` resolve to nothing, lambdas folded into the enclosing function, "References outside the analyzed set are not drawn", and edges can point at the base class's method when a subclass overrides it. GPL v2: [pyan README](https://github.com/Technologicat/pyan). The README has a "What the graph leaves out" section, which is the closest thing to an honesty convention I found.

**py2puml.** "The detection of composition relationships relies on type annotations only"; "only constructors are visited, attributes assigned in other functions won't be documented"; "no code is executed nor interpreted". MIT: [py2puml](https://github.com/lucsorel/py2puml).

**pyreverse.** Not verified: the pylint docs pages I fetched were truncated before the relevant content. I did not confirm how it shows uncertain relations.

**Python language reasons static resolution is hard.** From the [data model reference](https://docs.python.org/3/reference/datamodel.html): "If no class attribute is found, and the object's class has a `__getattr__()` method, that is called to satisfy the lookup." Also "there are a number of hooks which allow for other means of locating attributes", and "Attribute assignment updates the module's namespace dictionary, e.g., `m.x = 1`". Together: attributes can be added or computed at runtime, so a call target is not decidable from source alone. Decorators, monkey patching and duck typing follow from the same model; I did not extract separate quotes for them.

**Soundness framing.** The static-analysis community terms this "soundiness"; bibliographic record: Livshits et al., "In Defense of Soundiness: A Manifesto", Communications of the ACM 58(2), 2015, pp. 44-46 ([Tufts record](https://dl.tufts.edu/catalog/tufts:20174)). I did not read it. A related ISSTA 2024 paper reports static tools missed on average 61% of dynamically executed methods on Android apps ([arXiv 2407.07804](https://arxiv.org/pdf/2407.07804)); this is Android/Java, so only indicative for Python.

**Structurizr / C4.** The DSL has `!impliedRelationships` to configure how implied relationships are created ([DSL reference](https://docs.structurizr.com/dsl/language)). I did not find a notion of "inferred from code vs declared" confidence. Not verified beyond that.

**Convention for marking approximate edges.** I found no standard in the sources above. The practice varies: pyan uses line style for edge kind (uses vs defines), not for confidence; code2flow documents heuristics in prose. I did not search the visualisation literature exhaustively, so "no standard exists" is a medium-confidence statement.

### Recommendation for aidea (opinion)

1. Give every derived edge a `resolution` value: `resolved` (single static target found), `inferred` (heuristic or name-match), `unresolved` (call site seen, target unknown). Store it in the model the core computes, not only in styling.
2. Draw them differently: solid for resolved, dashed for inferred, and for unresolved either a small "?" stub on the caller or a side list, not an invented edge. Always add a legend; dashed alone is not a standard.
3. Never over-approximate silently: code2flow's name-match fallback is exactly the failure to avoid, so label such edges `inferred`, never solid.
4. Show a per-layer "what this cannot see" note (dynamic attribute access, `getattr`, decorators, monkey patching, calls outside the analysed files), modelled on pyan's "What the graph leaves out".
5. For class diagrams, follow py2puml's rule: derive relations only from evidence (annotations, base classes) and say so. Missing annotations mean missing relations, not absent ones.
6. State precision/recall honestly in the docs: even the best published tool misses roughly 30% of calls on its benchmark, so "no edge" never means "no call".

## Not verified / paywalled

- Full text of Sugiyama et al. 1981 (paywalled IEEE) and Gansner et al. 1993 (PDF returned compressed binary). Algorithm step descriptions are from background knowledge.
- Full PyCG paper: what it cannot resolve.
- pyreverse docs: relation inference and uncertainty display.
- draw.io layout/edge-style docs (404 on both URLs tried); Structurizr engine and determinism; PlantUML licence; Graphviz licence; elkjs and Mermaid licences (not on fetched pages).
- Soundiness manifesto text; any standard for marking approximate edges.
- dot "deterministic but not stable" is from a third-party man page seen in search results only.
- All effort and size estimates are opinion.

## Open questions

- Does aidea need compound (nested) boxes in v1 layouts, or can a single flat layered layout suffice for the first release?
- Should unresolved call sites be drawn at all, or only counted and listed?
- How stable must layouts be across edits (is "same input, same output" enough)?
- Which Python constructs does aidea's own analysis plan to resolve first (imports and class inheritance are the cheapest and most reliable per the sources above)?
