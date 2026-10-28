# 07: Plan: concepts in dependency order, and the questions stay inside it

**What to build:** After measuring, the Teacher builds a Plan for the Project: concepts to understand, in dependency order, and the open decisions of each layer. It is stored per person and per Project outside the repository, shown in the Tutor column as a readable list, and revised when the person asks for changes in the conversation (never edited by hand). The core enforces it: a predict or check question that is not about an item of the Plan is rejected with an error the model can act on. Items are not marked "done"; what the person has covered is derived from the Evidence and the graph.

**Blocked by:** 05, 06

**Status:** done

- [x] Through the protocol with a scripted Teacher: setting a plan with dependencies is stored and returned; a question about an item outside the plan is rejected; a revised plan replaces the old one and keeps what is still valid.
- [x] A plan with a cycle is rejected.
- [x] The covered part is derived from Evidence and graph, not stored.
- [x] The plan survives a core restart and lives outside the Project folder.
- [x] Verified with a headless browser: screenshot of the Plan in the Tutor column; no console errors.

## Review notes

- [x] `test/plan.test.ts` (9 tests, through the protocol with a scripted Teacher) written first and run RED, then green. Four existing tool-list assertions now include `get_plan`, `set_plan`. 352 tests, 351 pass, 1 skipped; typecheck clean.
- [x] `src/core/plan.ts`: tools `get_plan` (the stored Plan or null, plus stored Probe results per layer) and `set_plan {concepts:[{name, dependsOn, layer?}], decisions:[{layer, question}]}`; each call replaces the previous Plan. Rejected with model-readable text: cycle (named path), unknown dependency, duplicate name, bad layer, unknown field (e.g. `done`), empty list. Stored in `plans.jsonl` of the per-user folder (last line per Project wins).
- [x] The gate is on `begin_step {item}`: once a Plan exists, `item` is required and must be a Plan concept (case-insensitive), else the step is refused and no question reaches the person. Without a Plan no item is needed (the Plan never gates a first class). Questions of the step carry the item; Evidence gets `item`.
- [x] Covered is derived on every read (`coveredOf`): the concept is on the Learner graph (name or alias) or a check about it was answered correctly. `GET /tutor/plan?project=` returns `{plan, covered}`; the stream emits `tutor_plan`.
- [x] UI `src/ui/features/52-plan.js`: Plan card above the Contract in the Tutor column (concepts in dependency order, "needs ...", open decisions); no editing. Checked in headless Chrome with a scripted adapter: card visible, no overflow; the only console error is the pre-existing missing `/favicon.ico`. Screenshot deleted.
- NOT done: layer-class `element` questions (co-authoring) and decision classes are not gated by the Plan; open decisions have no "covered" state; the real Claude Code was not run, so how well the Teacher builds a Plan is unchecked.
