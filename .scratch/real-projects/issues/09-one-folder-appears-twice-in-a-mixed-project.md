# 09: In a mixed project one folder appears twice

**What to build:** aidea's `src/core` holds TypeScript files and five Python files. The Python adapter names modules with dots (`src.core.analyze`) and the TypeScript adapter with slashes (`src/core/server`), so the overview draws two blocks for the same folder: `src/core` (TypeScript) and, a row below, a block that Fit cuts to `src/co...` (the Python ones, whose names show dotted in the tooltips). The same happens for each `test/fixtures/...` folder. Make the overview group modules by their folder on disk (`file` of the node), whatever the language, and show the module name the way the language writes it. Module ids stay as they are (ticket language-adapters 03 left the id collision question open; do not change ids here).

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] On the aidea repository `src/core` is one block holding the TypeScript modules and `analyze`, `effects`, `flow`, `playback`, `relations`.
- [ ] A Python-only or TypeScript-only project draws exactly as before.
- [ ] The tooltip of a module still shows its own language's name.
- [ ] Verified on a copy of the aidea repository at 1920 and 1280 pixels wide.
