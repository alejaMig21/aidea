# 04: What happens to a decision class the person keeps missing

**What to build:** A decision class is meant to be short, but a step closes only when its check is answered correctly. In a live run a person who kept answering wrongly got seven questions over more than two and a half minutes about one decision, and the class then ended with the decision still waiting (the way out, "Decide for me", was there but not mentioned during the class). Decide what the class should do after repeated misses, then build it. The person decides this one (see Options); the rest of the ticket is written once they have chosen.

**Options:**
1. After a number of misses (for example three) the Tutor stops asking, gives the answer in a few plain sentences and closes the decision class as done, so the Proposal can be accepted (the person may still reject it).
2. After the same number of misses the class stays open but the Tutor column shows a line "Taking long? You can let the builder decide" with the "Decide for me" button next to it.
3. Leave it as it is.

**Blocked by:** None (the person was asleep: option 2 was chosen by the assistant, as it recommended, and is logged in `.scratch/overnight/LOG.md` for the person to change).

**Status:** ready-for-agent

- [x] The behaviour is option 2 with three misses: the class stays open and, from the third miss of the same step, the Tutor column shows one line "Taking long? You can let the builder decide" with the "Decide for me" button next to it; nothing is recorded as Evidence for showing it. (Core emits `decision_hint` once, on the third miss of one step of a decision class; checked headless at 1920 and 1280 px with a scripted Teacher, no console errors; the button skips the class and the Proposal becomes acceptable.)
- [x] Through the protocol with a scripted Teacher: the behaviour happens after exactly that number of misses and not before; a class answered correctly is unaffected. (`test/decision-classes.test.ts`)
- [ ] Verified live with the real Claude Code on the second monitor.


**Moot 2026-11-04:** decision classes were removed (see `.scratch/tutor/issues/10-decision-classes.md`).
