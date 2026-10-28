# 04: A test project that checks every legend against what is drawn

**What to build:** A small test project that holds one example of every kind of element each layer can show (every Business block with a note, a functional and a non-functional requirement with criteria, each kind of Architecture node with a relation and a Pattern group, classes with each visibility and relationship kind including an unresolved one, a function with each flowchart symbol). A test opens it, draws each layer and compares it with that layer's legend in both directions: every entry of the legend corresponds to something drawn, and every kind of shape or colour drawn has an entry in the legend or in its "not shown" list. The test names the layer and the entry when it fails.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] The test project is part of the repo's test fixtures and covers every element kind listed above.
- [ ] For each of the five layers, a legend entry with no matching drawn element makes the test fail, naming the layer and the entry.
- [ ] For each layer, a drawn kind of shape or colour with no legend entry or "not shown" line makes the test fail, naming it.
- [ ] The test passes on the current layers after ticket 03; if it finds a legend that is wrong, the legend is fixed in this ticket.
- [ ] Running the test needs no real model and no display (a headless browser or the protocol only).
