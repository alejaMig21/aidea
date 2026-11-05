# 06: The Contract has tasks with status and owner

**What to build:** An approved Contract produces tasks from the Architecture AND from the Requirements (decided 2026-11-05). Architecture tasks come first: build each container or component with its technology, and make each declared relation between pieces work. A requirement task depends on the Architecture tasks of the pieces that realise it (its `traces`), so Builders work from the bottom up. The Business layer produces no task. Every task has a status (not started, in progress, done), an owner (a Builder instance) and, when Builders work in parallel, a branch. The Differences become the progress of the plan and the drift from it. A Builder takes a task, not the whole Contract.

**Blocked by:** roles-and-contract 05.

**Status:** ready-for-agent

- [ ] An approved Contract produces its tasks from the Architecture (pieces and relations) and from the requirements (with criteria taken from them); a requirement task is blocked by the tasks of the pieces that realise it.
- [ ] A Builder can take a task; the status and owner show in the section.
- [ ] The Differences show progress per task and per requirement.
- [ ] A task done without code that traces to it shows as a Difference (the existing rule, now per task).
- [ ] Core API and page tests pass.

Source: `.scratch/roles-and-contract/spec.md`.
