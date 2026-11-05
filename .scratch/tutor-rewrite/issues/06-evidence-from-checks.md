# 06: A check that passed is evidence in the Learner graph

**What to build:** Today the Learner graph holds answers only. A check that passed (or failed) in a lesson or a practice problem is recorded as evidence that the person did something, marked as coming from a check, with the plugin and the check named. Nothing computes a score; the graph derives, never stores, what is understood.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser; the real Tutor was not started)

- [x] A passed check adds evidence marked "did it" with the plugin and the check; a failed one is recorded as an attempt.
- [x] The graph view and the review question treat it like any other evidence.
- [x] No number or level is stored.
- [x] Core API tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.

## What was built (2026-11-05)

- New Evidence kind `task` (`learner.ts`): the answer of a plugin's check to a task of a lesson step. `correct` is the check's answer (true done, false not done, null for "I don't know"); `check: {plugin, name}` names where it came from; `stepId`, `phase: "check"`, `attempt` and `item` (the Plan concept) as for any check, so a passed task counts as covered in the Plan and a failed one is an attempt. `confidence` is null (nobody was asked how sure).
- Nothing computes or stores a score or level: a test fails if the entry has any such field. The reader code needed no change (it never branched on the kind).
- Tests: `test/evidence-from-checks.test.ts` (3). Live (main monitor, the person's browser, stand-in Tutor): a wrong task and then the right one left two `task` entries (false, attempt 1; true, attempt 2) with the plugin and the check named, for the Plan item "relations".
