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
