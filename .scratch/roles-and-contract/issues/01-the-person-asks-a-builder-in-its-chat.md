# 01: The person asks a Builder for work by writing in its chat

**What to build:** The person starts a Builder by writing in its chat, for example "read the Contract and start with the first task". There is no Assignment card and no Send button: the person's own message is the action, and nothing else sends or starts anything (not the Tutor, not an automatic step). The Builder reads what it needs through the tools that plugins offer (roles-and-contract 10), and keeps its own permission mode and any Policy in force: a message never widens what a Builder may do. The composer may insert references (a Node, a Contract item, a lesson) as plain text the person can read and edit. This replaces the Assignment of ADR 0009 (decision 2); see ADR 0010.

**Blocked by:** roles-and-contract 10.

**Status:** ready-for-agent

- [ ] The person's message in the Builder's chat is the only way a Builder starts working on the Contract.
- [ ] No tool, role or setting of the Tutor can send a message to a Builder (a test searches the Tutor's tools for any way to).
- [ ] The composer can insert a reference to a Node or a Contract item as readable text.
- [ ] The Builder's permission mode is unchanged by what the person writes (a fake Builder proves it).
- [ ] Core API and page tests pass at 1920 and 1280 pixels.

Source: `.scratch/roles-and-contract/spec.md`, `.scratch/tutor-rewrite/spec.md` and ADR 0010 (decision 5).
