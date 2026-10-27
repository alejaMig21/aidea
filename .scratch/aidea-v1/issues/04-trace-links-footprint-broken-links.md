# 04: Trace links, focus zoom and broken links

**What to build:** Nodes on the authored layers can have Trace links to Nodes or code below. Zooming into a Node opens the layer below centered on that Node's Footprint; when the Footprint is spread over several places, the camera frames all of them and dims the rest. Zooming out returns to the Node the person came from. When a Trace link's target disappears from the code, it is marked as a Broken link. The core computes the camera framing; the interface only applies it.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Zooming into a Node returns a framing centered on its Footprint.
- [ ] A Footprint with several separate parts returns a framing that contains all of them and flags the rest as dimmed.
- [ ] Zooming out returns to the originating Node.
- [ ] Deleting a function in the fixture Project and refreshing marks the Trace links that pointed to it as Broken links.
