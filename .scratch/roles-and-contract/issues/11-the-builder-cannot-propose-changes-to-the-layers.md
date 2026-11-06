# 11: The Builder cannot propose changes to the layers

**What to build:** The Builder works from the Contract and does not change it, as a bricklayer works from the architect's plan and does not criticise it (decided by the person, 2026-11-06). The Builder loses the tools that propose changes to the authored layers (`propose_add_node`, `propose_update_node`, `propose_remove_node`, `propose_pattern_group`). Only the person, with the Tutor, changes the layers. When the Contract does not hold what the work needs, the Builder stops and says so in the chat, naming what is missing, so that the person decides; it does not decide alone and does not work around it. Its instructions (`BUILDER_INSTRUCTIONS`) and the message of "Fix" (`select.ts`) say this instead of "make a Proposal". The Tutor's way of making Proposals is not touched.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-06 (the Builder cannot propose changes to the layers)

- [x] The four tools are not in the Builder's tool list nor in its allowed tools; a call to one answers that the Builder does not change the layers.
- [x] The Builder's instructions and the "Fix" message tell it to stop and say in the chat what the Contract lacks, and never to make a Proposal on a layer.
- [x] The Tutor still makes Proposals the person accepts (existing Tutor tests pass).
- [x] Tests that fixed the old tool list and old texts are changed to the new rule; the rest pass untouched.
- [x] `propose_plugin` and `propose_run_recipe` are not changed here (they are not layers); whether the Builder keeps them is decided apart.
- [x] Core API tests pass; `npm run verify` is green.

Source: the person, 2026-11-06; `.scratch/roles-and-contract/spec.md` (the Builder reads the Contract and a departure from it goes through the person).

## What was built (2026-11-06)

The Builder no longer proposes changes to the layers (decided by the person, 2026-11-06: the Builder is the bricklayer, the Contract is the architect's plan).

- **Tools:** `propose_add_node`, `propose_update_node`, `propose_remove_node` and `propose_pattern_group` are gone from the Builder's list and from its allowed tools. A call to one answers `The Builder does not change the layers... say in the chat exactly what is missing` and makes no Proposal. `propose_plugin` and `propose_run_recipe` are untouched (they are not layers).
- **Instructions:** `BUILDER_INSTRUCTIONS` and the "Fix" message tell the Builder to work from the Contract, take no decision it does not hold, and, when the Contract lacks something, stop, say in the chat exactly what is missing and wait. The guide's texts say the same and credit the Tutor with Proposals.
- **Kept:** `propose()` and `proposePattern()` are unchanged (the Tutor's tools use `propose()`), so the whole Proposal machinery (events, secrets, refusals, preview, apply) stays tested.
- **Tests:** a new `test/builder-no-layers.test.ts` proves the refusal. The tests that made Proposals through the Builder's tools now call `viaCore` (`test/helpers.ts`), which does what the Tutor's tools do (`propose()` and the stream events) in the shape of a tool result; `startCore`'s handle exposes `permissions`, `projects` and `proposals` for that. Nine tests that fixed the old tool list and texts were rewritten to the new rule (chat, proposals, pattern-groups, class-direct-removed, contract, fix-selection, architecture-data, requirements-kinds, tutor-reads).
- **Gap this opens:** nobody can propose removing a Node or a Pattern group now. The core supports both; the Tutor has no tool for them. New ticket roles-and-contract 12 (remove) and layer-inference 06 (Pattern groups by the Tutor).

`npm run verify`: 1047 pass, 0 fail.
