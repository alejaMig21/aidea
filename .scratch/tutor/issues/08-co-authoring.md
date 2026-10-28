# 08: Co-authoring: the person's words first, then a Proposal

**What to build:** In a layer class the Tutor asks, in plain words, what an element of the layer is (for example who the business is for), lets the person answer in their own words, and turns the answer into a Proposal through a Tutor tool (same Proposal mechanism and same validation as the builder's, so it appears pending and the person confirms). Only after the person has answered may the Tutor offer alternatives, as a question. The Tutor cannot create a Proposal before asking the question it belongs to. Proposals made by the Tutor are marked as coming from the Tutor.

**Blocked by:** 03, 05

**Status:** ready-for-agent

- [ ] Through the protocol with a scripted Tutor: a Proposal tool call is refused if no question about that element was answered first; after an answer it creates a pending Proposal validated by the same rules as the builder's (bad fields refused with the same messages).
- [ ] Accepting or rejecting works as for the builder's Proposals; the Proposal says it came from the Tutor.
- [ ] The Tutor has no way to change a Node except by a Proposal.
- [ ] The answer text is stored as Evidence and the accepted Node's Rationale can cite it.
- [ ] Verified with a headless browser: a Tutor Proposal appears with the dashed pending style on its layer.
