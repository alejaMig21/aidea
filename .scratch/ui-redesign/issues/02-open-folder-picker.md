# 02: Open folder with the system folder picker

**What to build:** "Open folder" on Home shows the system's folder picker, so the person never types a path. The desktop shell provides the picker to the interface; the core never shows dialogs. Without the shell (plain browser, live tests) the typed path remains as fallback. The folder chosen is opened and lands in the recents.

**Blocked by:** 01

**Status:** done

- [ ] In the real desktop window, "Open folder" shows the folder picker and opens the chosen folder.
- [ ] Cancelling the picker changes nothing.
- [ ] In a plain browser, "Open folder" falls back to a typed path.
- [ ] The opened folder appears first in the recents.
- [ ] Checked live in the real window on the second monitor; result noted in the ticket.

## Review notes

Implemented: `electron/preload.cjs` exposes `window.aidea.pickFolder()` (contextIsolation on, no nodeIntegration); `electron/main.js` handles `pick-folder` with `dialog.showOpenDialog`; Home has an "Open folder" button that opens the chosen folder through the existing open route, or focuses the typed path box when `window.aidea` is absent.

Verified: `npm run typecheck` and `npm test` pass (no regressions). No criterion is verified live; none ticked.

Still needs the live check in the real window on the second monitor (`AIDEA_DISPLAY=secondary npm run desktop`): picker appears and opens the folder; cancel changes nothing; opened folder is first in recents; plain-browser fallback focuses the typed path box.
