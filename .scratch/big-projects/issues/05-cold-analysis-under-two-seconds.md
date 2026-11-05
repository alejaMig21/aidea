# 05: The cold analysis of a big project takes under 2 seconds

**What to build:** big-projects 01 made Telegram open in 0.2 s when nothing changed and cut the first analysis from 5.2 s to 3.1 s, but the target was 2 s. What is left is the syntax trees of every file in one process. Change what the analysis keeps: each file is reduced to its facts (its Nodes, the imports it makes, and for each function the callees it names and how they are written), the extraction runs in worker processes in parallel, and the main process resolves across files from the facts, without trees. The same facts make the cache incremental: only a changed file is extracted again.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The output is byte for byte the same as the current analyzer on the 20 fixtures, on Telegram and on the generated Project of `test/analysis-cache.test.ts` (the way big-projects 01 checked it).
- [ ] Telegram analyses in under 2 s cold on this machine, measured through `POST /projects`.
- [ ] After a change to one file only that file is extracted again (a test counts the extractions).
- [ ] The cache keeps the facts of each file, outside the Project, and a damaged entry is ignored.
- [ ] Works on Windows, macOS and Linux (worker processes started the same way); `npm run verify` is green; verified live in Electron on the second monitor.

Source: `.scratch/big-projects/issues/01-open-a-big-project-in-seconds-not-five.md`.
