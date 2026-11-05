# 02: The git versions plugin

**What to build:** Decided on 2026-11-04: the plugin shows the history and state of the repository and the Canvas at a past version. First version: the list of commits with the files each changed; the Canvas at a chosen commit, read-only (the layers read from git without touching the working folder); the current branch, a selector and an animated graph of all the branches; and the state of the working folder (changed, untracked and staged files, differences), shown only. Git actions come later, and so does comparing two versions (what changed in the Contract). The aim is to make Git understandable and entertaining.

**Blocked by:** animation-and-data 01, plugin-lessons 01, plugin-teaching 01.

**Status:** needs-info: a spec first; it also waits for the animation engine

- [ ] The spec is written and approved.
- [ ] The commit list and the Canvas at a commit work on a fixture repository without changing the working folder.
- [ ] The branches graph is drawn by the animation engine, not static.
- [ ] The working-folder state shows changed, untracked and staged files; nothing can be changed from the plugin.
- [ ] The plugin ships a lesson and a teaching surface.

Source: `.scratch/future/interviews-pending.md` topic 4.
