# 01: Opening a project shows the fingerprint at once and never waits for the analysis

**What to build:** Opening a Project answers in well under a second with the fingerprint (ticket 02) and an overview by folder; the analysis (modules, relationships) and later any index run in the background and fill the layers in as they finish, with a plain line that says it is still working. This is the rule that keeps a huge Project from blocking the window; the speed of the analysis itself is big-projects 01.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] On Telegram the window is usable in under 1 s after choosing the folder, before the analysis ends (measured, written in the test).
- [ ] While the analysis runs the layers say so and do not show half-computed, wrong data.
- [ ] A Project whose analysis fails still opens, with the fingerprint and a plain message.
- [ ] Core API and page tests pass.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
