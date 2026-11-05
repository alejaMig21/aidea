# 05: Practice sessions, asked for by the person or by the Tutor

**What to build:** A separate kind of session, as in LearnHarness: the person or the Tutor asks for it. The Tutor picks ideas from the Learner graph that were taught but not reliably recalled and writes problems in three forms (recall, discrimination, composition), solving each before posing it and keeping the model solution and a rubric. Hints come one level at a time, from a nudge to a worked step, only when asked. A grader scores the answer and says where the reasoning first broke. A practical problem asks the person to do something in a plugin (lay out a given architecture on the Canvas) and the plugin's named check says whether they did. The Tutor never does the task for the person.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser; the real Tutor was not started)

- [x] Either the person or the Tutor can start a practice session; the Tutor's request needs the person's yes.
- [x] Problems target taught ideas that are not reliably recalled (a fixture Learner graph proves the choice).
- [x] Hints come one level per request and the model solution is never shown before the answer.
- [x] A practical problem is closed only by a plugin check; the Tutor has no tool that does the task.
- [x] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.

## What was built (2026-11-05)

- `src/core/practice.ts` and four Tutor tools. The person starts practice with `POST /tutor/classes {project, practice: true}` (another context, it combines); the Tutor offers it with `offer_practice {reason}`: a card "Practice?" with "Practice now" / "Not now", and only a yes turns practice on. Practice tools are refused outside a practice session.
- `practice_targets`: the ideas of this Project on the Learner graph that are not held with strong Evidence (taught, not reliably recalled); the core chooses them, a problem about any other idea is refused. Empty list: the Tutor is told to say so and `finish_class` (which now works without a step in a practice session).
- `problem {problemId, idea, form (recall | discrimination | composition), kind (choice | text | task), prompt, ..., solution, rubric}`: the Tutor must supply its own solution and rubric first; they stay in the core and are revealed to the Tutor only after the answer (a test scans every question the person sees). A text answer is graded against solution plus rubric by the grader; a choice by the program; a task by the plugin's check (the Tutor has no tool that does the task). Every answer is Evidence of phase `practice` with the idea (a task also names the check).
- Hints: the person presses "Hint (n of 6)"; the result tells the Tutor the level (attention cue, pattern type, category, specific idea, outline, worked step); `hint {problemId, text}` is refused unless one was asked for, shows the hint and poses the same problem again; at most six; no more after that.
- UI (`50-tutor.js`): cards "Practice?" and "Practice" (no confidence row for the offer), the Hint button, the hint line in the log.
- Not here: a button for the person to start practice from the panel (tutor-rewrite 07 builds the panel and its Practice entry; the API is ready).
- Tests: `test/practice.test.ts` (8). Live (main monitor, the person's browser, stand-in Tutor): `.scratch/tutor-rewrite/live-scripts/serve-fake-practice.mjs`, started with `tutorUi.startClass({payload: {project, practice: true}})`: the card "Practice" with Hint (1 of 6), the hint line, the button moving to 2 of 6, and "Right. Solution: ..." after the answer; also "Don't know" ended it with the solution. No page errors.
