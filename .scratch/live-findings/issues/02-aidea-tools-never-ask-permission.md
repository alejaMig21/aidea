# 02: The tools aidea gives the builder never ask the person for permission

**What to build:** `read_contract` is on the builder's list of allowed tools, yet in a live run with the builder in Plan mode a permission card appeared for `mcp__aidea__read_contract` (and another for Claude Code's own `ExitPlanMode`). A tool of aidea that only reads, or only creates a Proposal the person will decide anyway, should never interrupt the person with a permission card, in any permission mode. First find out why the card appeared and in which modes (Manual, Accept edits, Plan, Auto), then fix what aidea controls. What Claude Code asks for by itself (such as leaving Plan mode) is not aidea's to remove: if it cannot be avoided, the card should say in plain words what is being asked, and the finding goes in the ticket notes.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A written finding: for each permission mode, which aidea tools produce a permission card and which do not, checked against the real Claude Code (record the Claude Code version) and the arguments the core passes (`--allowedTools` and the permission prompt tool).
- [ ] Through the protocol: the arguments given to the adapter allow every aidea tool that only reads or only proposes, in every mode the adapter offers; a test fails if a new aidea tool is added to the builder's list without being allowed.
- [ ] Verified live with the real Claude Code on the second monitor in Manual and Plan mode: asking the builder to read the Contract and to propose a Node shows no permission card for aidea's own tools.
- [ ] If a card for something Claude Code asks by itself remains, its text says what it is in plain words and the notes say why it cannot be removed.
