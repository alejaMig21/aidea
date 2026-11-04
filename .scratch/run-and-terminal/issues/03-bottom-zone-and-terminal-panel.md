# 03: A bottom strip in the Layout with an empty Terminal Panel

**What to build:** The Layout learns a bottom zone, full width, below the other Panels. A new Terminal Panel is declared in the registry, has a row in the Panels menu, starts in the bottom strip, can be moved like any Panel, and the saved Layout remembers where it was left. For now it shows an empty state that says what it will show. It is built so that a second kind of tab can be added later without redoing the first. See `.scratch/run-and-terminal/spec.md` (stories 33, 34, 35 and 39).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] "Terminal" appears in the Panels menu with a check mark and shows or hides the Panel.
- [ ] When shown for the first time it sits in a full-width strip at the bottom of the window.
- [ ] The Panel can be moved elsewhere and moved back; a restart restores the place where it was left, including the bottom strip.
- [ ] A Layout saved before this ticket still restores, with the Terminal hidden.
- [ ] The default Layout loses as little Canvas height as possible when the Terminal is hidden (none).
- [ ] In a narrow window the bottom strip behaves like the other Panels.
- [ ] Page tests cover show, hide, place, move and restore.
- [ ] Verified live on the second monitor.
