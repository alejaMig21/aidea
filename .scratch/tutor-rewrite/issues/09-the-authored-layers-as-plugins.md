# 09: The three authored layers as plugins (to decide)

**What to build:** The ADR moves only the Contract and the Differences out of the core. If the Tutor is to help build the layers by using plugins, the layers have to be plugins too, each with its lesson, its read-only view and its checks, and Proposals as the only way the Tutor changes them. The open point is whether to do it for the three authored layers, and how the Canvas draws a layer a plugin owns.

**Blocked by:** None (can start immediately).

**Status:** needs-info: the person decides whether the three authored layers become plugins

- [ ] The person decides and the decision is written in the spec and an ADR.
- [ ] If yes: each layer ships a lesson, a view and checks, and the existing layer tests pass unedited.
- [ ] The Tutor builds a layer only through Proposals the person accepts.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
