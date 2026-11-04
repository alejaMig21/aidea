# 09: Closing aidea while the project runs

**What to build:** Closing the desktop window while Play has started parts asks first ("a project is running, close and stop it?"). Confirming stops everything aidea started and closes; cancelling keeps aidea open. Nothing is reconnected on the next launch: aidea does not look for processes of an earlier session. See `.scratch/run-and-terminal/spec.md` (stories 31 and 32).

**Blocked by:** 05.

**Status:** done; live in Electron on the second monitor (scratchpad live19/close.mjs)

- [x] With parts running, closing the window shows the question; cancel keeps everything running.
- [x] Confirming ends every part and its children before the app exits (no process and no busy port remain).
- [x] With nothing running, closing does not ask.
- [x] After a relaunch aidea shows no parts as running and starts none by itself.
- [x] Core API tests for the stop on close and a live check in the real Electron window on the second monitor pass.
