# 04: The Business layer is the nine-block canvas

**What to build:** The Business layer is drawn as the business model canvas in its canonical arrangement (spec: Business): Key Partners; Key Activities over Key Resources; Value Propositions; Customer Relationships over Channels; Customer Segments; Cost Structure and Revenue Streams across the bottom. Each Business Node is a sticky note inside the block named by its `block` field; empty blocks are still drawn and numbered; blocks grow to hold their notes. Notes are straight by default; on hover or keyboard focus a note lifts, becomes opaque and tilts by an angle that shrinks with its width (about 3 px at its ends, at most 1.8 degrees), above its neighbours, and reduce-motion disables the tilt. Value flows to the customers and money flows back from the customers to the revenue streams as two colours of packets along the canvas (illustrative, not data relationships), with a soft breathing of the blocks. The layer shows the credit line "Business Model Canvas by Strategyzer AG, licensed CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0/). Layout adapted for aidea." and its legend lists the blocks and what the layer does not show. The core owns the block positions and note placement.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Through the core protocol: the Business layer layout places the nine blocks in the canonical arrangement, an empty block is present, notes are placed inside their block without overlap, and the result is identical for the same input.
- [ ] A note whose `block` is not one of the nine is reported as an error as today.
- [ ] Accepting a Proposal that adds a Business Node shows it as a note in its block.
- [ ] Hover tilt works as described and never overlaps a neighbour for the widest note in the fixtures; straight when not hovered.
- [ ] The credit line is always visible on the layer; the legend opens from "?".
- [ ] Verified headless: screenshots next to the prototype's Business tab, differences listed in the review notes; tilt checked on the widest and a narrow note; no console errors.
