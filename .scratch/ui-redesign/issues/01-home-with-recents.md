# 01: Home with recent projects

**What to build:** When aidea opens with no Project open, the person sees the Home screen: a title and the list of Recent projects, each with folder name, full path and when it was last opened. Choosing one opens it. The core remembers every Project opened (also through the existing open route) in a per-user location outside any Project: newest first, the same path never twice, capped at 20 (oldest drop off), a missing folder reported as unavailable and never deleted automatically, an entry can be forgotten without touching the folder, and the list survives a core restart. Opening by typed path stays as the fallback. With no recents, Home explains the ways to start. Adds "Recent project" and "Home" to `GLOSSARY.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Through the core protocol: opening a Project makes it appear first in the recents list.
- [x] Reopening the same path moves it to the top without duplicating it.
- [x] Order is last opened first; the 21st distinct Project drops the oldest.
- [x] A recent whose folder no longer exists is listed as unavailable, not removed.
- [x] Forgetting an entry removes only the entry; the folder on disk is untouched.
- [x] Entries survive a core restart.
- [x] A path that does not exist or is not a directory is refused when opened.
- [ ] Checked live: Home lists recents with name, path and last-opened time; choosing one opens it; empty state explains how to start.
- [x] `GLOSSARY.md` defines "Recent project" and "Home".

## Review notes

- Tested automatically (`test/recents.test.ts`, through the core protocol, store in a temp dir): first/reopen/cap-20 ordering, unavailable entries kept, forget leaves the folder, restart survival, refusal of missing or non-directory paths. `GLOSSARY.md` entries added.
- NOT verified live (no running UI in this session): the "Checked live" criterion. Still to check by hand: Home lists name, path and last-opened time; clicking a recent opens it; unavailable entries are disabled with a Forget button; the empty state text shows with no recents; typed-path open still works and hides Home; existing canvas behaviour is unchanged.
- The core only persists recents when started with `recentsFile` (`src/core/main.ts` passes `~/.aidea/recents.json`, overridable with `AIDEA_RECENTS_FILE`); `startCore` without it keeps them in memory, so other tests never touch the real per-user directory.

## Review fixes

- Recents now normalise paths in the core (`path.resolve`; case-folded comparison on Windows only, the stored display path keeps its spelling), so `X`, `X/` and other spellings list one entry. Covered by a protocol test in `test/recents.test.ts`.
- Home text explains the two ways to start (Open folder, New project; typed path in a plain browser), and Forget shows on every recent entry (never touches the folder). UI changes are unverified live.
