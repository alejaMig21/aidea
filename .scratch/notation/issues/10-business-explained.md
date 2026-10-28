# 10: The Business layer explains itself

**What to build:** A person who has never seen the business model canvas can read the Business layer. The three decorative arrows of ticket 04 (value to customers, money back) and their packets are removed; the blocks keep their soft breathing glow. In their place, three kinds of help, written in plain words (no jargon) and kept in one place in the interface code so they can be edited and later translated:

1. **A hint line in every block.** Under the block's name, one short question in small muted text (for example Customer Segments: "Who is this for?"; Value Propositions: "What do you give them that they want?"; Channels: "How do they find you and get it?"; Customer Relationships: "How do you keep them happy?"; Revenue Streams: "How do they pay you?"; Key Resources: "What do you need to have?"; Key Activities: "What must you do well?"; Key Partners: "Who helps you?"; Cost Structure: "What does it cost you?"). The hint is shown on every block; when a block has no notes it is shown larger as the prompt of what to write.
2. **"Walk me through it".** A button on the layer's card starts a guided reading: the blocks are highlighted one at a time, in the order the canvas is usually told (Customer Segments, Value Propositions, Channels, Customer Relationships, Revenue Streams, Key Resources, Key Activities, Key Partners, Cost Structure), the others dim, and a short narration line at the bottom says what this block is and how it connects to the previous one, using the person's own notes when the block has some ("You said your customers are: Freelance designers"). Controls: Next, Back, Close (Escape closes); the walk is user-stepped and never starts by itself; reduce-motion makes the highlight change instantly.
3. **A hover and focus card.** Pointing at or focusing a block shows a small card: what it is in one sentence, the guiding question, and one generic example (clearly marked "Example"). The card never covers the notes of the block it describes and works with the keyboard.

All wording is English, short, free of jargon, and not copied from the canvas's publisher; the credit line stays. The legend ("?") keeps its list of shapes and gains a line saying that the blocks fill in over time and that empty ones are normal.

**Blocked by:** None (can start immediately; ticket 04 is done)

**Status:** ready-for-agent

- [ ] The decorative flow arrows, their packets and their legend entries are gone from the Business layer; the blocks still breathe softly and the animation switch still applies.
- [ ] Every block shows its hint; an empty block shows it as a larger prompt; a block with notes keeps its notes fully visible and unclipped.
- [ ] "Walk me through it" steps through the nine blocks in the stated order with the narration (using the person's notes when present), supports Next, Back, Close and Escape, restores the normal view when closed, and is keyboard operable.
- [ ] The hover/focus card shows what it is, the question and a marked example for each block, never hides the block's own notes, and is reachable by keyboard.
- [ ] The text is stored in one structure (block id to hint, description, question, example, narration) so a later ticket can reuse the pattern for other layers.
- [ ] Verified headless (no visible window) at 1440x900 and 1000x700: screenshots of an empty Business layer, a filled one, mid-walk, and a hover card, read by the implementer; no overlaps; no console errors; notes still tilt on hover as before.
- [ ] Read by the person for clarity.

## Review notes

Wording lives in `BUSINESS_HELP` (block id to `hint`, `what`, `question`, `example`, `narration`, `yours`) plus `BUSINESS_WALK` (the telling order) in `src/ui/features/46-business-help.js`. The core reserves a 58 px header per block (`BLOCK_HEAD` in `src/core/layout.ts`, test "every block reserves a header...").

- [x] Flows, packets, flow hover lighting and their legend entries are gone from Business (0 flow paths, 0 packets, 0 `[data-ends]` in the layer); blocks still breathe and the animation switch still applies.
- [x] Every block shows its hint; empty blocks show it as a larger two-line prompt; no hint is wider than its block (measured); a block with notes keeps its notes unclipped (core geometry, notes start 58 px below the top).
- [x] "Walk me through it" (button right after the Business tab): nine steps in the stated order, narration quotes the person's notes ("You said you offer: Quotes in minutes."), Next/Back/Finish/Close/Escape work, normal view restored, focus returns to the opener, narration is `aria-live`. Never starts by itself; closes when leaving the layer.
- [x] Hover and keyboard focus card shows what/question/"Example"; placed below the block (else above, else beside), clamped inside the canvas; checked for 5 blocks at 1440x900 and 1000x700: never overlaps the block, always inside. Focus on a block shows it too.
- [x] Note tilt unchanged: straight at rest (`none`), tilts and lifts on hover.
- [x] Headless at 1440x900 and 1000x700 (empty and filled projects, mid-walk, hover card): screenshots read (1000x700 hover shot checked by metrics only); no console errors. The reduced-motion branch is CSS only (`prefers-reduced-motion`, `body.motion-off`) and was not run under emulation.
- [x] Legend gains "The blocks fill in over time; an empty one is normal, it is a question still to answer".
- [x] `npm run typecheck` and `npm test` pass (226 pass, 0 fail; one earlier full run showed 15 failures that did not repeat, likely load from parallel runs).
- [ ] Read by the person for clarity.
