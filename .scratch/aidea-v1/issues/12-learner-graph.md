# 12: Learner graph

**What to build:** What the person demonstrates in Tutor sessions is recorded as Propositions and Reasoning chains in a Learner graph kept per user, separate from any Project and linked to the Project Node where it was learned. An extractor reads the Tutor's prose, an auditor finds duplicates, and a deterministic merger is the only writer. Afterwards the Tutor skips what the graph shows the person already understands. The method mirrors learnharness without copying its code or prompts.

**Blocked by:** 11

**Status:** superseded (see .scratch/tutor/spec.md and .scratch/tutor/issues)

- [ ] A correct answer in a Tutor session adds Propositions and a Reasoning chain linked to that session.
- [ ] Repeating the same concept does not create duplicates.
- [ ] A concept already in the graph is not asked again in a later decision.
- [ ] The graph is stored per user, outside any Project repository, as readable text files.
- [ ] Only the merger writes to the graph.
