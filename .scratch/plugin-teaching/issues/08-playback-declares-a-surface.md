# 08: Playback declares a teaching surface

**What to build:** When Playback (the recordings of one function, today in the core) becomes a plugin, it declares a view (the recordings made, and the step reached) and checks ("a function was recorded", "the recording was stepped to its end") and a lesson part that uses them. Until it is a plugin there is nothing to attach a surface to.

**Blocked by:** roles-and-providers 01.

**Status:** needs-info: Playback must first be a plugin (the migration of the existing features, roles-and-providers 01)

- [ ] The Tutor can read the Playback view after a recording and the checks answer correctly before and after.
- [ ] A scripted class asks the person to record a function and closes the step only when the check passes.
- [ ] Core API tests pass; `npm run verify` is green.

Source: `.scratch/plugin-teaching/spec.md`; split from plugin-teaching 05.
