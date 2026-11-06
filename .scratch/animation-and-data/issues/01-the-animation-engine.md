# 01: The animation engine

**What to build:** Data already draws recorded values (lists, dictionaries, linked objects) in step with Flow. Make that an engine: a language-neutral recording drawn with pieces (list, tree, weighted graph, grid; a stack, a queue and a heap are lists), with the transition between one step and the next animated and respecting the Animations switch. Data uses it, and so can the git graph and a performance lens.

**Blocked by:** None (can start immediately).

**Status:** split on 2026-11-06 into 08, 09, 10 and 11 after the spec was agreed (`.scratch/animation-and-data/spec.md`); this ticket stays as the umbrella and is not built on its own.

- [ ] The spec says which pieces exist, which are new and how a plugin adds one.
- [ ] Tree, weighted graph and grid pieces are drawn from the recorded shapes.
- [ ] A step to the next is animated; with Animations off it is a plain change.
- [ ] Data uses the engine with its existing tests unchanged.
- [ ] A fixture consumer outside Data draws with it.

Source: `.scratch/future/ideas.md`; `.scratch/future/interviews-pending.md` topic 4.
