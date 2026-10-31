# 11: The Layout works in a narrow window and by keyboard

**What to build:** In a narrow window the Panels fall back to drawers or tabs instead of becoming unreadable. Every Panel can be focused, shown, hidden and moved between with the keyboard, and the focus is always visible.

**Blocked by:** 08 (dockable Layout).

**Status:** ready-for-agent

- [ ] At the narrowest supported width no Panel is cut and the Canvas stays usable.
- [ ] Show, hide and move focus between Panels with documented keys; no key trap.
- [ ] The visible focus follows the interface style rules.
- [ ] The layer tabs all stay reachable at 1280 and below (the problem of the superseded clipped-tabs ticket), by shrinking or grouping, not by sideways scrolling.
- [ ] Verified live at 1920, 1280, 1100 and narrow.
