# 06: A TypeScript or JavaScript function has an Algorithm graph

**What to build:** On aidea's own repository 680 functions are drawn on the Components layer, and none of them opens on the Algorithms layer: the TypeScript adapter offers `analyze` only (its header says flow and run come later). Double-clicking a function now answers "aidea cannot draw an Algorithm graph for TypeScript code yet" (a mixed Python and TypeScript project used to answer "The file cannot be read as Python", fixed in `adapters.ts`). Give `typescript-adapter.ts` a `flow(file, qualifiedName)` that returns the same step and edge shapes as the Python one (start, process, decision, loop, return, exception exits), so the Algorithms layer, its legend and the one-sentence steps work on `.ts` and `.js` functions. Playback (`run`) stays out of this ticket.

**Blocked by:** None.

**Status:** done (same work as language-adapters 04: `src/core/typescript-flow.ts`)

- [x] Double-clicking `loadRoutes` and `startCore` in `src/core/server.ts` opens a graph with its decisions, loops and early returns drawn with the layer's notation.
- [x] A function with `try/catch`, `switch`, `for...of`, `?.` and an arrow callback draws without a crash; a construct the adapter cannot place is drawn as one plain step, never skipped silently.
- [x] The legend check passes and says what the TypeScript graph leaves out.
- [x] Verified on the aidea repository (a copy) in the real app at two window sizes.
