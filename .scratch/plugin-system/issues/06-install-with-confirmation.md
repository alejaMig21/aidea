# 06: Install with a confirmation

**What to build:** A plugin manager screen in the window lists installed plugins and quarantined ones, shows the scan report, and installs after a confirmation that names each blocking finding. An install saves what was there and restores it if it fails; two installs never run at once.

**Blocked by:** 03, 05.

**Status:** done (audit 2026-11-04: every box ticked, built and checked)

- [x] The manager lists plugins and quarantine entries with their report; the screen says a scan lowers the risk and proves nothing.
- [x] A plugin with no blocking finding installs after one confirmation; one with blocking findings needs a confirmation that names each.
- [x] An install that fails restores the previous state; a second install waits or is refused while one runs.
- [x] A newly installed plugin is live at once (its Panel shows) with no restart.
- [x] Core API and page tests pass; `npm run verify` is green.

## Live check (2026-11-04)
Verified in the real Electron window on the primary screen with isolated data (script of the session, results and screenshots in `.scratch/plugin-system/live-shots/`, results.json: 16 of 16). The live run found one real defect that the tests had missed (a plugin that uses import/export failed when a package.json above the plugin store did not say "type": "module"); it is fixed and covered by tests.
