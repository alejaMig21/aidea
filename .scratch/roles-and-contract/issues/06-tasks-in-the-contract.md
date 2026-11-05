# 06: The Contract has tasks with status and owner

**What to build:** Each requirement of an approved Contract becomes one or more tasks with a status (not started, in progress, done), an owner (a Builder instance) and, when Builders work in parallel, a branch. The Differences become the progress of the plan and the drift from it. A Builder takes a task, not the whole Contract.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] An approved Contract produces its tasks from the requirements, with criteria taken from them.
- [ ] A Builder can take a task; the status and owner show in the section.
- [ ] The Differences show progress per task and per requirement.
- [ ] A task done without code that traces to it shows as a Difference (the existing rule, now per task).
- [ ] Core API and page tests pass.

Source: `.scratch/roles-and-contract/spec.md`.
