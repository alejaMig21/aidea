# 07: Stop in reverse order, and restart one part with its dependents

**What to build:** Stop all ends the parts in the reverse of the start order (the front end first, the database last). Each terminal tab gets stop and restart buttons for its own part. Restarting a part also restarts everything that depends on it, in order, waiting for each ready signal; if one fails the usual failure rules of ticket 06 apply. See `.scratch/run-and-terminal/spec.md` (stories 27, 28 and 38).

**Blocked by:** 06.

**Status:** built; core tests exist (`test/plugin-run.test.ts`). Left open on purpose: no page test found for the Stop and Restart buttons (audit 2026-11-04)

- [x] Stop all ends parts in reverse dependency order (checked with parts that record the order in which they receive the stop).
- [x] The stop button of a tab ends only that part; the restart button restarts it and its dependents in order, waiting for each ready signal.
- [x] A failure while restarting follows the failure rules of ticket 06.
- [ ] Core API tests and page tests for the buttons pass.
- [x] Verified live on the second monitor.

Status note: Built as the Run plugin (src/plugins/run) with the Terminal plugin's tabs. Core tests: test/plugin-run.test.ts (13). Verified live on the second monitor (Electron, 11 of 11 checks). Not done: page tests for the top bar and the tabs beyond the live check, the Terminal-hidden-stays-hidden test, and (04) the authored-area guard still treats .aidea/run.json as any other file. Consent is kept in the Run plugin's data folder (not the preferences file), keyed by Project path, and the confirmation is the browser's own dialog for now.
