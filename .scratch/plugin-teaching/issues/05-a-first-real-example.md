# 05: A built-in plugin declares a real surface

**What to build:** The Run plugin (Playback) declares a view (the recordings made, and the step reached) and checks ("a function was recorded", "the recording was stepped to its end") and a lesson part that uses them, to prove the design on something real before the Canvas and the layers get theirs.

**Blocked by:** tutor-rewrite 04.

**Status:** ready-for-agent

- [ ] The Tutor can read the Run plugin's view after a recording and the checks answer correctly before and after.
- [ ] A scripted class teaches the Playback lesson, asks the person to record a function, and closes the step only when the check passes.
- [ ] Core API tests pass; verified live with the real Tutor in Vivaldi.

Source: `.scratch/plugin-teaching/spec.md`.
