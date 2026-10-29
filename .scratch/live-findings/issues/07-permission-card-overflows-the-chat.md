# 07: A permission card in the chat can overflow its column

**What to build:** In a live run on the second monitor (window 1264 px wide, chat about 270 px wide after the Canvas and the Tutor opened), a permission card in the Builder chat showed its buttons cut off ("Approve", "Reject" and a third control clipped at the right edge) and the chat got a horizontal scrollbar. A card must fit the chat at any width the chat can have, wrapping its buttons onto a second line instead of overflowing, and the chat must never show a horizontal scrollbar for it.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] At chat widths of 240, 270, 340 and 510 px a pending permission card, an answered one and one with a long request body show all their buttons and no horizontal scrollbar appears in the chat.
- [ ] The card uses the shared scale (`docs/agents/ui-style.md`); nothing else in the chat changes.
- [ ] Verified live on the second monitor, with a screenshot.
