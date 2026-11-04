# 17: Plugin test tool

**What to build:** A small tool for plugin authors that boots the real kernel with a plugin, activates it, deactivates it, and checks every registry is back to its baseline, with contract tests for each plugin kind (Panel, guard rule).

**Blocked by:** 03, 11.

**Status:** ready-for-agent

- [ ] The tool reports a leak when a fixture plugin forgets to undo something.
- [ ] The Panel and guard-rule contract tests run against the built-in Terminal plugin and a fixture.
- [ ] It is documented in the skill and in `docs/plugin-api.md`.
- [ ] `npm run verify` is green.
