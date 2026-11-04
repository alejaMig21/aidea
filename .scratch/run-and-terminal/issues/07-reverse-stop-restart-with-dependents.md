# 07: Stop in reverse order, and restart one part with its dependents

**What to build:** Stop all ends the parts in the reverse of the start order (the front end first, the database last). Each terminal tab gets stop and restart buttons for its own part. Restarting a part also restarts everything that depends on it, in order, waiting for each ready signal; if one fails the usual failure rules of ticket 06 apply. See `.scratch/run-and-terminal/spec.md` (stories 27, 28 and 38).

**Blocked by:** 06.

**Status:** ready-for-agent

- [ ] Stop all ends parts in reverse dependency order (checked with parts that record the order in which they receive the stop).
- [ ] The stop button of a tab ends only that part; the restart button restarts it and its dependents in order, waiting for each ready signal.
- [ ] A failure while restarting follows the failure rules of ticket 06.
- [ ] Core API tests and page tests for the buttons pass.
- [ ] Verified live on the second monitor.
