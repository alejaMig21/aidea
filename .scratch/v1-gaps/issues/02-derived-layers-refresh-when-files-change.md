# 02: Derived layers refresh when files change on disk

**What to build:** User story 22: the Components, Algorithms and Code layers recompute when the person edits code by hand. Today they recompute only when the project is reopened. Recompute when the window regains focus (cheap) and give a visible Refresh control; do not add a file watcher.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Editing a file of an open project and returning to the window shows the change without reopening; Refresh does the same; a refresh while one is running does not start a second; the opening line (real-projects/04) shows while it runs; a failed refresh keeps the old drawing and says so in words. Verified live.
