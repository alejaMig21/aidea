# 10: A plugin can offer tools to the agents

**What to build:** The plugin API gets a way for a plugin to offer tools to the agents: a name, a plain sentence, an input shape and a function, declared from the host half. The kernel adds them to the tool set that a Builder (and, read-only, the Tutor) already receives from aidea, today written in the core (`routes/chat.ts`, `allowedTools`). A tool that would write in the Project is not offered this way: it makes a Proposal. A tool exists only while its plugin is active; the live inspection (`inspect`) lists the tools. Any Builder gets them, one made with Creator Mode included. `docs/plugin-api.md` describes it. It is what lets the Contract belong to a plugin and still be read by every Builder (roles-and-contract 04), and what lets the person start a Builder just by writing in its chat.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor)

- [x] A fixture plugin offers a tool; a fake Builder calls it and gets the answer; with the plugin off the tool is gone.
- [x] A tool that is read-only for the Tutor is refused to the Tutor if it writes.
- [x] A tool offered by a plugin goes through the same permission and Policy path as any other action (class and scope).
- [x] `inspect` and `docs/plugin-api.md` list the tools and the rule that a write is a Proposal.
- [x] All existing tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010 (decision 4).

## What was built (2026-11-05)

- `ctx.agents.tools.add({ name, description, inputSchema, readOnly?, run })` in the host half (`host.ts`): validated (name, description, schema, `run`), one name once, removed when the plugin is deactivated. The agents see `<plugin id>_<name>`.
- `routes/mcp.ts`: Builders list and call every tool of every active plugin; the Tutor lists and calls only the `readOnly` ones (a write tool is not offered and answers "Unknown tool"); `routes/chat.ts` adds them to the Builder's allowed tools. What a plugin returns reaches the agent as untrusted data, up to 20,000 characters.
- Guard rules see the action `{ kind: "agent-tool", tool, plugin, input }`; a deny (or an ask, until there is a card) stops it and it never runs. The class and scope of an action come with plugin-policies 01.
- `GET /plugins/inspect` lists `agentTools`; `docs/plugin-api.md` has "Tools for the agents". `read_contract` stays in the core until roles-and-contract 04 moves it into the Contract plugin.
- Live (main monitor): `.scratch/roles-and-contract/live-scripts/agent-tools.mjs`: in Electron's runtime a stand-in Builder gets both tools and calls them, a stand-in Tutor gets only the read-only one; the real window lists both in `inspect`.
