# 02: The tools aidea gives the builder never ask the person for permission

**What to build:** `read_contract` is on the builder's list of allowed tools, yet in a live run with the builder in Plan mode a permission card appeared for `mcp__aidea__read_contract` (and another for Claude Code's own `ExitPlanMode`). A tool of aidea that only reads, or only creates a Proposal the person will decide anyway, should never interrupt the person with a permission card, in any permission mode. First find out why the card appeared and in which modes (Manual, Accept edits, Plan, Auto), then fix what aidea controls. What Claude Code asks for by itself (such as leaving Plan mode) is not aidea's to remove: if it cannot be avoided, the card should say in plain words what is being asked, and the finding goes in the ticket notes.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A written finding: for each permission mode, which aidea tools produce a permission card and which do not, checked against the real Claude Code (record the Claude Code version) and the arguments the core passes (`--allowedTools` and the permission prompt tool).
- [x] Through the protocol: the arguments given to the adapter allow every aidea tool that only reads or only proposes, in every mode the adapter offers; a test fails if a new aidea tool is added to the builder's list without being allowed.
- [x] Verified live with the real Claude Code on the second monitor in Manual and Plan mode: asking the builder to read the Contract and to propose a Node shows no permission card for aidea's own tools.
- [x] If a card for something Claude Code asks by itself remains, its text says what it is in plain words and the notes say why it cannot be removed.

## Finding (Claude Code 2.1.312, real runs with haiku, overnight)

| Mode | `read_contract` / `list_proposals` | `propose_add_node` | Other cards seen |
|---|---|---|---|
| Manual (`default`) | no card | no card | the person's own plugin tool (`mem_search`), not aidea's |
| Accept edits | no card | not probed (same allow list) | none |
| Plan | **card before the fix**, none after | none expected (never reached: the plan was rejected by the probe) | `ExitPlanMode`, Claude Code's own request to leave Plan mode |

Cause: Plan mode asks for any MCP tool that does not declare `annotations.readOnlyHint: true`, even when the tool is in `--allowedTools`. Fix: the two reading tools declare it (`src/core/routes/mcp.ts`); `test/builder-tools-permission.test.ts` fails if a tool is listed without being pre-allowed, and if the reading tools lose the hint. Auto mode was not probed (needs a supported plan).

The `ExitPlanMode` card is Claude Code's own and cannot be removed by aidea; the card already shows the plan being approved.
