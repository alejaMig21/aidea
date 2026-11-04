# 07: Enable, disable and remove

**What to build:** The manager enables, disables and removes plugins with one set of status words (applied, failed, restart required). Removing a plugin asks whether to delete its data, keeping it by default. Changes to code that already ran ask for a restart with a "Restart aidea" button.

**Blocked by:** 06.

**Status:** ready-for-agent

- [x] Enable and disable apply live; removing a plugin that never ran in this session applies live.
- [x] Removing or updating a plugin whose code already ran reports restart required and shows the button.
- [x] Removal asks to delete the data, "keep" being the default; the data stays when kept.
- [x] A saved Layout survives the removal of a plugin whose Panel was in it.
- [x] Core API and page tests pass; `npm run verify` is green.

## Live check (2026-11-04)
Verified in the real Electron window on the primary screen with isolated data (script of the session, results and screenshots in `.scratch/plugin-system/live-shots/`, results.json: 16 of 16). The live run found one real defect that the tests had missed (a plugin that uses import/export failed when a package.json above the plugin store did not say "type": "module"); it is fixed and covered by tests.
