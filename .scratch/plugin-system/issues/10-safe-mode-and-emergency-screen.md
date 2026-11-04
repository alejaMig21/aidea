# 10: Safe mode and the emergency screen

**What to build:** aidea can start with every third-party plugin off. A minimal screen of the kernel, which depends on no plugin, lists plugins with their state and reason and can switch any of them off.

**Blocked by:** 07.

**Status:** ready-for-agent

- [x] A start option (and a control in the window) starts aidea in safe mode: no third-party plugin activates.
- [x] The emergency screen works when every plugin is broken or missing.
- [x] Switching a plugin off from it saves the choice for the next start.
- [x] Core API and page tests pass; `npm run verify` is green.

## Live check (2026-11-04)
Verified in the real Electron window on the primary screen with isolated data (script of the session, results and screenshots in `.scratch/plugin-system/live-shots/`, results.json: 16 of 16). The live run found one real defect that the tests had missed (a plugin that uses import/export failed when a package.json above the plugin store did not say "type": "module"); it is fixed and covered by tests.
