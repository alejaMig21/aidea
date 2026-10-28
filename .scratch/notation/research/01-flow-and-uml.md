# Research 01: flowchart and UML notation for aidea's derived layers

Date: 2026-10-28. Scope: what an engineer expects from (1) algorithm flowcharts, (2) UML class diagrams, (3) package/component diagrams, so aidea can use industry grammar with its own visual style. "Recommendation" sections are opinion.

## TL;DR

1. ISO 5807:1985 is the flowchart standard; its text is paywalled, so symbol facts below come from a secondary source (Wikipedia). Medium confidence.
2. Core flowchart grammar: terminator (stadium) for start/end, rectangle for process, diamond for decision with labelled exits, parallelogram for input/output, double-sided rectangle for predefined process.
3. aidea's step kinds map cleanly: start/end -> terminator, step -> process, branch -> diamond, loop -> diamond (or preparation hexagon) plus a back edge, return/raise -> terminator variants.
4. UML 2.5.1 Activity diagrams are a second recognised grammar: solid circle (initial), bull's-eye (final), diamond (decision/merge), bar (fork/join). The diamond is the shared symbol.
5. Neither flowcharts nor UML has a "loop" node; loops are a decision plus a flow returning upward. "Back edge" is compiler vocabulary; draw it as an ordinary arrow.
6. Class boxes: three compartments (name / attributes / operations), visibility `+ - # ~`, static underlined, abstract italic or `{abstract}`, stereotypes in guillemets.
7. Inheritance = hollow triangle, realization = dashed line + triangle, dependency = dashed open arrow, composition = filled diamond, aggregation = hollow diamond.
8. Package = folder (box with a tab); module dependencies = dashed open arrow, `<<import>>` (public) or `<<access>>` (private). Lollipop/socket are for component interfaces and are rarely needed for Python module graphs.
9. The Python-to-UML mapping (underscore = private, @staticmethod = underline, ABC = italic) is aidea's inference, not the standard.
10. Drawing every step as a rectangle and modules/classes as outlines loses the decision/terminator cues an engineer scans for first.

---

## 1. Flowchart symbols (ISO 5807)

### What the standard says
- Catalogue page: [ISO 5807:1985](https://www.iso.org/standard/11955.html). Per the catalogue summary ([SCC listing](https://scc-ccn.ca/standardsdb/standards/8104722)), it defines symbols for information processing documentation and gives conventions for data, program and system flowcharts, program network charts and system resources charts. Confirmed current in 2019; 25 pages.
- It consolidates ISO 1028 and ISO 2636. It "does not restrict their use to the particular applications exemplified" and allows in-house rules (same catalogue summary). That is room for aidea's own style.
- **I could not read the standard text.** The [VDE preview PDF](https://assets.vde-verlag.de/iec-normen/preview-pdf/info_iso5807%7Bed1.0%7Den.pdf) is a scanned image with no extractable text.

### Symbol set (SECONDARY: [Wikipedia, Flowchart](https://en.wikipedia.org/wiki/Flowchart))
- Flowline: arrow showing order; arrowheads needed only when flow is not top-to-bottom or left-to-right (paraphrase).
- Terminator: stadium/oval, "Start"/"End". Process: rectangle. Decision: diamond, usually yes/no or true/false. Input/output: rhomboid.
- Predefined process: rectangle with double vertical edges, defined elsewhere.
- Preparation: elongated hexagon. On-page connector: small labelled circle. Off-page connector: pentagon.
- Fork/join: bar or double line.
- The article describes no dedicated loop symbol. The ISO "loop limit" pair (chamfered rectangles) is from my background knowledge and NOT verified.

### What tools actually do
- draw.io, Visio, Mermaid and similar ship the same shape set. I could not fetch their official pages (404s), so this is not a cited primary claim. Wikipedia's "common symbols (ANSI/ISO)" list is the best proxy.
- Labelled decision exits (Yes/No, true/false) are universal practice; I found no primary text on required placement.

### Recommendation for aidea (opinion)
- start and end: stadium. return and raise also end a path: stadium with distinct tint/icon (return normal, raise error).
- step: rectangle. Parallelogram only if I/O detection is cheap; skip otherwise.
- branch: diamond, exits labelled true/false; for `match`, label exits with the pattern text.
- loop: diamond with the condition is the most recognised form; a hexagon for `for x in xs` is defensible but less known. Keep the `back` edge as a normal arrow routed upward.
- A call to a function that has its own Algorithm: predefined-process shape (double bars), linking to that Algorithm.
- Flow top-to-bottom, always draw arrowheads.

---

## 2. UML 2.5.1 Activity diagrams

### What the standard says
Spec: [UML 2.5.1, formal/17-12-05](https://www.omg.org/spec/UML/2.5.1/PDF), section 15 (read from extracted text).
- Initial: "InitialNodes are notated as a solid circle".
- Activity final: "a solid circle within a hollow circle" (bull's eye). Flow final: "a circle with an 'X' cross inside it".
- Decision and merge: "a diamond-shaped symbol"; decision has one incoming and several outgoing edges, merge the reverse.
- Fork/join: "simply a line segment".
- Guards sit on outgoing edges and must evaluate true to pass a token.
- Exceptions: "a 'lightning bolt' symbol from the boundary of the protectedNode to a small square on the boundary of the ExceptionHandler", exception type beside the bolt.
- Action as rounded rectangle is figure-only; I did not find it in the text. Medium confidence.

### Comparison with flowchart
| Concept | ISO 5807 (secondary) | UML activity |
|---|---|---|
| start | stadium "Start" | solid circle |
| end | stadium "End" | bull's eye |
| step | rectangle | rounded rectangle |
| decision | diamond | diamond plus merge diamond |
| parallel | bar | fork/join bar |
| exception | none | lightning bolt |

### What tools actually do
Mermaid and PlantUML render action as a rounded box and decisions as diamonds with `[guard]`. No primary fetched; low confidence.

### Recommendation for aidea (opinion)
Keep diamond with guard labels. Skip fork/join (Python flow is sequential). For exceptions, a dashed edge labelled with the exception type from the try body to the handler is simpler than the lightning bolt.

---

## 3. Control-flow graphs (compiler theory)

### What the standard says
- Basic block: "a straight-line sequence of instructions"; "Only the last instruction or statement in each block can perform control flow" ([Wikipedia, Control-flow graph](https://en.wikipedia.org/wiki/Control-flow_graph), secondary).
- LLVM: a basic block "ends with a terminator instruction (such as a branch or function return)"; the entry block cannot have predecessors ([LLVM LangRef](https://llvm.org/docs/LangRef.html)). Primary, for LLVM IR only.
- Back edge: an edge whose "destination block is present on all possible paths to the source block", so the target dominates the source (Wikipedia, same page).
- Exceptions: the article only says exception handling "can produce" abnormal edges; it says nothing on `finally`. No primary source found on drawing `finally`.
- CPython `ast`: `Try(body, handlers, orelse, finalbody)`, `TryStar` (3.11, `except*`), `With`/`AsyncWith`, `Match(subject, cases)` (3.10), `For`/`AsyncFor` (`orelse` runs unless `break`), `While` ([ast docs](https://docs.python.org/3/library/ast.html)). Comprehensions are expressions (`ListComp`, etc. with `generators`); `Yield` and `Await` are expressions.
- `dis`: "Bytecode is an implementation detail of the CPython interpreter"; `SETUP_FINALLY`-style opcodes "do not appear in Python bytecode" ([dis docs](https://docs.python.org/3/library/dis.html)). So AST, not bytecode, is the right base.

### What tools actually do
Compiler visualisers draw straight-line blocks with true/false labelled edges (LLVM colour conventions: from memory, unverified). Source-level flowchart tools collapse a statement to a node, like aidea.

### Recommendation for aidea (opinion)
- Document unmodelled constructs explicitly: `with` (implicit exit path), `try/except/else/finally`, loop `else`, `break/continue`, comprehensions (one step), generators and `await` (a step).
- A back edge only needs "loop body end -> loop head"; no dominance analysis.
- The step kinds listed lack try/except/finally, with, break/continue. Python engineers will look for these first.

---

## 4. UML 2.5.1 class diagram notation

### What the standard says
Source: [UML 2.5.1](https://www.omg.org/spec/UML/2.5.1/PDF), sections 7, 9, 11.
- Property syntax: `[<visibility>] [/] <name> [: <type>] [[<multiplicity>]] [= <default>] [{<modifiers>}]`; visibility is `+ - # ~`; `/` marks derived.
- "Static Features are underlined."
- "The name of an abstract Classifier is shown in italics, where permitted by the font in use"; alternative `{abstract}`.
- Keywords and stereotypes in guillemets, for example `<<interface>>`.
- Generalization: "a line with a hollow triangle as an arrowhead". Realization: "a dashed line with a triangular arrowhead". Dependency: "a dashed arrow", client at the tail.
- Aggregation: hollow diamond at the whole's end; composition: filled diamond (association notation). Multiplicity and role names go at association ends.
- `{readOnly}` marks read-only properties.
- I did not extract the operation grammar; it mirrors the property grammar.
- Secondary cross-check: [draw.io UML class guide](https://www.drawio.com/blog/uml-class-diagrams) gives the same visibility symbols, italic abstract, underlined static.

### What tools actually do
draw.io, PlantUML, Mermaid and IDE diagrams use three compartments and these symbols. pyreverse (pylint) draws the same boxes; unverified, no primary fetched.

### Python mapping (aidea's inference, NOT the standard)
| Python | UML rendering |
|---|---|
| `_name` | `-` (private by convention; `#` is arguable) |
| `__name` (mangled) | `-` |
| dunder methods | `+`, optionally grouped or marked |
| `@property` | attribute (derived `/` is arguable) |
| `@staticmethod`, `@classmethod` | underlined |
| `ABC`, `@abstractmethod` | italic name / `{abstract}` |
| base class | generalization (hollow triangle) |
| `Protocol` | `<<interface>>`; realization is structural, draw only if explicit |
| annotated attributes | `name : type` |

### Recommendation for aidea (opinion)
Three-compartment boxes, one visibility glyph per member, underline static, italic abstract, keyword line for `<<dataclass>>`/`<<protocol>>`. Generalization arrows only for bases resolved inside the project. Composition/aggregation only when the attribute type is a project class, and label it inferred.

---

## 5. Package and component diagrams

### What the standard says
- Package: "a large rectangle with a small rectangle (a 'tab') attached to the left side of the top" ([UML 2.5.1](https://www.omg.org/spec/UML/2.5.1/PDF), packages).
- Import: "a dashed arrow with an open arrowhead from the importing Namespace to the imported Package"; `<<import>>` for public, `<<access>>` for private. Generic dependency: dashed arrow with an optional keyword such as `<<use>>`.
- Component: classifier box; "The provided and required Interfaces of a Component may be shown by means of ball (lollipop) and socket notation".
- Interface: lollipop (provided), half-circle socket (required).

### What tools actually do
Module-dependency tools draw plain boxes with arrows and no lollipops. Visual Studio retired its UML designers in 2017 in favour of dependency diagrams and code maps ([Microsoft Learn](https://learn.microsoft.com/en-us/previous-versions/visualstudio/visual-studio-2017/modeling/what-s-new-for-design-in-visual-studio?view=vs-2017)). pydeps/pyreverse specifics: from memory, unverified.

### Recommendation for aidea (opinion)
- Module = box with a tab, classes nested inside.
- Import edges: dashed open arrow, `<<import>>` label only when useful. No lollipops: Python has no explicit provided/required interfaces.
- Module-level functions: a compartment on the module box. UML has no standalone-function symbol, so this is a documented convention, not standard.

---

## 6. What a standards-literate reader misses in aidea's current state

(State as given: Algorithm steps all rectangles; Components drawn as outlines.)
- Flowcharts: no terminator, so start/end/return/raise look like steps; no diamond, so decision points are not scannable.
- Loops: a rectangle with a back edge is only clear if the arrow is; readers expect a diamond test with an upward return.
- Class diagrams: an outline hides the attributes/operations split and visibility/static/abstract cues; inheritance is not distinguishable from dependency without arrow styles.
- Package diagrams: without the tab a module looks like a class; dashed vs solid arrows are the main semantic channel.

## Not verified / paywalled
- ISO 5807 full text (paywalled, preview is a scan). All symbol facts via Wikipedia (secondary).
- ISO loop-limit symbol shape; DIN 66001 (no source found).
- draw.io and Visio official shape pages (404).
- UML: action as rounded rectangle, operation grammar and exact multiplicity/role-name placement were read from extracted text, not figures.
- How tools draw `finally`; pydeps/pyreverse behaviour; LLVM colours; Mermaid/PlantUML activity rendering.
- Spec section numbers are approximate; quotes are from the extracted PDF text.

## Open questions
1. Does the extractor model `with`, `try/except/finally`, `break/continue` today? Restyling before that leaves gaps.
2. Is an I/O parallelogram worth heuristic detection, or noise in code-derived flows?
3. Do `return`/`raise` get stadiums with a tint, or their own shape?
4. Components: classes nested inside the module tab box, or separate boxes joined by containment? Needs a layout check.
5. Inferred composition/aggregation arrows from attribute types: worth the false positives?
