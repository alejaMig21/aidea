# 05: Play runs a one-part recipe and its output shows in a terminal tab

**What to build:** With an accepted recipe of a single part, Play starts that part. The Terminal Panel gets one tab for it, showing its output as it arrives, whether the process is alive or has exited, and keeping its text after it exits or fails. Output keeps a bounded number of lines per tab and says when older lines were dropped. Nothing can be typed into the tab. Stop all in the top bar ends the part and its whole process tree, so no loose process or busy port remains. Play does not open the Terminal. "Running" means the process is alive. See `.scratch/run-and-terminal/spec.md` (stories 25, 29, 30, 36, 37, 39, 40, 41 and the Implementation Decisions on Output).

**Blocked by:** 03, 04.

**Status:** ready-for-agent

- [ ] Play starts the part in its folder; its lines appear in its tab while it runs.
- [ ] The tab shows alive, then exited with its code; the text stays.
- [ ] A very long output keeps the most recent lines and says older ones were dropped.
- [ ] Stop all ends a part that starts its own children, leaving no process and no listening port (checked with a test part that spawns a child and opens a port).
- [ ] Play with the Terminal hidden leaves it hidden.
- [ ] Core API tests with tiny real child processes and page tests for the tab pass.
- [ ] Verified live on the second monitor.
