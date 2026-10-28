# 11: The Contract: the builder reads it, and how complete it is is shown

**What to build:** The accepted content of the Business, Requirements and Architecture layers is the Contract. A new builder tool, `read_contract`, returns it in a compact structured form (Business notes by block; requirements with kind, statement or story, criteria and measure; Architecture elements with kind, technology, description, containment and relationships; Rationale of each). The builder's instructions (added by the adapter to the session) say to read the Contract before building and to depart from it only through a Proposal. A core route returns the Contract and a completeness indicator derived from the layers, never blocking: checks such as customer segments and a value proposition exist, at least one functional and one non-functional requirement exist, at least one container exists, every requirement has criteria. The Tutor column shows the indicator as a plain checklist (what exists, what is missing, in words) even while the Tutor is not available.

**Blocked by:** None (can start immediately; it does not need the Tutor)

**Status:** ready-for-agent

- [ ] Through the protocol: the builder's MCP tool list contains `read_contract` and it returns the accepted layers of a fixture project in the stated shape, excluding pending Proposals.
- [ ] The builder's session receives the instruction to read the Contract first (asserted on the arguments given to the adapter) and a change to a layer by the builder is still a Proposal.
- [ ] The contract route returns the indicator checks with met or not and a plain-words detail for each; an empty project shows every check unmet; the studio fixtures show the expected results.
- [ ] The indicator never blocks anything: the builder and the person can proceed with an incomplete Contract.
- [ ] Verified with a headless browser: screenshot of the checklist in the Tutor column for an empty project and for a complete one; no console errors.
- [ ] `GLOSSARY.md` terms match (Contract).
