# 03: Files panel shows the folder hierarchy of the Project

**What to build:** A Files panel, hidden until asked for, shows the folders and files of the open Project as a tree that expands and collapses. Folders that are not the person's work (version-control data, dependency folders, caches, build output) are skipped. Files in a language aidea can analyse are marked apart from the rest. It works on any folder, even when no language is understood, and never writes to the Project. A new read-only core route supplies the tree.

**Blocked by:** 02 (Run panel and the Panel vocabulary).

**Status:** implemented (review pending)

## Verification notes (2026-10-31)

Core: `GET /files?project=` (new route module) returns nested folders and files, folders first, each group in alphabetical order without regard to case, paths relative to the Project with `/`. Ignored folders (`node_modules`, `venv`, `env`, `dist`, `build`, `site-packages`, `__pycache__`, `.git`, `.hg`, `.svn`, `.venv`, `.tox`, `.cache`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`) are listed with `ignored: true` and not walked; other hidden folders such as `.github` and `.claude` are opened. Decided: ignored folders are listed (the person sees they exist) rather than left out. A file in a language with an adapter carries `language` and `analysed: true`; any other file is plain. A folder with more than 1500 entries lists 1500 and says how many it left out (`truncated`); there is no limit on the whole tree (marked `ponytail:` in the route). Links to folders are not followed. 7 protocol tests in `test/files.test.ts`.

Interface: a Files panel, its own card with its own top-bar button and separator, hidden by default, left of the Canvas. The layout code now handles four side panes. The tree is asked for only while the panel is on screen (the core reads the whole folder to answer) and children are drawn the first time a folder opens. Files are not selectable yet: ticket 04 does that.

Live, in the real Electron window (visible, main monitor, widths by viewport), with a real mouse: hidden by default; shown it is a 240 px card between the Builder and the Canvas; folders open and close; the `flow` fixture lists three Python files with their language; on `D:\Projects\Telegram` (23 top-level entries) and `D:\Projects\hubstaff-automation` (36) the ignored folders appear in italics and closed; `git status --porcelain` of both was identical before and after (nothing written); a synthetic folder with 3200 files opens in 191 ms with 1503 rows and the line "1700 more entries are not shown"; at 1920 and 1280 no sideways overflow; at 700 px Files opens as a drawer; no page errors. Opening hubstaff-automation took 13 s, which is the Project analysis (known), not the tree. Not measured: a second monitor; the automatic fold of Files when five cards do not fit; keyboard navigation of the tree (folders are buttons, so Tab and Enter work; arrow keys do not move between rows); screen readers. With Files open at 1266 px the Canvas is 438 px and the layer tabs are cut ("Business" and "Components" clipped): ticket 11's problem, a little worse.

- [ ] The tree route returns nested folders and files for a fixture Project, skips the ignored folders, flags analysable files and handles a non-text file and an unsupported language.
- [ ] The route writes nothing (checked by comparing the fixture before and after).
- [ ] The Files panel can be shown and hidden, folders open and close, and a folder with thousands of entries stays smooth.
- [ ] Works on a folder with no understood language.
- [ ] Verified live, read-only, on the two real Projects named in the handoff (`git status` before and after is identical).
