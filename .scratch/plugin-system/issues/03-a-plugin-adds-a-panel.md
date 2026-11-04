# 03: A plugin adds a Panel

**What to build:** The Panel registry of the Layout becomes the first named slot. The interface half of a plugin is served to the window and adds a Panel that shows in the Panels menu, is drawn with the shared style, and disappears when the plugin is disabled. Adding to a slot that does not exist fails at activation.

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] The interface half of an active plugin is loaded by the window; a Panel it adds appears in the Panels menu and in the Layout.
- [x] Disabling the plugin removes the Panel and its menu entry at once, with no restart; a saved Layout that held it still restores.
- [x] A plugin that adds to an undeclared slot fails on activation with a clear reason and nothing of it stays on screen.
- [x] The existing Panels and their tests are unchanged.
- [x] Page tests pass; `npm run verify` is green.
