# 15: The Builder proposes a plugin

**What to build:** Creator Mode, second half. The Builder writes a plugin into the quarantine and proposes installing it: the manager opens with the scan, and the person confirms there. A plugin can never install another plugin, and a plugin the Builder wrote gets no shortcut.

**Blocked by:** 06, 14.

**Status:** ready-for-agent

- [x] The Builder has a tool that adds a folder to the quarantine and proposes the install; it has no tool that installs.
- [x] The proposal opens the manager on that plugin with its report.
- [x] A fixture plugin that tries to call the install operation is refused.
- [x] Core API tests with a fake Builder pass; `npm run verify` is green.
