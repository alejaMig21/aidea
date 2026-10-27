# 05: Algorithms layer

**What to build:** Every function in the Project can be opened as an Algorithm graph: its steps, branches and data flow as Nodes and wires, in the style of a control-flow graph. The person can zoom from a class into the Algorithm graph of one of its methods, and from the Algorithm graph into the source text.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] A function with branches and loops in the fixture Project produces an Algorithm graph with matching steps and branches.
- [x] Zooming from a class Node reaches the Algorithm graph of the chosen method.
- [x] Zooming from an Algorithm graph reaches the corresponding source text.

## Notes from the review

- Implemented and merged; verified live. The core builds the graph with the standard-library `ast` (never running the project), lays it out and frames it; the interface only draws it. If, loops (with else), break, continue, try/except, with, match, return and raise are steps with their ways in and out.
- Data flow is only a list of the names each step reads and writes (shown on hover); there are no wires between a write and the reads that use it.
- The way into a graph is double-click on a method or function Node (a class's methods are its member Nodes; double-clicking the class itself does nothing). A step's double-click shows its source text.
- Known gaps: nested functions and lambdas have no graph of their own; a `return` inside `try` with `finally` skips the `finally` step; exceptions are drawn only from the `try` step; two same-named definitions (a property and its setter) share one id and show the first graph; the graph is rebuilt on request but the line numbers of the Node list are those of the last refresh; the back-edge curve and label placement are still computed in the interface.
