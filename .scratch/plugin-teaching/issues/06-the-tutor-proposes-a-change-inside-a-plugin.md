# 06: The Tutor can propose a change inside a plugin

**What to build:** When something has to change inside a plugin (for example a Node in the Canvas the Tutor suggests), the Tutor does not do it: it explains the change as a lesson and makes a Proposal, and the person accepts it, as with the authored layers. The plugin declares how an accepted Proposal is applied. The Tutor has no way to change anything directly (the principle of the Tutor as a whole: it teaches, the person acts).

**Blocked by:** tutor-rewrite 04.

**Status:** needs-info: how a plugin declares and applies an accepted Proposal, and how a Proposal for a plugin is shown

- [ ] The design of how a plugin applies an accepted Proposal is written in this ticket.
- [ ] A fixture plugin receives an accepted Proposal and changes its state; a rejected one changes nothing.
- [ ] The Tutor has no tool that changes a plugin without a Proposal (tested).
- [ ] Core API tests pass.

Source: `.scratch/plugin-teaching/spec.md`.
