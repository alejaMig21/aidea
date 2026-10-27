# 02: Open folder with the system folder picker

**What to build:** "Open folder" on Home shows the system's folder picker, so the person never types a path. The desktop shell provides the picker to the interface; the core never shows dialogs. Without the shell (plain browser, live tests) the typed path remains as fallback. The folder chosen is opened and lands in the recents.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] In the real desktop window, "Open folder" shows the folder picker and opens the chosen folder.
- [ ] Cancelling the picker changes nothing.
- [ ] In a plain browser, "Open folder" falls back to a typed path.
- [ ] The opened folder appears first in the recents.
- [ ] Checked live in the real window on the second monitor; result noted in the ticket.
