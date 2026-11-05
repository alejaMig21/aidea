# 06: A check that passed is evidence in the Learner graph

**What to build:** Today the Learner graph holds answers only. A check that passed (or failed) in a lesson or a practice problem is recorded as evidence that the person did something, marked as coming from a check, with the plugin and the check named. Nothing computes a score; the graph derives, never stores, what is understood.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A passed check adds evidence marked "did it" with the plugin and the check; a failed one is recorded as an attempt.
- [ ] The graph view and the review question treat it like any other evidence.
- [ ] No number or level is stored.
- [ ] Core API tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
