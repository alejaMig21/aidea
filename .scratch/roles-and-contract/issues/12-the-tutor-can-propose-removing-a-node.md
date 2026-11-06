# 12: The Tutor can propose removing a Node

**What to build:** Since the Builder no longer proposes changes to the layers (roles-and-contract 11), nobody can propose removing a Node: the Tutor has `propose_node` (add) and `propose_change` (update) only. The core already supports a remove Proposal (`propose(..., "remove", ...)`) and the interface already draws and applies it. Give the Tutor a `propose_remove` tool, gated like the other two (refused until the person answered an `ask` about the same element), so that removing something the person no longer wants is a Proposal they accept, as adding is.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-06 (the Tutor can propose removing a Node)

- [x] The Tutor has `propose_remove` with the same `element` rule as `propose_node` and `propose_change`; the Proposal carries the Tutor as its source and the person's words.
- [x] A Node that is the parent of another cannot be removed (the existing rule), and the refusal reaches the Tutor in plain words.
- [x] The Builder still has no such tool (roles-and-contract 11 stays true).
- [x] Tutor tool tests pass; `npm run verify` is green.

Source: consequence of roles-and-contract 11, 2026-11-06. Pattern groups have the same gap and are covered by layer-inference 06.

## What was built (2026-11-06)

The Tutor has a third authoring tool, `propose_remove { layer, id, element, because? }` (`tutor-authoring.ts`), next to `propose_node` and `propose_change`. It follows the same rules: refused until the person answered an `ask` tagged with the same `element` ("Ask the person about <element> first"), refused in a class about aidea itself, and refused for a Node that holds others (`Node "web-app" is the parent of "quote-db": remove or move that Node first`) or that does not exist. It goes through `propose(..., "remove", ...)`, so the Proposal carries the Tutor as its source and the person's words, and the interface already draws it and applies it when the person accepts.

The Builder still has no such tool (roles-and-contract 11). The layer class instructions (`layer-help.ts`) tell the Tutor to use it when the person says they no longer want something.

Tests: two in `test/co-authoring.test.ts` (asking first, the pending removal and its source, a parent and a missing Node refused, nothing removed before the person decides, accept removes, reject keeps); the three tests that fix the Tutor's exact tool list (teach-loop, tutor-session, co-authoring) and the guard test of tool names (tutor-reads) now include `propose_remove`. `npm run verify`: 1060 pass, 0 fail. No interface change, so no live look.

Pattern groups still have no author: they wait for layer-inference 06.
