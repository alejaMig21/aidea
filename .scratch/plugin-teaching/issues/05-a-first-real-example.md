# 05: The Run plugin declares a real surface

**What to build:** The Run plugin (the one that starts the programs of a Project with Play) declares a view of its recipe and of the programs Play started, and checks ("the recipe is accepted", "a program is running", "every program is running"), to prove the design on something real before the Canvas and the layers get theirs. (This ticket was first written for Playback, the recordings of one function; Playback is still core code and is not a plugin, so its surface is plugin-teaching 08.)

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser with a stand-in Tutor)

- [x] The Tutor can read the Run plugin's view and the checks answer correctly before and after the person accepts the recipe, plays and stops.
- Moved: a lesson part for Run that uses the checks comes with the Run lesson (plugin-lessons 05, which splits the guide into one lesson per plugin); the task step that a check closes is proven in tutor-rewrite 04.
- [x] Core API tests pass; checked live on the main monitor with a stand-in Tutor (the real Tutor needs the person's quota).

Source: `.scratch/plugin-teaching/spec.md`.

## What was built (2026-11-05)

- The Run plugin declares `teach`: view `state` (`recipe`: none, needs-accept, accepted or its error state; `programs`: name, running, exit code) and three checks: `recipe-accepted`, `part-running {program}`, `all-running`. `main.js` gives the snapshot (`ctx.teach.state`, with the Project of the Tutor's session); `teach.mjs` has the view and the checks. The scan shows no surface warning for it.
- The ticket was written for Playback (the recordings of one function). Playback is core code, not a plugin, so its surface moved to a new ticket (plugin-teaching 08, waiting for the migration of the existing features into plugins); the Run plugin that starts the programs is what carries the real surface now.
- Tests: `test/run-surface.test.ts` (2): the scan, and the view and the checks before accepting, after accepting, while a real tiny program runs, and after Stop. Live (main monitor, the person's browser, `serve-fake-terminal.mjs` with a stand-in Tutor): after accepting and Play, `Run: recipe accepted, programs hello running. All running: true.` and the Terminal's tab; no page errors. The real Tutor was not started (quota).
