# 11: The Contract: the builder reads it, and how complete it is is shown

**What to build:** The accepted content of the Business, Requirements and Architecture layers is the Contract. A new builder tool, `read_contract`, returns it in a compact structured form (Business notes by block; requirements with kind, statement or story, criteria and measure; Architecture elements with kind, technology, description, containment and relationships; Rationale of each). The builder's instructions (added by the adapter to the session) say to read the Contract before building and to depart from it only through a Proposal. A core route returns the Contract and a completeness indicator derived from the layers, never blocking: checks such as customer segments and a value proposition exist, at least one functional and one non-functional requirement exist, at least one container exists, every requirement has criteria. The Tutor column shows the indicator as a plain checklist (what exists, what is missing, in words) even while the Tutor is not available.

**Blocked by:** None (can start immediately; it does not need the Tutor)

**Status:** done

- [ ] Through the protocol: the builder's MCP tool list contains `read_contract` and it returns the accepted layers of a fixture project in the stated shape, excluding pending Proposals.
- [ ] The builder's session receives the instruction to read the Contract first (asserted on the arguments given to the adapter) and a change to a layer by the builder is still a Proposal.
- [ ] The contract route returns the indicator checks with met or not and a plain-words detail for each; an empty project shows every check unmet; the studio fixtures show the expected results.
- [ ] The indicator never blocks anything: the builder and the person can proceed with an incomplete Contract.
- [ ] Verified with a headless browser: screenshot of the checklist in the Tutor column for an empty project and for a complete one; no console errors.
- [ ] `GLOSSARY.md` terms match (Contract).

## Review notes

- [x] Through the protocol: `read_contract` is in the builder tool list and returns the accepted layers (business by block, requirements, architecture with Rationale), excluding pending Proposals (test/contract.test.ts).
- [x] The builder session gets instructions through a new `instructions` argument of `Adapter.run` (Claude adapter: `--append-system-prompt`); asserted on the adapter arguments. Layer changes remain Proposals (the propose_* tools are unchanged; `read_contract` is pre-allowed because it writes nothing).
- [x] `GET /contract?project=` returns `{ layers, readiness: [{ id, met, text }] }` with six checks (customer segments, value proposition, functional requirement, non-functional requirement, criteria on every functional requirement, at least one container). Empty project: all unmet. Studio fixtures checked. A Node without an explicit `kind: "container"` does not count as a container.
- [x] Nothing blocks: the route only describes; no tool or route consults it.
- [x] Verified with a headless browser (Chrome, no window): checklist in the Tutor column for an empty project (all unmet) and a complete one (all met); no console errors. Screenshots deleted.
- [x] `GLOSSARY.md` Contract wording unchanged and consistent. Not verified: the card refreshing right after accepting a Proposal in the browser (it rides the same `draw` hook the Proposal flow already calls), and the drift part of the Contract (a later ticket).
