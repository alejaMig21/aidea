# 11: The Builder cannot propose changes to the layers

**What to build:** The Builder works from the Contract and does not change it, as a bricklayer works from the architect's plan and does not criticise it (decided by the person, 2026-11-06). The Builder loses the tools that propose changes to the authored layers (`propose_add_node`, `propose_update_node`, `propose_remove_node`, `propose_pattern_group`). Only the person, with the Tutor, changes the layers. When the Contract does not hold what the work needs, the Builder stops and says so in the chat, naming what is missing, so that the person decides; it does not decide alone and does not work around it. Its instructions (`BUILDER_INSTRUCTIONS`) and the message of "Fix" (`select.ts`) say this instead of "make a Proposal". The Tutor's way of making Proposals is not touched.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The four tools are not in the Builder's tool list nor in its allowed tools; a call to one answers that the Builder does not change the layers.
- [ ] The Builder's instructions and the "Fix" message tell it to stop and say in the chat what the Contract lacks, and never to make a Proposal on a layer.
- [ ] The Tutor still makes Proposals the person accepts (existing Tutor tests pass).
- [ ] Tests that fixed the old tool list and old texts are changed to the new rule; the rest pass untouched.
- [ ] `propose_plugin` and `propose_run_recipe` are not changed here (they are not layers); whether the Builder keeps them is decided apart.
- [ ] Core API tests pass; `npm run verify` is green.

Source: the person, 2026-11-06; `.scratch/roles-and-contract/spec.md` (the Builder reads the Contract and a departure from it goes through the person).
