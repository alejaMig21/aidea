# 11: The Layout works in a narrow window and by keyboard

**What to build:** In a narrow window the Panels fall back to drawers or tabs instead of becoming unreadable. Every Panel can be focused, shown, hidden and moved between with the keyboard, and the focus is always visible.

**Blocked by:** 08 (dockable Layout).

**Status:** done (built, tested, checked live in Electron on the second monitor with real keys, 2026-11-04)

**Added by ADR 0007 (dockview-core):** the library's splitters are not focusable and its keyboard docking is in a package that is not used, so this ticket gives the splitters keyboard control and a way to move a Panel by keyboard, in our own code on top of the library.

- [x] At the narrowest supported width no Panel is cut and the Canvas stays usable.
- [x] Show, hide and move focus between Panels with documented keys; no key trap.
- [x] The borders between Panels can be focused and moved with the arrow keys (they were, before the docking engine of ticket 08 replaced the fixed grid: `role=separator` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, 20 px a step); the library's own sashes are not focusable, so this is built on top of them.
- [x] A Panel can be moved by keyboard (to the left or right of another, stacked, or into a tab group), not only with the mouse and the Panels menu.
- [x] The tabs of a group are an ARIA tab list: arrow keys switch the tab shown, and the selected tab is announced.
- [x] The order of Tab through the page follows the order on screen (with the library the order of the page's elements is not the order of the Panels on screen).
- [x] The visible focus follows the interface style rules (the focus ring of the shared scale, also on the active group of the Canvas, which had a white outline).
- [x] The layer tabs all stay reachable at 1280 and below (the problem of the superseded clipped-tabs ticket), by shrinking or grouping, not by sideways scrolling.
- [x] Verified live at 1920, 1280, 1100 and narrow.

## Built

- `src/ui/features/09-layout-keys.js` on top of dockview-core 8.8.3, which already gives its tabs a tab list (role, aria-selected, one tab stop for each group) and its groups a region with a name: **F6 / Shift+F6** move between the Panels in screen order (the focus lands on the Panel's tab); **Tab / Shift+Tab** walk them in screen order (the library draws every tab first and the contents apart, so inside the dock the walk is rebuilt: tab, contents, border, next Panel; at either end the browser carries on); the **borders** are `role=separator` with a name ("Resize Builder and Canvas") and `aria-valuemin/max/now`, moved by **arrow keys** (20px, 100 with Shift, Home and End to the ends) as a synthetic pointer drag of the border, so only its two neighbours change (the library's `setSize` shares the difference among all the other groups); a Panel is moved with **Alt+Shift+Arrows** (to the other side of the Panel next to it) or **Alt+Shift+Enter** (into the tabs of its neighbour; never the Canvas, and nothing in tabs with it); every move is announced in a live region (`#layout-live`); the keys are written in the Panels menu.
- The layer tabs of the Canvas wrap onto a second row instead of scrolling sideways (index.html, `#layers`).
- Focus ring of the shared scale on tabs, groups and borders (accent, 2px, inside).
- Tests: `test/layout-keys-page.test.ts` (1100 px window). Live: `.scratch/run-and-terminal/live-scripts/keys.mjs` (real key presses, 9 of 9) and `widths.mjs` (1920, 1280, 1100, 900, 700: no Panel cut, no sideways scroll). Captures in `11-shots/`.
- Known limit: the least drawn size of a Panel at the edge of the window is 5px under the library's own number (it gives up part of its margin); the border values account for it.
