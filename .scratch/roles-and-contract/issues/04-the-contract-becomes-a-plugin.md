# 04: The Contract and the Differences become a plugin

**What to build:** The Contract and the Differences leave the core and the Tutor's panel for a plugin that ships with aidea, with its lesson, its read-only view and its named checks. The plugin offers Builders the tools to read the Contract (and later to report a task's status) through roles-and-contract 10, so the Builder reads it from the plugin and the Tutor and the Builders never talk to each other. With the plugin off there is no Contract and no condition. The Tutor's knowledge of them is removed in tutor-rewrite 08.

**Scope (decided 2026-11-05):** the move is complete, not a gate. The sections "Contract" and "Differences" leave the Tutor's panel for a Panel of the plugin; the dashed marks on the layers' boxes and their legend entries are drawn by the plugin through new interface slots; the "Ask me about it" button of a Difference opens a Tutor class from the plugin's Panel. The Tutor keeps nothing of them in its panel and reads the plugin only through its view and checks. The Contract stays a summary computed from the accepted layers (see the spec).

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (the Contract and the Differences are the plugin contract)

- [x] The Contract and the Differences work from the plugin with every existing test unchanged.
- [x] A Builder reads the Contract through a tool the plugin offers (`read_contract` moves out of the core's list).
- [x] With the plugin off there is no Contract and nothing conditions a Builder.
- [x] The plugin ships a lesson, a view and checks.
- [x] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/roles-and-contract/spec.md`, `.scratch/tutor-rewrite/spec.md` and ADR 0010.

## What was built (2026-11-05)

The Contract and the Differences are the plugin `contract` (`src/plugins/contract/`), shipped with aidea and on by default. The Contract stays a summary computed from the accepted layers (`contractOf`), as decided; the plugin stores nothing.

- **Builders:** the plugin offers `read_contract` (read-only, Builders only). With the plugin off the tool is gone, `/contract` and `/drift` answer 404, the Builder's session is not told about a Contract, and the Fix message does not mention it.
- **Tutor:** it reads the plugin through its view (the six checks and the Differences) and two checks (`check-met`, `no-differences`). The sections "Contract" and "Differences" are gone from its panel (`49-contract.js` and `53-drift.js` deleted); its Plan section stays.
- **Person:** a Panel "Contract" (checklist and Differences, with "Show on <layer>" and "Ask me about it"). It starts hidden in the Panels menu so the default window is unchanged.
- **Plugin API additions** (`docs/plugin-api.md`, `GET /plugins/inspect`): the slot `layer.marks` (marks on Nodes and the legend lines that explain them), `ui.on("project-drawn" | "proposals-changed")`, `ui.layers.show`, `ui.tutor.startClass`; agent tools get `{ project }` in `run`, may be `builders: true` (not offered to the Tutor), and a plugin that ships with aidea keeps the plain tool name and its answer is not wrapped as untrusted; `ctx.projects.get(id)` returns the open Project to plugins that ship with aidea only.
- **Kept in the core on purpose:** `contract.ts`, `drift.ts` and the routes `/contract` and `/drift` (tests and the protocol use them; the routes answer only while the plugin is active), and the guide parts about the Contract and the Differences (their text now points to the Contract panel; the Tutor stops knowing them in tutor-rewrite 08).
- **Not done:** the hard condition "what is not in the Contract is not developed" (a policy of the plugin, to be designed); approval and versions (roles-and-contract 05); tasks (06).

Tests: `test/contract-plugin.test.ts` (3); `legend-check` (page) still passes with the marks and legend lines coming from the plugin; no existing test was edited. `npm run verify`: 1037 pass, 0 fail. Looked at live in Chromium through Playwright (Panel, checklist, Difference, dashed mark); not looked at in Vivaldi or with the real Claude Code.
