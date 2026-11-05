# 01: Opening a big project is fast

**What to build:** Opening Telegram takes 5.2 s (`POST /projects`), and the whole time is the Python analysis (`src/core/analyze.py`, run for 5.95 s alone; it prints 5.5 MB of JSON). Profile (with the profiler's own overhead, so read the shares): `relations.find` about 50% (an `ast.walk` over every function), `playback.effects_of` about 20% (another `ast.walk` per function, 3,964 times, although the effects are needed only when Playback opens one function), the module and class visit about 24%. Make it fast in three steps, each measured: (1) walk each function once and share the walk between relations and effects; (2) compute effects only when a function is chosen for Playback; (3) keep the analysis of each file in a cache outside the Project (by path, size and modification time), so a second opening, or one after a small change, only reads the files that changed. Target: Telegram opens in under 2 s cold and under 0.5 s warm. Scope: this ticket makes the analysis itself fast; that opening never waits for it (a fingerprint first, the layers filling in) is layer-inference 01. Scope: this ticket makes the analysis itself fast; that opening never waits for it (a fingerprint first, the layers filling in) is layer-inference 01.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05, with one target not met: the cold opening is 3.1 s on Telegram, not 2 s; that part moved to big-projects 05

- [x] A timing test on a generated Project of about 200 modules and 4,000 functions fails if analysing takes more than 2.7 s (`test/analysis-cache.test.ts`; measured 1.7 to 2.0 s, the old code 3.1 s).
- [~] Telegram: cold 3.1 s of analysis and 3.8 s through the core (5.2 s before), warm 0.19 s through the core and 0.68 s in the real Electron window including drawing the overview. Warm met; cold NOT met (target 2 s): big-projects 05.
- [x] The Nodes, relationships, Resolution and problems are identical to before: the output was compared byte for byte with the old analyzer on the 20 fixtures, on Telegram and on a generated Project, and every existing test passes unedited.
- [x] Nothing is written inside the Project; the cache is `~/.aidea/cache/analysis/` (`AIDEA_CACHE_DIR`), one entry per Project path, written whole or not at all, and a damaged or unwritable cache is ignored (tests).
- [x] A file changed, added or removed changes the signature and the Project is analysed again (tests); the signature also holds the analyzer's own code, so a new aidea never reads an old entry.

Measured 2026-11-05 on the person's Telegram project (209 Python modules, 3,964 functions, 659 classes, 13,004 relationships), Windows, this machine. The TypeScript side (`typescript-adapter.ts`) was not measured.

## What was built (2026-11-05)

- `relations.py`: `children`, `walk` and `flatten` replace `ast.walk` and `ast.iter_child_nodes` (no generator layers, nodes with no fields skipped); each function is walked once and the list is shared by the relationships and the effects; each module is walked once and shared by the imports and the aliases. `playback.call_name` reads a dotted callee off the attributes instead of `ast.unparse`. The order of every walk that decides a result is kept.
- `analysis-cache.ts`: the whole analysis of a Project is kept by its path and a signature (`signature` of the adapter: the analyzer's four scripts and the path, size and time of each Python file). Only the Python adapter has a signature; a TypeScript or mixed Project is analysed every time.
- Live (Electron, second monitor): `.scratch/big-projects/live-scripts/open-fast.mjs`: first opening 3.1 s, second 0.7 s, Project folder untouched.

## Why the cold target was missed

What is left is parsing (0.8 s, in C), the walk of every function (about 1 s) and the resolution across files. Going lower means not holding the whole project as syntax trees in one process: extract the facts of each file (nodes, imports, calls) in worker processes, and resolve across files from the facts. That is big-projects 05.
