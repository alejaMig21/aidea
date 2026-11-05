# 02: Python becomes a built-in plugin, on by default

**What to build:** `python-adapter.ts`, `python.ts` and the Python-side scripts (`analyze.py`, `playback.py`) move into a plugin that ships with aidea and is on by default. It can be turned off or removed like any shipped plugin. Behaviour does not change: every existing test passes untouched. Python is the default language, not a required one.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (Python is a built-in plugin)

- [x] The plugin loads at startup, on by default, and appears in the plugin manager with the capabilities it declares.
- [x] Every existing test passes without being edited.
- [x] Turning it off makes Python files show as not analysed (ticket 04 gives the message).
- [x] The plugin ships a lesson once plugin-lessons 01 exists.

## What was built (2026-11-05)

Python is now a plugin that ships with aidea: `src/plugins/python/` (manifest with `language`, capabilities `processes` and `files`, action `runs-program`; `main.js` calls `ctx.languages.provide(pythonAdapter)`; `lesson.json` with three parts). It is on by default and appears in the plugin manager. Switching it off makes Python files show as not analysed (`languages` lists Python with `analysed: false`, no nodes).

How the core hands Python over (`builtInPython` in `adapters.ts`, called by `startCore`):
- With the folder of shipped plugins (default), the core lets go of Python and the plugin owns the language.
- With `builtinPluginsDir: false` the core keeps Python built in, owned by `aidea`, so every test that opens a Python Project without shipped plugins is unchanged.
- `adapterFor` with no analysed language now returns an adapter that reads nothing (it used to fall back to Python).
- `registerAdapter` is now an override layer for tests and embedders: it wins over the plugin's adapter and survives plugins loading or unloading. `language-adapters.test.ts` needed this; no existing test was edited.
- `python` is also in the named-but-unread list, so a Project of `.py` files says "not analysed" when the plugin is off. Tie order in `detectLanguages` is fixed (Python, TypeScript, JavaScript, then the rest) because a plugin-owned Python would otherwise sort after them.

Deviation from the ticket text: the scripts (`analyze.py`, `playback.py`, ...) and `python.ts` / `python-adapter.ts` stay in `src/core`, because existing tests import them from there and the ticket requires every test unchanged. The plugin imports the adapter from `src/core`. Moving the files is a later, mechanical step once those tests are allowed to change.

Tests: `test/python-plugin.test.ts` (3). `npm run verify`: 1034 pass, 0 fail.
