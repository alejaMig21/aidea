# 03: Teacher classes skip ideas the Learner graph shows the person already holds

**What to build:** User story 48. Only the Probe and the covered display read the Learner graph; a Teacher class can teach again what the person already understands. Give the Teacher a read of the held ideas of this Project (only the ideas, never the person's raw answers) and make the core refuse a teaching step about an idea already held with strong Evidence, with a message the Teacher can act on.

**Blocked by:** None (can start immediately).

**Status:** done (every box checked; the real Tutor check is in the note below)

- [x] Through the protocol with scripted roles (`test/held-ideas.test.ts`): a step about a held idea is refused with a reason and a different step is accepted; an idea with weak or old Evidence is still taught; nothing changes for a person with an empty graph. "Held" is the Probe's rule (`heldIdea` in `probe.ts`) plus strong Evidence in this Project: a correct answer, confidence 70 or more, in the last 90 days. The Teacher reads `held_ideas` (name and statement only) and gives `idea` to `begin_step`.
- [x] Verified with the real Tutor on a short class (see the note below).

## Real Tutor check (haiku, 2026-10-30)

Same topic ("how a Python list keeps items when the same item is appended twice, and append to a list"), three runs, two ideas seeded as held (on the graph, correct answers with confidence 90 in this Project):

- Without seeded ideas the Teacher's first step was "What append does to a list" (idea "append adds at the end").
- With them seeded, the Teacher called `held_ideas` and its steps were "a list is an ordered container", "append changes the list itself" and "the list holds references to items": neither held idea was taught again.

Limit seen: the check compares names (and aliases). When the Teacher words a held fact differently ("append adds one item at the end" against the held "append adds at the end") the core cannot refuse it; only the Teacher's own choice from the `held_ideas` list keeps it out. Not measured: more than three runs, and a Teacher that ignores the list.
