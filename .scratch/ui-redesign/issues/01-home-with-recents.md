# 01: Home with recent projects

**What to build:** When aidea opens with no Project open, the person sees the Home screen: a title and the list of Recent projects, each with folder name, full path and when it was last opened. Choosing one opens it. The core remembers every Project opened (also through the existing open route) in a per-user location outside any Project: newest first, the same path never twice, capped at 20 (oldest drop off), a missing folder reported as unavailable and never deleted automatically, an entry can be forgotten without touching the folder, and the list survives a core restart. Opening by typed path stays as the fallback. With no recents, Home explains the ways to start. Adds "Recent project" and "Home" to `GLOSSARY.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Through the core protocol: opening a Project makes it appear first in the recents list.
- [ ] Reopening the same path moves it to the top without duplicating it.
- [ ] Order is last opened first; the 21st distinct Project drops the oldest.
- [ ] A recent whose folder no longer exists is listed as unavailable, not removed.
- [ ] Forgetting an entry removes only the entry; the folder on disk is untouched.
- [ ] Entries survive a core restart.
- [ ] A path that does not exist or is not a directory is refused when opened.
- [ ] Checked live: Home lists recents with name, path and last-opened time; choosing one opens it; empty state explains how to start.
- [ ] `GLOSSARY.md` defines "Recent project" and "Home".
