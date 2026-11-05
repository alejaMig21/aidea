# 07: A Builder works in a plan mode for each task

**What to build:** When a Builder takes a task or an Assignment it first works in the plan mode of its own agent (read, think, propose a plan) and edits only after the person approves the plan. Where the agent has a plan mode (Claude Code has one) it is used; where it does not, aidea holds the Builder back with a guard rule until the plan is approved.

**Blocked by:** roles-and-contract 06.

**Status:** wontfix (2026-11-05): the person chooses the mode of each Builder (Plan, accept edits, ...) and lives with the consequences. aidea never forces a plan mode on a task, and holds nobody back with a guard rule for it.

- [ ] A Builder given a task proposes a plan and cannot edit until the person approves (a fake Builder proves it).
- [ ] The person can approve, reject or ask for changes to the plan.
- [ ] With a Builder whose agent has no plan mode, the guard rule holds the edits and says why.
- [ ] Verified live with the real Claude Code in Vivaldi.

Source: `.scratch/roles-and-contract/spec.md`.
