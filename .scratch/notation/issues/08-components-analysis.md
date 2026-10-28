# 08: Components analysis reports relationships with their Resolution

**What to build:** The Python analysis of a Project reports what a UML-style Components diagram needs, each with a Resolution. Besides modules, classes, attributes and methods, it reports: inheritance (class to base class), import dependencies between modules, and calls between functions and methods. Each relationship is resolved (the target is certain: for example a direct call to a function defined in the Project, an import of a module in the Project), inferred (matched by name only), or unresolved (dynamic dispatch, `getattr`, calls through values the analysis cannot follow). Members carry their visibility derived from Python naming (leading underscore: private; dunder: special) and the markers needed for the notation (static, abstract, property). The analysis never imports or runs the Project, as today. The count of unresolved relationships is available for the legend.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Through the core protocol on fixtures: inheritance between classes of the Project is reported; a base class outside the Project is reported as external.
- [ ] Imports between modules of the Project are reported, with the imported names when they are explicit.
- [ ] A direct call to a Project function is resolved; a call by name to a method that several classes define is inferred; a call through `getattr` or a callable stored in a variable is unresolved, and none of these is dropped silently.
- [ ] Visibility, static, abstract (a class with abstract methods or deriving `ABC`) and property markers are reported on members.
- [ ] The total of unresolved relationships is reported.
- [ ] Earlier Components behaviour (outline, trace links, focus zoom, broken links) keeps working: all earlier tests pass.

## Review notes

Verified through the core protocol (`test/components-relations.test.ts`, fixtures in `test/fixtures/relations/`), `npm run typecheck`, and the full `npm test` (163 pass, 0 fail, 1 skipped).

- [x] Inheritance reported; a base outside the Project is `external: true`.
- [x] Imports between Project modules, with `names` when explicit.
- [x] Direct call resolved; method-name-only call inferred (one entry per candidate); `getattr` and variable callables unresolved, never dropped.
- [x] Markers on members: visibility, static, abstract (abstract method, `ABC` base or `ABCMeta`), property.
- [x] `unresolved` total reported.
- [x] Earlier behaviour intact (outline fields untouched, all earlier tests pass).

### Response shape (`POST /projects`, 201) for ticket 09

Existing fields are unchanged. New:

- `relationships: Relationship[]`, sorted by `from`, `kind`, `line`:
  `{ kind: "inherits" | "imports" | "calls", from: nodeId, to: nodeId | null, name: string, resolution: "resolved" | "inferred" | "unresolved", line: number, external?: true, names?: string[] }`
  - `inherits`: `from` class, `to` base class Node, or `null` with `external: true` (resolution `resolved`: certainly outside the Project; `name` is the base as written, e.g. `ABC`). A base the analysis cannot read (`make_base()`, unknown name) is `unresolved`.
  - `imports`: `from` module Node, `to` module Node (package `pkg/__init__.py` is `pkg.__init__`), `names` for `from m import a, b` (`["*"]` for star). Imports of outside modules are omitted. `importlib.import_module`/`__import__` with a literal Project module is resolved; computed is `unresolved` with `to: null`.
  - `calls`: `from` function or method Node (or module Node for top-level code), `to` function, method or constructor (`Cls.__init__`, else the class) Node; `null` when unresolved. `name` is the callee as written (`area`, `getattr`, `callback`). Calls to builtins and libraries are omitted.
- `unresolved: number`: count of `relationships` with `resolution: "unresolved"` (for the legend).
- On class and function Nodes: `markers: { visibility: "public" | "private" | "special", static?: true, abstract?: true, property?: true }`. A class is `abstract` when it derives `ABC`, names `ABCMeta`, or has an abstract method.
- On class Nodes: `attributeVisibility: { [attributeName]: "public" | "private" | "special" }`.

### Limits of the heuristics

- Name-only matching (`obj.m()`): every Project class defining `m` is a candidate, so common names yield many inferred edges; the receiver's type is not tracked. Calls on `self`/`cls` to an inherited method are inferred (a subclass may override); on the class itself, resolved.
- Calls through parameters, local or module variables, `getattr(...)()`, `x[k]()`, `f()()` are unresolved; names imported from a Project module but not defined there (re-exports) are unresolved when called.
- Nested functions are not Nodes: their calls are attributed to the enclosing function, and a call to a nested function is not reported. Class-body and decorator calls are not reported. Aliases (`h = obj.method`) are only unresolved when called by bare name.
- Composition and aggregation are not inferred (spec).
