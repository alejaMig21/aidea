# 18: Panels are declared once in a registry and shown or hidden from one Panels menu

**What to build:** Today every Panel is wired by hand in about six places (a card and a separator in the page, a button in the header, a column of the grid, the layout's list of names, its minimum and default size, the saved state), so each new Panel costs a round of edits and a new header button; with five Panels the header already fills up. This ticket makes the number of Panels free. Every Panel (Builder, Files, Code, Canvas, Run, Tutor) is declared once in a registry with its id, title, icon, side, minimum size, default weight, whether it starts hidden and, when it depends on something (Run needs an open Flow), a way to say it is unavailable and why. The cards, separators, grid and sizes are produced from the registry, and the five existing Panels move onto it without changing what the person sees. The header has exactly one control for Panels, a "Panels" button that opens a menu listing every Panel with a check mark for shown or hidden; there are no per-Panel buttons in the header, so it does not grow with the number of Panels. A Panel that is unavailable is listed but disabled, with the reason. Adding a sixth Panel is one declaration plus its content.

**Decided with the person (2026-10-31):** one menu as the only control, no pinned buttons: with 12 of 15 Panels in use, pinned buttons would fill the header again.

**Blocked by:** None (can start immediately). It blocks 08: the docking layout needs the registry to exist.

**Status:** ready-for-agent

- [ ] The six existing Panels are declared in one registry and nothing else in the interface lists them by name (the layout, the menu, the grid and the saved layout read the registry); a test fails if a Panel is wired outside it.
- [ ] The header holds one "Panels" button and no per-Panel buttons; the menu lists every Panel with a check mark and shows or hides it, and the Canvas can be hidden from it as before.
- [ ] A Panel that is unavailable (Run with no Flow open) is listed, disabled, with the reason as text.
- [ ] Registering a seventh, empty Panel in the console adds a menu entry and a card without any other edit, and the header's controls stay the same (verified live and by a test on the page's shape).
- [ ] The menu works by keyboard (open, move, toggle with Space or Enter, Escape closes and returns the focus) and is labelled for screen readers; in a narrow window choosing a Panel opens its drawer.
- [ ] Saved layouts are keyed by Panel id: layouts saved before this ticket still load, and an id the registry no longer knows is ignored.
- [ ] Nothing the person saw before changes: same default arrangement, same sizes, auto-fold order, drawers and separators; verified live at 1920, 1280 and narrow, and the existing tests still pass.
