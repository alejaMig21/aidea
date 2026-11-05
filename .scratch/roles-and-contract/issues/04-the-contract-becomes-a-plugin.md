# 04: The Contract and the Differences become a plugin

**What to build:** The Contract and the Differences leave the core and the Tutor's panel for a plugin that ships with aidea, with its lesson, its read-only view and its named checks. The plugin offers Builders the tools to read the Contract (and later to report a task's status) through roles-and-contract 10, so the Builder reads it from the plugin and the Tutor and the Builders never talk to each other. With the plugin off there is no Contract and no condition. The Tutor's knowledge of them is removed in tutor-rewrite 08.

**Blocked by:** plugin-teaching 02, roles-and-contract 10.

**Status:** ready-for-agent

- [ ] The Contract and the Differences work from the plugin with every existing test unchanged.
- [ ] A Builder reads the Contract through a tool the plugin offers (`read_contract` moves out of the core's list).
- [ ] With the plugin off there is no Contract and nothing conditions a Builder.
- [ ] The plugin ships a lesson, a view and checks.
- [ ] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/roles-and-contract/spec.md`, `.scratch/tutor-rewrite/spec.md` and ADR 0010.
