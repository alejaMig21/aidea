# 02: Measure what the person knows, inside the conversation

**What to build:** Replace the Probe (a separate run per layer with a fixed list of concepts) by a measurement inside the conversation, as LearnHarness does: the Tutor asks the goal if it is not clear, and asks questions per prerequisite topic that it chooses, starting near the hardest thing the goal needs, to find the floor and the ceiling. It stops when every topic is bracketed and the goal is concrete, and records the result once. The person can say they know something and skip it. What was measured feeds the Learner graph.

**Blocked by:** tutor-rewrite 01.

**Status:** ready-for-agent

- [ ] A fake Tutor that asks, records the bracket per topic and finishes once is accepted; one that finishes twice or while a question is open is refused.
- [ ] A topic the Learner graph already holds is not asked again.
- [ ] The person can skip a question with "I already know this" and it counts as known, not as a lie detector.
- [ ] The per-layer Probe and its fixed concept list are gone.
- [ ] Core API tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
