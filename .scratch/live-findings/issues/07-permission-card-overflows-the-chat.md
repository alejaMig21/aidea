# 07: A permission card in the chat can overflow its column

**What to build:** In a live run on the second monitor (window 1264 px wide, chat about 270 px wide after the Canvas and the Tutor opened), a permission card in the Builder chat showed its buttons cut off ("Approve", "Reject" and a third control clipped at the right edge) and the chat got a horizontal scrollbar. A card must fit the chat at any width the chat can have, wrapping its buttons onto a second line instead of overflowing, and the chat must never show a horizontal scrollbar for it.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] At chat widths of 240, 270, 340 and 510 px a pending permission card, an answered one and one with a long request body show all their buttons and no horizontal scrollbar appears in the chat.
- [x] The card uses the shared scale (`docs/agents/ui-style.md`); nothing else in the chat changes.
- [x] Verified live (2026-11-04, Vivaldi through the Claude extension, real Claude Code, chat 254 px wide). The first run FOUND A BUG the earlier check had missed: the heading of the card, "Claude wants to use mcp__plugin_engram_engram__mem_search", is one word that cannot break, so the chat scrolled sideways (scroll width 332 on 254). Fixed with `overflow-wrap: anywhere` on `#chat-log .permission strong`; the same card in the same run then measured 254 on 254. Test added first and seen red: `test/permission-card-page.test.ts` (widths 240, 270, 340 and 510, three tool names, one of them 94 characters). No screenshot: the screenshot call timed out twice; the evidence is the measurements.
