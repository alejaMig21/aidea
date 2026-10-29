# 14: Pattern groups on the Architecture layer

**What to build:** On the Architecture layer the person or the builder declares a Pattern group (for example a hexagonal architecture) as a set of Nodes each labelled with its role. aidea compares the group with the derived layers and reports violations (for example a domain module importing infrastructure) as differences in the Contract drift list and as a mark on the group. Declaring a Pattern group is a Blocking decision (ticket 10). The group is drawn on the Architecture layer as a labelled boundary, in the C4-style notation already used.

**Blocked by:** 11

**Status:** done

- [~] Through the protocol: a Pattern group is stored with the Architecture layer with validated roles; a violation fixture (a domain module importing an infrastructure module) is reported with the two Nodes and the rule.
- [~] A group with no violations reports none; a role pointing to a missing Node is reported as a problem like other bad data.
- [~] The builder can propose a group through a Proposal.
- [~] Verified with a headless browser: screenshot of a group with and without a violation.

## Review notes

- [x] Through the protocol (test/pattern-groups.test.ts): `patterns` is an optional list in `.aidea/architecture.json`, `{ id, name, kind, roles: [{ node, role }] }`, kinds and roles from `PATTERN_ROLES` (hexagonal: domain, port, adapter, infrastructure; layered: presentation, application, domain, data). `/authored` returns it as `layers.architecture.patterns` (absent when the file has none). Fixture `test/fixtures/hexagonal` (domain imports infra) reports one violation with the two Nodes, the rule and the evidence.
- [x] Mapping Node to code: only through the Node's `traces` to Components nodes (a trace to a class or function stands for its module). A Node with no traces to code is never reported. No name matching.
- [x] Rules: hexagonal, `domain` may not depend on `adapter` or `infrastructure`; layered, a lower layer may not depend on an upper one (roles listed top to bottom). Only `imports` and `calls` count. Violation: `{ type: "pattern", group, kind, from: {node, role}, to: {node, role}, rule, certainty: "certain" | "possible", evidence: [{ kind, from, to, name, resolution, line }] }`. Certainty is `certain` only when some evidence is resolved; an edge matched by name is `possible`.
- [x] Clean fixture (`hexagonal-clean`) reports none. A role pointing to a missing Node, an unknown role, an unknown kind, a non-list `patterns`, a group without id are problems in the existing `problems` list (field `patterns[i].roles[j].node` and so on); only the role or group concerned is dropped, Nodes are untouched.
- [x] Routes: `GET /patterns?project=` returns `{ violations }`; `GET /contract` now also returns the same list as `drift` (ticket 12 can reuse it).
- [x] Builder: tool `propose_pattern_group { group }` (group needs a rationale). It creates a pending Proposal on the architecture layer (`nodeId` `pattern:<id>`, `node` = the group, `blocking: true`); accepting writes the group into `patterns`. The `blocking` flag is only a mark: no class is implemented here (ticket 10). It adds no box to the Architecture preview.
- [x] Verified with a headless browser (Chrome, no window): group boundary with role tags on each member, red dashed arrow with tooltip for the violation fixture, no arrow for the clean one; no console errors. Screenshots deleted. Legend updated.
- [~] Not verified: the grey dashed "?" arrow in the browser (covered through the protocol only); a pending Pattern group Proposal is not drawn on the Canvas, only counted on the tab and listed in the builder chat card.
- Known limits: the boundary is one box around all members and can also cover a non-member Node placed between them; unresolved relationships have no target so they cannot be placed on a Node and are never reported; tests were written together with the implementation, not run red first.

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
