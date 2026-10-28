# 07: Permission cards

**What to build:** When the builder needs permission (to edit a file, run a command), aidea receives the request and shows a card in the chat bar with approve and reject. The person's existing permission rules are applied first, so only unresolved requests reach a card. The answer is returned to the builder.

**Blocked by:** 06

**Status:** done

- [x] A permission request from the builder reaches the interface as a pending card.
- [x] Approving lets the action run; rejecting denies it and the builder is told so.
- [x] A request already covered by the person's rules produces no card.

## Notes from the review

- Implemented and verified live with the real Claude Code: a request that needs permission shows a card (tool, file, full content or command); Approve runs it; Reject (with an optional reason) stops it and the builder is told; a read-only command such as `echo` shows no card because Claude Code approves it itself.
- **"Existing rules are applied first" is guaranteed by Claude Code, not by aidea**: it only calls the permission tool for requests its rules leave unresolved. No test of the core can show it, because the core never sees the rules; only the live run does.
- Mechanism: aidea serves a minimal MCP server (one tool, `approve`) at an address with a secret token per conversation, passed to Claude Code with `--mcp-config` and `--permission-prompt-tool`. The card carries a second secret that only the interface receives, so the builder cannot answer its own requests. At most 20 requests may wait at once.
- Findings from real runs: (1) Claude Code stops waiting for an unanswered permission request after about **61 seconds**; with `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` set to 30 minutes (now the adapter default) a late answer works. Which of the two settings is the effective one was not isolated. When Claude does stop waiting, the card expires. (2) Claude Code treats text in a rejection as untrusted: a bare reason was ignored and the builder retried, even through another tool (`Bash`), so the reason is worded as the person's own and the card shows the complete command.
- Known gaps: no "approve and remember" or editing of the input; cards do not survive a page reload (a reload ends the conversation); the card does not say which sub-agent asked; the token is visible in the process arguments of Claude Code (it only allows injecting a fake card, never answering one).
