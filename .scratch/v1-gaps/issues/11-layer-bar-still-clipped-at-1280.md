# 11: The layer tabs still do not fit at 1280 px

**What to build:** Ticket 09 removed a rule that reserved 190 px beside the layer tabs, but at a window 1280 px wide the bar is 516 px wide against 618 px of tabs, so the last tab still scrolls sideways. At 1920 it fits. The six layer tabs must all be reachable without sideways scrolling at 1280 px and at the narrowest width where the Canvas is shown with both side panels open: make the tabs shrink (shorter padding on the shared scale, then abbreviations with the full name as tooltip) before they scroll, and keep the Problems button and the help button where they are.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] At 1280 and 1100 px wide, with the chat and the right panel open, all six tabs are visible and none is cut; at 1920 nothing changes.
- [ ] Sizes and colours stay on the shared scale (`docs/agents/ui-style.md`).
- [ ] Verified live on the second monitor, with a screenshot.
