# 03: Files panel shows the folder hierarchy of the Project

**What to build:** A Files panel, hidden until asked for, shows the folders and files of the open Project as a tree that expands and collapses. Folders that are not the person's work (version-control data, dependency folders, caches, build output) are listed as ignored and not opened (decided while building: listing them, closed and in italics, tells the person they exist without costing a walk; the first wording said "skipped"). Files in a language aidea can analyse are marked apart from the rest. It works on any folder, even when no language is understood, and never writes to the Project. A new read-only core route supplies the tree.

**Blocked by:** 02 (Run panel and the Panel vocabulary).

**Status:** resolved (commit b1ed8cd and the review fixes after it)

- [x] The tree route returns nested folders and files for a fixture Project, skips the ignored folders, flags analysable files and handles a non-text file and an unsupported language. (9 protocol tests; "skips" means listed as ignored and not walked.)
- [x] The route writes nothing (checked by comparing the fixture before and after).
- [x] The Files panel can be shown and hidden, folders open and close, and a folder with thousands of entries stays smooth.
- [x] Works on a folder with no understood language.
- [x] Verified live, read-only, on the two real Projects named in the handoff (`git status` before and after is identical).

## What was built

`GET /files?project=` (a new route module) returns nested folders and files, folders first, each group in alphabetical order without regard to case, paths relative to the Project with `/`. Ignored folders (`node_modules`, `venv`, `env`, `dist`, `build`, `site-packages`, `__pycache__`, `.git`, `.hg`, `.svn`, `.venv`, `.tox`, `.cache`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, compared without regard to case) are listed with `ignored: true` and not walked; other hidden folders such as `.github` and `.claude` are opened. A file in a language with an adapter carries `language` and `analysed: true`; any other file is plain. The walk is asynchronous. A folder lists at most 1500 entries and says how many it left out (`truncated`); the whole Project lists at most 5000, and the folders met after that are marked `unread`, not shown as empty. Links to folders are not followed.

The interface: a Files panel, its own card with its own top-bar button and separator, hidden by default, left of the Canvas; the layout code now handles four side panes. The tree is asked for only while the panel is on screen (or open as a drawer) and is not asked again by layout changes; children are drawn the first time a folder opens; a refresh keeps the scroll position and the focused row. It is an ARIA tree with one Tab stop and the keys Up, Down, Home, End, Right, Left, Enter and Space. Files are not selectable yet: ticket 04 does that.

## Review (fresh context, Standards and Spec separately) and what changed after it

Fixed: the tree could not scroll when taller than its card; the narrow drawer never loaded the tree; every layout change could start a new read; a failed read was retried on every layout change; the core walked synchronously with no limit on the whole tree (now asynchronous with a 5000-entry limit and an `unread` mark); only folders could be reached by keyboard (now a real tree); the Playback shortcuts of ticket 16 acted while Run was hidden, repeated while a key was held and fought with the tree's arrows (fixed in `60-playback.js`); `Node_Modules` was not recognised on Windows; the comparator never returned 0; the glossary now defines Files and the style guide has the tree's row height and indent. Left on purpose: open folders are forgotten when another Project is opened; Unity's `Library` and similar generated folders are not in the ignored list (the 5000 limit covers them).

## Measurements (real Electron window, visible, main monitor, widths by viewport)

Hidden by default; shown, a 240 px card between the Builder and the Canvas. On `D:\Projects\Telegram` (23 top-level entries) and `D:\Projects\hubstaff-automation` (36): ignored folders appear in italics and closed, and `git status --porcelain` of both was identical before and after. hubstaff-automation's tree is 1092 px tall in a 663 px card and scrolls (measured after the fix); opening the Project took 13 s, which is the Project analysis, not the tree. A synthetic folder with 3200 files opens in 191 ms with 1503 rows and the line "1700 more entries are not shown". Keyboard, measured after the fix: Down and Up move, Right opens a closed folder and enters an open one, Left closes it or goes to the parent, Enter toggles, End and Home jump, one Tab stop. Six window resizes made no request. At 700 px Files opens as a drawer and shows the tree (36 rows). At 1920 and 1280 nothing overflows sideways. No page errors. With Files open at 1266 px the Canvas is 438 px and the layer tabs are cut ("Business" and "Components" clipped): ticket 11's problem, a little worse.

Not measured: a second monitor; the automatic fold of Files when five cards do not fit (traced by hand in the review); screen readers; the 5000-entry limit on a real Project (only on a synthetic one in a test).
