# 17: Plugin test tool

**What to build:** A small tool for plugin authors that boots the real kernel with a plugin, activates it, deactivates it, and checks every registry is back to its baseline, with contract tests for each plugin kind (Panel, guard rule).

**Blocked by:** 03, 11.

**Status:** ready-for-agent

- [x] The tool reports a leak when a fixture plugin forgets to undo something.
- [x] The Panel and guard-rule contract tests run against the built-in Terminal plugin and a fixture.
- [x] It is documented in the skill and in `docs/plugin-api.md`.
- [x] `npm run verify` is green.

Not verified live: it is a developer tool run from tests; the Terminal plugin passes it in the suite.
