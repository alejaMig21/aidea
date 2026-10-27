# 08: Builder proposals

**What to build:** The core offers its own tool server to the builder. The builder creates or changes Nodes and Trace links on the authored layers only through these tools. Each change arrives as a highlighted Proposal on the Canvas that the person accepts or rejects; accepted changes are written to the authored files, rejected ones leave nothing behind. The builder cannot write those files directly.

**Blocked by:** 03, 06

**Status:** done

- [x] A builder tool call that adds a Node produces a pending Proposal and no change to the files.
- [x] Accepting writes the Node to the authored files; rejecting leaves them untouched.
- [x] Invalid tool input is rejected with a clear error and creates no Proposal.
- [x] The Proposal highlights the affected Nodes on the Canvas.

## Notes from the review

- Implemented and verified live with the real Claude Code: the builder calls `propose_add_node`, `propose_update_node`, `propose_remove_node` (and `list_proposals`) on aidea's MCP server; the Proposal appears highlighted on its layer (dashed outline for a new Node, thick outline for a change, red for a removal), the layer tab shows a count, and "Review" in the chat opens its details with Accept and Reject. Accept writes the file; Reject leaves it untouched.
- The Proposal tools write nothing, so they are pre-approved (`--allowedTools`) and show no permission card. Invalid input comes back to the builder as an error result (`isError`) with the reason and creates no Proposal.
- Who decides: the Proposal's answer secret travels only in the chat stream to the interface (kept in `sessionStorage`); `GET /proposals` and `list_proposals` never show it. A Proposal outlives the conversation, but only the interface that received it can decide it.
- **"The builder cannot write those files directly"**: Claude Code's own `Write`/`Edit`/`MultiEdit` on `.aidea/**` are denied with `--disallowedTools` (verified live: denied, no card, file unchanged). **Known gap: `Bash` can still write there**, gated only by a permission card. Closing it would need a sandbox or a broker rule that reads shell commands, not worth it now.
- Review findings fixed: `parent` is revalidated when accepting (a child whose parent proposal was rejected, an update to an unknown parent, removing a Node that is somebody's parent); the temporary file gets a random name written with `wx`, so a planted link cannot redirect the write; only ENOENT counts as "no `.aidea` folder yet"; the secret is compared in constant time.
- Decided not to do: validating Trace link targets (a link to a missing Node is a designed state, shown as a Broken link); evicting decided Proposals from memory (the list stays small and the builder reads it to learn what was decided); deriving the tool names from one list (judgement-call smell). The test for a link planted at the temporary file's old name is skipped on machines that cannot create file links.
- Known gaps: Proposals are lost when the core restarts; an `add` Proposal's place on the Canvas is the layout slot it will most likely take, not a promise.
