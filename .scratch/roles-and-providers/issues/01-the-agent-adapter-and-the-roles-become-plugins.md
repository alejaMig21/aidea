# 01: Roles and Providers: the agent adapter becomes a plugin

**What to build:** ADR 0008 says the Tutor and the Builder are roles filled by Provider plugins and the agent adapter (Claude Code) is a required plugin, but today the adapter lives in the core (`src/core/adapter/`). Make the Provider a plugin kind with one instance per role first, behaviour unchanged, and the Claude Code adapter the first Provider. The migration of the other features into plugins (Files, Code, Playback, the layers) is not this ticket; each gets its own specification.

**Blocked by:** None (can start immediately).

**Status:** needs-info: the spec the plugin-system spec left out (which services stay single-instance, the list of named slots, the required plugins)

- [ ] The spec exists and is approved: services, slots and the required plugins.
- [ ] The Claude Code adapter runs as a Provider plugin and every existing Tutor and Builder test passes unedited.
- [ ] A role needs at least one Instance; the last Provider cannot be removed, and with none the emergency screen says so.
- [ ] A fake Provider written as a plugin drives a role in a test.

Source: ADR 0008 points 2 and 7; `.scratch/plugin-system/spec.md` section Out of scope.
