# 11: Tutor and class mode

**What to build:** A second agent session, the Tutor, runs separately from the builder with its own instructions and without the person's personal plugins. In Class mode, when the builder reaches a Blocking decision (a new or changed Node on the first three layers, a technology choice, or a Pattern group), it pauses until the person answers a Tutor question in the right-hand panel. The person predicts or chooses among alternatives first; only then is the Rationale revealed and the builder resumed. In Direct mode nothing pauses. The person switches between modes. Code changes never block.

**Blocked by:** 08, 10

**Status:** superseded (see .scratch/tutor/spec.md and .scratch/tutor/issues)

- [ ] In Class mode, a Proposal for a first-three-layers Node pauses the builder until the Tutor question is answered.
- [ ] The Rationale is shown only after the person answers.
- [ ] In Direct mode the same Proposal arrives with no pause.
- [ ] A code change never triggers a pause in either mode.
- [ ] The Tutor session does not load the person's personal plugins and instructions.
