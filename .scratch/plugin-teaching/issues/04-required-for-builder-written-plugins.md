# 04: The surface is required for plugins the Builder writes, a warning for the rest

**What to build:** A plugin the Builder writes that adds a Panel, a layer or other state of its own cannot be proposed for installing without a valid view, valid checks and a lesson; the reason is shown in plain words. A plugin with no state of its own (a theme, a guard rule) needs only its lesson. For every other plugin a missing or stale surface is a warning in the quarantine report, at load and in the update difference, never a block. The plugin template carries an empty surface and the Creator Mode skill says to write and update it.

**Blocked by:** plugin-lessons 04.

**Status:** ready-for-agent

- [ ] A Builder-written plugin with a Panel and no valid surface is not proposed; a Builder-written theme with only a lesson is.
- [ ] A third-party plugin without a surface installs with a warning.
- [ ] The template, copied unchanged, still passes the scan and installs.
- [ ] The skill tells the agent to write and update the view and the checks.
- [ ] Core API tests with a fake Builder pass.

Source: `.scratch/plugin-teaching/spec.md`.
