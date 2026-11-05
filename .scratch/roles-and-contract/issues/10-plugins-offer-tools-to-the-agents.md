# 10: A plugin can offer tools to the agents

**What to build:** The plugin API gets a way for a plugin to offer tools to the agents: a name, a plain sentence, an input shape and a function, declared from the host half. The kernel adds them to the tool set that a Builder (and, read-only, the Tutor) already receives from aidea, today written in the core (`routes/chat.ts`, `allowedTools`). A tool that would write in the Project is not offered this way: it makes a Proposal. A tool exists only while its plugin is active; the live inspection (`inspect`) lists the tools. Any Builder gets them, one made with Creator Mode included. `docs/plugin-api.md` describes it. It is what lets the Contract belong to a plugin and still be read by every Builder (roles-and-contract 04), and what lets the person start a Builder just by writing in its chat.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A fixture plugin offers a tool; a fake Builder calls it and gets the answer; with the plugin off the tool is gone.
- [ ] A tool that is read-only for the Tutor is refused to the Tutor if it writes.
- [ ] A tool offered by a plugin goes through the same permission and Policy path as any other action (class and scope).
- [ ] `inspect` and `docs/plugin-api.md` list the tools and the rule that a write is a Proposal.
- [ ] All existing tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010 (decision 4).
