# 04: The Business layer is the nine-block canvas

**What to build:** The Business layer is drawn as the business model canvas in its canonical arrangement (spec: Business): Key Partners; Key Activities over Key Resources; Value Propositions; Customer Relationships over Channels; Customer Segments; Cost Structure and Revenue Streams across the bottom. Each Business Node is a sticky note inside the block named by its `block` field; empty blocks are still drawn and numbered; blocks grow to hold their notes. Notes are straight by default; on hover or keyboard focus a note lifts, becomes opaque and tilts by an angle that shrinks with its width (about 3 px at its ends, at most 1.8 degrees), above its neighbours, and reduce-motion disables the tilt. Value flows to the customers and money flows back from the customers to the revenue streams as two colours of packets along the canvas (illustrative, not data relationships), with a soft breathing of the blocks. The layer shows the credit line "Business Model Canvas by Strategyzer AG, licensed CC BY-SA 3.0 (creativecommons.org/licenses/by-sa/3.0/). Layout adapted for aidea." and its legend lists the blocks and what the layer does not show. The core owns the block positions and note placement.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Through the core protocol: the Business layer layout places the nine blocks in the canonical arrangement, an empty block is present, notes are placed inside their block without overlap, and the result is identical for the same input.
- [x] A note whose `block` is not one of the nine is reported as an error as today.
- [x] Accepting a Proposal that adds a Business Node shows it as a note in its block.
- [x] Hover tilt works as described and never overlaps a neighbour for the widest note in the fixtures; straight when not hovered.
- [x] The credit line is always visible on the layer; the legend opens from "?".
- [x] Verified headless: screenshots next to the prototype's Business tab, differences listed in the review notes; tilt checked on the widest and a narrow note; no console errors.

## Review notes

Verified with test/business-canvas.test.ts (core protocol) and a headless Chrome script (1440x900 and 420x800) on a project with 19 notes; screenshot compared with the prototype Business tab.

- [x] Core layout (layoutBusiness in src/core/layout.ts, served by GET /layout?layer=business as rects (notes) plus blocks): canonical arrangement, empty blocks present, notes inside their block without overlap, blocks grow, same input gives the same result.
- [x] A note with an invalid block is still an error and is not placed.
- [x] A Proposal adding a Business Node previews inside its block (test). Drawn as a dashed outline with the title only; that drawing was not screenshotted.
- [x] Hover tilt measured: widest note (237 wide) 1.45deg, 216 wide 1.59deg, 232 wide 1.48deg, alternating sign; straight at rest and after leaving; opaque #41392f; lifted 2px. 3px at the ends, gap 8px, so no neighbour overlap.
- [x] Keyboard focus lifts, tilts and goes opaque. Animations off: no tilt (checked). The prefers-reduced-motion rule is in the CSS but was not checked under emulated reduced motion.
- [x] Credit line always visible on the layer; legend opens from "?" with blocks, sticky notes, both flows and not-shown items.
- [x] Value packets (accent) run Value Propositions to Customer Segments through Channels and Customer Relationships; money packets (amber) from Customer Segments down to Revenue Streams. Hovering a block or note lights the flows through its block.
- [x] No console errors besides the pre-existing /favicon.ico 404. typecheck and npm test pass (168 pass, 1 skipped).

Differences from the prototype: SVG instead of HTML, so "above neighbours" moves the hovered note to the end of the layer while hovered (no restack on keyboard focus). Block numbers follow the core order of the nine names, not the prototype telling order; no step mode. The block id stays "key partnerships", titled "Key Partners". Long titles wrap to two lines then ellipsis (tooltip has the full title). Flows run along the bottom strip of the blocks they cross, with small arrowheads. Blocks breathe all the time, not only the active one. First visit fits the canvas. Business legend is registered in 46-business.js, loaded after the kit.

## Review fixes

- Notes carry `data-node` (their Node id), so a double-click zooms along their Trace links and a Broken link marks them (`.bnote.has-broken`); `data-light` (the block) keeps the hover lighting of the block's flows. Verified headless on a Business fixture with one good and one broken trace.
- Hovering a note never lit the flows: the flow `data-ends` were space-separated while block ids contain spaces. Business flows now use `|` as separator and the kit reads either form (headless: 2 flows lit on hover).
- Broken-link marks were lost whenever a layer was redrawn (Requirements traces arriving, Architecture redraws); `markBroken()` re-applies them after each redraw.
- Credit line reads exactly "Business Model Canvas by Strategyzer AG, licensed CC BY-SA 3.0. Layout adapted for aidea." followed by a real link (`target="_blank" rel="noopener noreferrer"` to creativecommons.org/licenses/by-sa/3.0/). It has an opaque panel background, sits in a strip above the zoom control, and Fit leaves room for it (headless at 420 px wide: no overlap with blocks or notes, no horizontal scroll).
- `electron/main.js`: `setWindowOpenHandler` opens http(s) links with `shell.openExternal` and denies the window. Electron was not launched (no visible windows allowed in this pass), so this handler is untested.
