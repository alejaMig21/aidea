# 06: Several parts start in order, wait for ready signals and stop on failure

**What to build:** Play starts the parts of a recipe in dependency order. A part starts when the parts it waits for are ready. A ready signal is one of: a port that answers, a line the part prints, a file that appears, a URL that answers. Each part has a time limit to become ready (a default of 60 seconds, adjustable in the recipe). When a part exceeds it, or exits before being ready, everything already started stops, Play shows which part failed and the last lines it wrote, says that opening the Terminal shows the errors in depth, and offers one action to open it; the failed part's tab keeps its text. Ready only gates the order; the state shown stays "alive". See `.scratch/run-and-terminal/spec.md` (stories 12 to 21, 26 and the Implementation Decisions on Start).

**Blocked by:** 05.

**Status:** built; core tests exist (`test/plugin-run.test.ts`). Left open on purpose: no test found for Play's failure message offering to open the Terminal (audit 2026-11-04)

- [x] A part with dependencies does not start until each dependency is ready by its own signal, for each of the four kinds of signal.
- [x] A part that never becomes ready is reported after its limit, naming the part and its last lines.
- [x] After a failure no process started by Play is left alive and no port stays busy.
- [x] A part that exits with an error before becoming ready is reported at once, not after the limit.
- [x] A cycle in the dependencies is refused when the recipe is accepted.
- [ ] Play's failure message offers to open the Terminal and does so on request.
- [x] Core API tests (order, each signal, limit, failure teardown) and page tests (the message and the action) pass.
- [x] Verified live on the second monitor.

Status note: Built as the Run plugin (src/plugins/run) with the Terminal plugin's tabs. Core tests: test/plugin-run.test.ts (13). Verified live on the second monitor (Electron, 11 of 11 checks). Not done: page tests for the top bar and the tabs beyond the live check, the Terminal-hidden-stays-hidden test, and (04) the authored-area guard still treats .aidea/run.json as any other file. Consent is kept in the Run plugin's data folder (not the preferences file), keyed by Project path, and the confirmation is the browser's own dialog for now.
