# 03: A bottom strip in the Layout with an empty Terminal Panel

**What to build:** The Layout learns a bottom zone, full width, below the other Panels. A new Terminal Panel is declared in the registry, has a row in the Panels menu, starts in the bottom strip, can be moved like any Panel, and the saved Layout remembers where it was left. For now it shows an empty state that says what it will show. It is built so that a second kind of tab can be added later without redoing the first. See `.scratch/run-and-terminal/spec.md` (stories 33, 34, 35 and 39).

**Blocked by:** None (can start immediately).

**Status:** done (audit 2026-11-04: every box ticked, built)

- [x] "Terminal" appears in the Panels menu with a check mark and shows or hides the Panel.
- [x] When shown for the first time it sits in a full-width strip at the bottom of the window.
- [x] The Panel can be moved elsewhere and moved back; a restart restores the place where it was left, including the bottom strip.
- [x] A Layout saved before this ticket still restores, with the Terminal hidden.
- [x] The default Layout loses as little Canvas height as possible when the Terminal is hidden (none).
- [x] In a narrow window the bottom strip behaves like the other Panels.
- [x] Page tests cover show, hide, place, move and restore.
- [x] Verified live on 2026-11-04 in the real Electron window (primary screen, the person has one monitor now): see `.scratch/plugin-system/live-shots/` (02-panels-menu, 03-terminal-bottom, 04-explain).
