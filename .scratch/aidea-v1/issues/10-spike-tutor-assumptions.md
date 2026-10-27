# 10: Spike: verify what the tutor depends on

**What to build:** A short written report, saved next to the spec, that replaces three assumptions with facts. No product code is delivered.

**Blocked by:** 06

**Status:** ready-for-agent

Type: research

- [ ] Report states the exact way to launch the tutor session without the person's personal plugins and instructions while keeping their subscription login, with evidence from a real run.
- [ ] Report states how long Claude Code waits on a slow tool call from aidea's own tool server while a person answers, and what happens on timeout.
- [ ] Report states whether the streamed event format needed by the chat bar and the tutor is documented as stable, and which version of Claude Code was checked.
- [ ] Each finding names its source (documentation page or observed run).

## Findings already known (from ticket 07)

- A tool call from the builder to aidea's own MCP tool is dropped by Claude Code after about 61 seconds without an answer. Setting `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` to 10+ minutes made a late answer (over 100 seconds) work. The Tutor's blocking questions can use the same mechanism with the same settings. Still to verify: which of the two settings matters, and that the Tutor session (isolated from the person's plugins) keeps the login.
