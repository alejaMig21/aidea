# 05: Practice sessions, asked for by the person or by the Tutor

**What to build:** A separate kind of session, as in LearnHarness: the person or the Tutor asks for it. The Tutor picks ideas from the Learner graph that were taught but not reliably recalled and writes problems in three forms (recall, discrimination, composition), solving each before posing it and keeping the model solution and a rubric. Hints come one level at a time, from a nudge to a worked step, only when asked. A grader scores the answer and says where the reasoning first broke. A practical problem asks the person to do something in a plugin (lay out a given architecture on the Canvas) and the plugin's named check says whether they did. The Tutor never does the task for the person.

**Blocked by:** tutor-rewrite 04.

**Status:** ready-for-agent

- [ ] Either the person or the Tutor can start a practice session; the Tutor's request needs the person's yes.
- [ ] Problems target taught ideas that are not reliably recalled (a fixture Learner graph proves the choice).
- [ ] Hints come one level per request and the model solution is never shown before the answer.
- [ ] A practical problem is closed only by a plugin check; the Tutor has no tool that does the task.
- [ ] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
