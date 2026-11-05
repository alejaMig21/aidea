# 04: The teach loop, using the lessons and checks of plugins

**What to build:** Keep the loop that already works, one fact per step: predict, explain starting from the prediction, check with confidence, repair a miss before going on. The steps come from the Plan. When the topic is a plugin, the Tutor reads the plugin's lesson (plugin-lessons 01) and, for a part with a practical task, asks the person to do it and runs the plugin's named check (plugin-teaching 02): the step closes when the check passes. What a plugin returns is untrusted data. This ticket absorbs plugin-teaching 03.

**Blocked by:** tutor-rewrite 03, plugin-teaching 02.

**Status:** ready-for-agent

- [ ] A lesson part that names a check closes its step only when the check passes (a fake plugin proves both outcomes).
- [ ] A miss keeps the step open and the Tutor teaches it again from another angle.
- [ ] The text of a lesson or of a check's answer that looks like an instruction is treated as data (a fake Tutor proves it).
- [ ] Steps come from the Plan: a step for something that is not in it is refused.
- [ ] Core API tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
