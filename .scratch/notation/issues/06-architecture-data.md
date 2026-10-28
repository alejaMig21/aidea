# 06: Architecture Nodes gain kind, description and relations

**What to build:** Architecture Nodes gain optional `kind` (person, system, container, component), `description` (a short sentence) and `relations` (a list of `{to, label, technology?}` naming other Nodes of the layer). `parent` now means "is inside". A relation to a missing Node is dropped with an error naming the Node and the field, like other bad data; cycles in `parent` stay ignored. The builder's Proposals can set the new fields through the same validation, and the Rationale and Trace link behaviour are unchanged. Files without the new fields load exactly as before. The Rationale panel shows the new fields for the selected Node. This ticket changes data and validation only; the drawing comes in ticket 07, and the parent connector line of ticket 13 stays until then.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Through the core protocol: Nodes with `kind`, `description` and `relations` are accepted and returned by the authored-layer route; an unknown `kind`, a non-string `description`, a relation without `to` or `label`, or a relation to a missing Node is reported as an error naming the field and dropped; other Nodes of the file survive.
- [ ] Old files without the new fields load and render exactly as before; all earlier authored-layer tests pass unchanged.
- [ ] Proposals can add and change Nodes with the new fields; an invalid proposal is refused with the same messages; accepting writes the file in the existing format.
- [ ] The builder's tool descriptions mention the new fields.
- [ ] The Rationale panel shows kind, description and relations of the selected Node.
- [ ] `GLOSSARY.md` mentions Relationship on the Architecture layer if not already covered.

## Review notes

- [x] Protocol tests in `test/architecture-data.test.ts` (9, written failing first); full `npm test` 172 pass, `npm run typecheck` clean; earlier authored and proposal tests unchanged.
- [x] Per-field behaviour: an unknown `kind`, a bad `description` or a `relations` that is not an array drops the whole Node (like a bad `technology` or `parent`); a bad relation (not an object, no `to`, no `label`, non-string `technology`) or a relation to a missing Node drops only that relation and the Node survives. Errors name the field, with the original index (`"relations[1].label" ...`). Proposals refuse all of these with the same field messages (`Invalid node:` / `Invalid change:`), and also at accept time.
- [x] Relations may point at the Node itself. Removing a Node that others relate to is not refused: those relations are dropped on the next load with an error.
- [x] Tool descriptions mention `kind`, `description`, `relations` (NODE_HELP in `src/core/routes/mcp.ts`). Fixture `test/fixtures/studio-c4` (Designer, Web app, Quote database, external Mail service) added so `studio` stays untouched. GLOSSARY already defines Relationship.
- [ ] Rationale panel (kind, description, relations of the selected Node) is written but not looked at in a headless browser.
