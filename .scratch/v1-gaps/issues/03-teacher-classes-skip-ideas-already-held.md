# 03: Teacher classes skip ideas the Learner graph shows the person already holds

**What to build:** User story 48. Only the Probe and the covered display read the Learner graph; a Teacher class can teach again what the person already understands. Give the Teacher a read of the held ideas of this Project (only the ideas, never the person's raw answers) and make the core refuse a teaching step about an idea already held with strong Evidence, with a message the Teacher can act on.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Through the protocol with scripted roles (`test/held-ideas.test.ts`): a step about a held idea is refused with a reason and a different step is accepted; an idea with weak or old Evidence is still taught; nothing changes for a person with an empty graph. "Held" is the Probe's rule (`heldIdea` in `probe.ts`) plus strong Evidence in this Project: a correct answer, confidence 70 or more, in the last 90 days. The Teacher reads `held_ideas` (name and statement only) and gives `idea` to `begin_step`.
- [ ] Verified with the real Tutor on a short class (not done yet).
