# 04: The teach loop, using the lessons and checks of plugins

**What to build:** Keep the loop that already works, one fact per step: predict, explain starting from the prediction, check with confidence, repair a miss before going on. The steps come from the Plan. When the topic is a plugin, the Tutor reads the plugin's lesson (plugin-lessons 01) and, for a part with a practical task, asks the person to do it and runs the plugin's named check (plugin-teaching 02): the step closes when the check passes. What a plugin returns is untrusted data. This ticket absorbs plugin-teaching 03.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser; the real Tutor was not started)

- [x] A lesson part that names a check closes its step only when the check passes (a fake plugin proves both outcomes).
- [x] A miss keeps the step open and the Tutor teaches it again from another angle.
- [x] The text of a lesson or of a check's answer that looks like an instruction is treated as data (a fake Tutor proves it).
- [x] Steps come from the Plan: a step for something that is not in it is refused.
- [x] Core API tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.

## What was built (2026-11-05)

- New question kind `task` for `ask`: `{stepId, kind: "task", prompt, plugin, check, args}`. The person sees only the prompt ("A task for you", button "I did it", or "Don't know"); the plugin and the check stay in the core. Before the person is asked, `taskProblem` (`plugins/teach.ts`) refuses a plugin that is not installed and enabled, a check that does not exist, or arguments that do not match what the manifest declares.
- The plugin's named check decides: "I did it" runs `check_plugin`; the step closes only when it passes. A miss (or "Don't know", which runs no check) leaves the step open for a re-teach from another angle, as with any miss. What the check returns reaches the Tutor marked untrusted (`untrusted`, `note`, `check: {ok, reason}`), unchanged, as data. A check that cannot run leaves the step as it was and says why.
- Steps still come from the Plan (an item outside it is refused: tested with a task step). Nothing is recorded as Evidence for a task: that is tutor-rewrite 06.
- Tests: `test/tutor-task-check.test.ts` (5). Instructions: step 4 names kind task; still under 4000 characters.
- Live (main monitor, the person's browser): `.scratch/tutor-rewrite/live-scripts/serve-fake-task.mjs` serves the real core and interface with a stand-in Tutor and a plugin with a teaching surface: the card "A task for you" appears, "I did it" on a wrong relation gives "Not yet: There is no such relation.", the corrected task gives "Step closed: the relation exists.", no page errors.
