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
