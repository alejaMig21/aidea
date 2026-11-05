# 03: A lesson part can name a check, and the teach loop uses it

**What to build:** A part of a lesson can name one of the plugin's checks to judge its `tryIt`. After the Tutor asks the person to do the thing, it runs the check; if it passes the step closes, if not the Tutor teaches the step again, as it does after a missed question. Whether the result is recorded as Evidence for the Learner graph (as "did it", marked as coming from a check) is decided here with the person.

**Blocked by:** plugin-teaching 02.

**Status:** ready-for-agent

- [ ] A fixture plugin with a lesson part that names a check closes the step when the check passes and re-teaches when it does not (scripted Tutor).
- [ ] A lesson part that names a check the plugin does not declare is a finding (plugin-lessons 03 covers it).
- [ ] The decision on Evidence is written in this ticket and tested.
- [ ] Core API tests pass.

Source: `.scratch/plugin-teaching/spec.md`.
