# 09: In a mixed project one folder appears twice

**What to build:** aidea's `src/core` holds TypeScript files and five Python files. The Python adapter names modules with dots (`src.core.analyze`) and the TypeScript adapter with slashes (`src/core/server`), so the overview draws two blocks for the same folder: `src/core` (TypeScript) and, a row below, a block that Fit cuts to `src/co...` (the Python ones, whose names show dotted in the tooltips). The same happens for each `test/fixtures/...` folder. Make the overview group modules by their folder on disk (`file` of the node), whatever the language, and show the module name the way the language writes it. Module ids stay as they are (ticket language-adapters 03 left the id collision question open; do not change ids here).

**Blocked by:** None.

**Status:** closed, not a bug (premise was wrong)

**Finding:** the overview already groups by `file` (`folderOf(m.file)` in `layoutComponentsOverview`), never by module name, so Python and TypeScript modules of one folder share one block. The "second `src/co...` block" is `src/core/adapter` (holds `claude.ts`), a real subfolder cut by Fit. On a copy of aidea, `folder:src/core` holds all 5 Python modules and the TypeScript ones. Nothing in the code changed; a regression test now pins the behaviour (`test/components-overview.test.ts`, "in a mixed project one folder is one block"). It passed on first run (no red), because the behaviour already existed.

- [x] On the aidea repository `src/core` is one block holding the TypeScript modules and `analyze`, `effects`, `flow`, `playback`, `relations`.
- [x] A Python-only or TypeScript-only project draws exactly as before (code untouched; existing overview tests pass).
- [x] The tooltip of a module still shows its own language's name (code untouched; the test checks the names stay `src.core.p0` and `src/core/t0`).
- [x] Verified on a copy of the aidea repository at 1920 and 1280 pixels wide (headless Chrome screenshots: one `src/core` block, a separate `src/core/adapter` block).
