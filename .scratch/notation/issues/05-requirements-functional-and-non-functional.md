# 05: Requirements: functional and non-functional

**What to build:** Requirements Nodes gain a `kind`: functional (default) or non-functional (spec: Requirements, confirmed by the person). A functional requirement keeps `as`, `want`, `so` and gains optional `criteria` (Given/When/Then lines). A non-functional requirement has a `statement`, a `quality` chosen from a short list of common qualities written in aidea's own words (performance, security, usability, reliability, maintainability, compatibility, portability, safety; nothing copied from a standard) and a measurable `measure`; `as`, `want` and `so` are not required for it. The layer shows the two kinds in two groups, story cards with their criteria as a checklist, non-functional cards with a quality tag and the measure. A packet travels from a functional requirement through its criteria to its trace links (code, or Architecture elements for non-functional requirements) in a loop; the legend lists the card types and omissions. The validation rules are shared with the builder's Proposals, so the builder can propose both kinds and their fields. Old files without `kind` load unchanged as functional. No "no implementation" warning is added.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Through the core protocol: a functional requirement with and without `criteria` is valid; a non-functional requirement without `as`/`want`/`so` is valid; a non-functional one without `statement`, an unknown `quality` or a missing `measure` is reported as an error naming the field and dropped, like other bad Nodes; old files still load.
- [ ] Proposals can add and change both kinds and the new fields, validated by the same rules.
- [ ] The layer groups requirements by kind and draws both card types; criteria are listed; quality and measure are shown.
- [ ] Trace links from a non-functional requirement to Architecture Nodes and from a functional one to code are drawn and carry packets.
- [ ] Glossary: functional requirement and non-functional requirement are added to `GLOSSARY.md`.
- [ ] Verified headless: screenshots next to the prototype's Requirements tab, differences listed in the review notes; no console errors.

## Review notes

Verified through the protocol (`test/requirements-kinds.test.ts`, 7 tests, fixture `test/fixtures/studio-requirements`) and with a headless Chrome script at 1440x900 against the core:

- [x] Functional with and without `criteria`, non-functional without `as`/`want`/`so`, old files without `kind` load; missing `statement`, unknown `quality`, empty `measure`, bad `kind`, bad `criteria` are dropped with an error naming the field.
- [x] Proposals (add and update) use the same `nodeProblem` rules; changing a requirement to non-functional without its fields is refused; the builder's tool description names `kind`, `criteria`, `statement`, `quality`, `measure`.
- [x] The core lays out Requirements in two columns (functional left, non-functional right, file order, card height grows with criteria); the UI draws both card types, the criteria checklist, quality tag and measure (`src/ui/features/46-requirements.js`).
- [x] Trace links: functional to code (also valid in `/traces` and `/focus`, which then zooms to Components), non-functional to Architecture only (a code target is reported broken). Packets sampled 700 ms apart moved ((573,480),(771,420) then (374,437),(776,456)); the broken link is grey dashed with no packet. No console errors besides the pre-existing `/favicon.ico` 404.
- [x] Legend registered (not shown: priorities, story maps, pass/fail, more than three trace targets). Glossary terms added.
- [x] `npm run typecheck` and `npm test` pass (170 pass, 1 skipped).

Differences from the prototype: the packet runs along a rail down the card's left edge, not through each criterion one by one; criteria show no pass/fail state; the story is a card with the criteria as a checklist inside it, not separate criterion cards; at most three trace chips per card; chips show the target id only (no file path or "derived" note); no step mode or quiz.
