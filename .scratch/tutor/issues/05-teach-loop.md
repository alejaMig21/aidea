# 05: The teach loop: predict, one fact, check, repair

**What to build:** A class teaches in steps. For the next untaught step of the Plan (until ticket 07 exists: of a topic the person names), the Teacher first asks the person to predict, in a turn of its own and open-ended; then explains one fact, opening by resolving the prediction; then checks with a multiple-choice or free-text question whose correct answer was fixed before it was shown. A wrong check is diagnosed and re-taught before the next step; a right check moves on. Confidence and "what I thought" are recorded as Evidence (ticket 04). The Teacher's instructions are written for aidea and say these rules in plain positive terms; they are not copied from LearnHarness.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] Through the protocol with a scripted Teacher: a predict question is posed before the explanation tool is accepted for that step (the order is enforced by the core, with an error the model can act on otherwise).
- [ ] A check is rejected if it has no committed correct answer.
- [ ] A wrong check keeps the step open: the next step is refused until a re-teach and a correct check, and each attempt is Evidence.
- [ ] Free-text answers are graded by a model call against the committed answer, tested with a scripted grader.
- [ ] The class can be ended by the person at any moment and the pipeline of ticket 04 still runs on what was taught.
- [ ] A short live run against the real Claude Code is recorded in the ticket's review notes (a manual script, not an automated test).
