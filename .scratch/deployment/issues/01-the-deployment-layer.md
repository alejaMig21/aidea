# 01: The Deployment layer

**What to build:** Decided 2026-11-03 and 04: a layer of its own, a sibling of Architecture, reached with the layer bar. Level 1 only: the C4-style deployment (deployment nodes that nest, infrastructure nodes such as a load balancer, firewall or DNS, and container instances), one environment at a time through a selector (My machine, Staging, Production). An instance points to its Architecture box by a trace link (broken if the box is deleted). "My machine" can be derived from the run recipe; the other environments are written with the Tutor. It has a Legend, a Probe before its first class and a "Teach me through it" class. Zoom never changes layer.

**Blocked by:** None (can start immediately).

**Status:** needs-info: a spec first

- [ ] The spec is written and approved (including how `.aidea/` says which part is derived and which authored).
- [ ] The layer appears in the layer bar with the three kinds of box and the environment selector.
- [ ] An instance traces to an Architecture box and shows a broken link when it is gone.
- [ ] "My machine" is derived from the run recipe.
- [ ] A Legend, a Probe and a "Teach me through it" class exist for it.
- [ ] GLOSSARY.md has the layer and the new kinds of box.

Source: `.scratch/future/interviews-pending.md` topic 5; `.scratch/future/research-deployment-notations.md`.
