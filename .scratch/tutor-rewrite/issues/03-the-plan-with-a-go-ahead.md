# 03: The Plan: a map the person sees, with their go-ahead

**What to build:** The Tutor builds the Plan from the measurement and the goal: concepts with what they depend on, no cycles, without what the person already holds. It explains the approach in a few sentences and waits for the go-ahead before teaching. The Plan is a hypothesis: the Tutor adds missing foundations or removes known ones and says so; items keep their ids; progress is worked out from the conversation, never marked by the Tutor. The decisions of the layers leave the Plan (they belong to the plugins that own the layers).

**Blocked by:** tutor-rewrite 02.

**Status:** ready-for-agent

- [ ] No step begins before the person says to go ahead.
- [ ] A revised Plan keeps the ids of items that stay, and the change is announced.
- [ ] A cycle or an unknown dependency is refused with a message the Tutor can act on.
- [ ] The Plan panel shows items, dependencies and the current one.
- [ ] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
