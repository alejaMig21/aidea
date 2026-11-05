# 04: Another agent as a Provider (Codex, Kimi or DeepSeek)

**What to build:** A spike, then one Provider plugin for another agent, so the Tutor and the Builder are not tied to Claude Code. Check that the agent can be driven as a child process or over ACP, that it can call aidea's MCP tools and ask aidea for permission, and that a version can be pinned. Write the Provider for the first one.

**Blocked by:** roles-and-providers 01.

**Status:** needs-info: the person picks which agent first

- [ ] A spike report: how the chosen agent is driven, what it lacks, the version pinned.
- [ ] The Provider plugin passes the Tutor and Builder protocol tests with a fake.
- [ ] Verified live with the real agent in Vivaldi, with its quota or cost noted.

Source: `.scratch/future/ideas.md` and `.scratch/harness/research/02-deepseek-harness.md`.
