# 04: The Terminal becomes the first plugin

**What to build:** The Terminal Panel moves out of the Layout's own registry into a plugin that ships with aidea and uses the same API as an installed one. It behaves exactly as today.

**Blocked by:** 03.

**Status:** done (audit 2026-11-04: every box ticked, built and checked)

- [x] The Terminal is declared by a built-in plugin, not by the Layout code.
- [x] Every test of `terminal-panel.test.ts` passes unchanged.
- [x] Disabling or removing the plugin removes the Terminal and a saved Layout that held it still restores.
- [x] `npm run verify` is green.

## Live check (2026-11-04)
Verified in the real Electron window on the primary screen with isolated data (script of the session, results and screenshots in `.scratch/plugin-system/live-shots/`, results.json: 16 of 16). The live run found one real defect that the tests had missed (a plugin that uses import/export failed when a package.json above the plugin store did not say "type": "module"); it is fixed and covered by tests.
