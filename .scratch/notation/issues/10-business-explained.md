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
