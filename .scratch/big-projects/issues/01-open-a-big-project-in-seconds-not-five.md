# 01: Opening a big project is fast

**What to build:** Opening Telegram takes 5.2 s (`POST /projects`), and the whole time is the Python analysis (`src/core/analyze.py`, run for 5.95 s alone; it prints 5.5 MB of JSON). Profile (with the profiler's own overhead, so read the shares): `relations.find` about 50% (an `ast.walk` over every function), `playback.effects_of` about 20% (another `ast.walk` per function, 3,964 times, although the effects are needed only when Playback opens one function), the module and class visit about 24%. Make it fast in three steps, each measured: (1) walk each function once and share the walk between relations and effects; (2) compute effects only when a function is chosen for Playback; (3) keep the analysis of each file in a cache outside the Project (by path, size and modification time), so a second opening, or one after a small change, only reads the files that changed. Target: Telegram opens in under 2 s cold and under 0.5 s warm. Scope: this ticket makes the analysis itself fast; that opening never waits for it (a fingerprint first, the layers filling in) is layer-inference 01. Scope: this ticket makes the analysis itself fast; that opening never waits for it (a fingerprint first, the layers filling in) is layer-inference 01.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A timing test on a generated Project of about 200 modules and 4,000 functions fails if opening it takes more than a stated budget (the budget is written in the test).
- [ ] Telegram opens in under 2 s cold and under 0.5 s warm, measured through `POST /projects`.
- [ ] The Nodes, relationships, Resolution and problems are identical to before for every existing fixture (every existing test passes unedited).
- [ ] Nothing is written inside the Project; the cache lives outside it and is dropped or rebuilt without harm if it is stale or damaged.
- [ ] A file changed on disk is re-read; a file removed leaves no Node behind (tested).

Measured 2026-11-05 on the person's Telegram project (209 Python modules, 3,964 functions, 659 classes, 13,004 relationships), Windows, this machine. The TypeScript side (`typescript-adapter.ts`) was not measured.
