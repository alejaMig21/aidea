# 04: The Terminal becomes the first plugin

**What to build:** The Terminal Panel moves out of the Layout's own registry into a plugin that ships with aidea and uses the same API as an installed one. It behaves exactly as today.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] The Terminal is declared by a built-in plugin, not by the Layout code.
- [ ] Every test of `terminal-panel.test.ts` passes unchanged.
- [ ] Disabling or removing the plugin removes the Terminal and a saved Layout that held it still restores.
- [ ] `npm run verify` is green.
