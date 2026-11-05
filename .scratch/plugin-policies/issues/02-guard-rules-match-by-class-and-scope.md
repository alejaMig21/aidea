# 02: Guard rules can match by class and scope

**What to build:** A guard rule from a plugin (plugin-system 11) can say which actions it concerns by class and scope, whatever the plugin that does them. A fixture policy denies writes inside the Project to any plugin, and does not touch a plugin that writes outside it (the essay-writing Builder of the person's example). Any "no" still wins and a rule still cannot allow what another denied.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The fixture policy stops a Builder writing inside the Project and a second plugin doing the same, with no mention of either by name.
- [ ] A plugin that writes outside the Project is not stopped.
- [ ] A rule that tries to name a type of plugin instead of an action is refused at registration.
- [ ] Core API tests pass.

Source: `.scratch/plugin-policies/spec.md`.
