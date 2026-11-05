# 15: The Builder proposes a plugin

**What to build:** Creator Mode, second half. The Builder writes a plugin into the quarantine and proposes installing it: the manager opens with the scan, and the person confirms there. A plugin can never install another plugin, and a plugin the Builder wrote gets no shortcut.

**Blocked by:** 06, 14.

**Status:** done (audit 2026-11-04: every box ticked, built and checked)

- [x] The Builder has a tool that adds a folder to the quarantine and proposes the install; it has no tool that installs.
- [x] The proposal opens the manager on that plugin with its report.
- [x] A fixture plugin that tries to call the install operation is refused.
- [x] Core API tests with a fake Builder pass; `npm run verify` is green.

Live check (2026-11-04, Electron, primary screen): the manager opened on a plugin proposed to the quarantine (the real Builder was not driven: a fake proposal event was used). Script: live-shots2/results.json (17 of 17).
