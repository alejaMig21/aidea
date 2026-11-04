# 06: Install with a confirmation

**What to build:** A plugin manager screen in the window lists installed plugins and quarantined ones, shows the scan report, and installs after a confirmation that names each blocking finding. An install saves what was there and restores it if it fails; two installs never run at once.

**Blocked by:** 03, 05.

**Status:** ready-for-agent

- [ ] The manager lists plugins and quarantine entries with their report; the screen says a scan lowers the risk and proves nothing.
- [ ] A plugin with no blocking finding installs after one confirmation; one with blocking findings needs a confirmation that names each.
- [ ] An install that fails restores the previous state; a second install waits or is refused while one runs.
- [ ] A newly installed plugin is live at once (its Panel shows) with no restart.
- [ ] Core API and page tests pass; `npm run verify` is green.
