# 12: The Tutor can propose removing a Node

**What to build:** Since the Builder no longer proposes changes to the layers (roles-and-contract 11), nobody can propose removing a Node: the Tutor has `propose_node` (add) and `propose_change` (update) only. The core already supports a remove Proposal (`propose(..., "remove", ...)`) and the interface already draws and applies it. Give the Tutor a `propose_remove` tool, gated like the other two (refused until the person answered an `ask` about the same element), so that removing something the person no longer wants is a Proposal they accept, as adding is.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Tutor has `propose_remove` with the same `element` rule as `propose_node` and `propose_change`; the Proposal carries the Tutor as its source and the person's words.
- [ ] A Node that is the parent of another cannot be removed (the existing rule), and the refusal reaches the Tutor in plain words.
- [ ] The Builder still has no such tool (roles-and-contract 11 stays true).
- [ ] Tutor tool tests pass; `npm run verify` is green.

Source: consequence of roles-and-contract 11, 2026-11-06. Pattern groups have the same gap and are covered by layer-inference 06.
