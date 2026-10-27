# 04: Trace links, focus zoom and broken links

**What to build:** Nodes on the authored layers can have Trace links to Nodes or code below. Zooming into a Node opens the layer below centered on that Node's Footprint; when the Footprint is spread over several places, the camera frames all of them and dims the rest. Zooming out returns to the Node the person came from. When a Trace link's target disappears from the code, it is marked as a Broken link. The core computes the camera framing; the interface only applies it.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [x] Zooming into a Node returns a framing centered on its Footprint.
- [x] A Footprint with several separate parts returns a framing that contains all of them and flags the rest as dimmed.
- [x] Zooming out returns to the originating Node.
- [x] Deleting a function in the fixture Project and refreshing marks the Trace links that pointed to it as Broken links.

## Notes from the review

- Implemented and merged; verified live. Trace links are a `traces` list of ids on each authored Node (hand-editable, validated on load), pointing only at the layer directly below. The core computes layouts, the framing, what to dim and the zoom-out trail; the interface only draws and applies them.
- Zoom is triggered by double-click plus a "Zoom out" button; wheel-driven continuous zoom is not built. Double-clicking a Node of the Components layer does nothing until the Algorithms layer exists (ticket 05).
- Known gaps: the zoom-out trail lives in the core's memory (reopening a Project clears it) and is not capped; edge geometry and the set of Nodes with a Broken link are still derived in the interface; links to lines of code, links from decisions, and broken-link detection after every recomputation are not built.
