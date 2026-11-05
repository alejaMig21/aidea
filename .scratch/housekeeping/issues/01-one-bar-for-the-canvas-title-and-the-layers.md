# 01: One bar for the Canvas title and the layer tabs

**What to build:** The Canvas has its own title bar and, below it, the floating bar of layer tabs: a double bar. The person decided on 2026-11-03 to merge them into one. The layer tabs keep wrapping instead of scrolling (layout-and-data 11), the Zoom controls and the help button stay where they are, and the Panel keeps its title for the Layout (tabs, focus, F6).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] One bar holds the Canvas title and the layer tabs; no second bar remains.
- [ ] The bar works at 1920, 1280 and narrow widths, and with the keyboard (Tab, F6).
- [ ] `docs/agents/ui-style.md` describes the merged bar; the legend and layer tests pass.
- [ ] Checked in Vivaldi with a screenshot at two widths.

Source: `.scratch/future/interviews-pending.md` section 7.
