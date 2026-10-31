# 11: The Layout works in a narrow window and by keyboard

**What to build:** In a narrow window the Panels fall back to drawers or tabs instead of becoming unreadable. Every Panel can be focused, shown, hidden and moved between with the keyboard, and the focus is always visible.

**Blocked by:** 08 (dockable Layout).

**Status:** ready-for-agent

**Added by ADR 0007 (dockview-core):** the library's splitters are not focusable and its keyboard docking is in a package that is not used, so this ticket gives the splitters keyboard control and a way to move a Panel by keyboard, in our own code on top of the library.

- [ ] At the narrowest supported width no Panel is cut and the Canvas stays usable.
- [ ] Show, hide and move focus between Panels with documented keys; no key trap.
- [ ] The borders between Panels can be focused and moved with the arrow keys (they were, before the docking engine of ticket 08 replaced the fixed grid: `role=separator` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, 20 px a step); the library's own sashes are not focusable, so this is built on top of them.
- [ ] A Panel can be moved by keyboard (to the left or right of another, stacked, or into a tab group), not only with the mouse and the Panels menu.
- [ ] The tabs of a group are an ARIA tab list: arrow keys switch the tab shown, and the selected tab is announced.
- [ ] The order of Tab through the page follows the order on screen (with the library the order of the page's elements is not the order of the Panels on screen).
- [ ] The visible focus follows the interface style rules (the focus ring of the shared scale, also on the active group of the Canvas, which had a white outline).
- [ ] The layer tabs all stay reachable at 1280 and below (the problem of the superseded clipped-tabs ticket), by shrinking or grouping, not by sideways scrolling.
- [ ] Verified live at 1920, 1280, 1100 and narrow.
