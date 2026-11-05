# 03: The Plan: a map the person sees, with their go-ahead

**What to build:** The Tutor builds the Plan from the measurement and the goal: concepts with what they depend on, no cycles, without what the person already holds. It explains the approach in a few sentences and waits for the go-ahead before teaching. The Plan is a hypothesis: the Tutor adds missing foundations or removes known ones and says so; items keep their ids; progress is worked out from the conversation, never marked by the Tutor. The decisions of the layers leave the Plan (they belong to the plugins that own the layers).

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser; the real Tutor was not started)

- [x] No step begins before the person says to go ahead.
- [x] A revised Plan keeps the ids of items that stay, and the change is announced.
- [x] A cycle or an unknown dependency is refused with a message the Tutor can act on.
- Moved to tutor-rewrite 07 (the panel is rebuilt there): the Plan panel shows items, dependencies and the current one.
- [x] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.

## What was built (2026-11-05)

- `plan_ahead {summary}` (in `PLAN_TOOLS`): shows the person the Plan with the Tutor's explanation as a card "Your Plan" with "Go ahead" / "Change the Plan first" (no confidence row) and waits. "Go ahead" stores `approved` on the Plan; "Change" returns the person's words (`thought`) and keeps the gate closed.
- `begin_step` is refused while a stored Plan is not approved (after the checks of the item and of held ideas, so a step about the wrong thing is told so first). The class about aidea has no Plan and is not gated. A revised Plan starts unapproved unless it has the same concepts and dependencies as the approved one; a stored approved Plan needs no new go-ahead in a later session.
- Plan concepts now carry a permanent `id` (`c1`, `c2`...): a revised Plan keeps the id of an item of the same name, new items get a fresh one (`withIds` in `plan.ts`). `set_plan` returns the Plan and `changes` {added, removed, kept}; the `tutor_plan` event carries `changes` and the panel says what changed.
- Moved to other tickets: the Plan panel's view of items, dependencies and the current one is tutor-rewrite 07 (the panel is rebuilt there); the decisions per layer leave the Plan in tutor-rewrite 08.
- Tests: `test/plan-go-ahead.test.ts` (6); existing plan and held-ideas tests approve the Plan first. Instructions stay under 4000 characters.
- Live: `.scratch/tutor-rewrite/live-scripts/serve-fake-tutor.mjs` serves the real core and interface with a stand-in Tutor, opened in the person's browser on the main monitor (the Electron binary could not be restored tonight, see the journal): the measurement question "Question 1 of 12" appears in the Tutor panel, then the "Your Plan" card with Go ahead / Change the Plan first and no confidence row; choosing Go ahead lets the step begin. Page errors: none.
