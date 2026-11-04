# 01: The Panel called Run becomes Playback

**What to build:** The Panel that runs one function with test data (the form for the data and the animation) is called Playback everywhere the person sees it: its title, its row in the Panels menu, the legend and help texts that name it, GLOSSARY.md (where the entry "Run" is replaced by "Playback" and "Run" is freed to mean running the whole project) and the "How aidea works" guide. The internal id stays, so a Layout saved before the rename still opens with the Panel in place. See `.scratch/run-and-terminal/spec.md` (stories 53 and 54).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The title of the Panel and its row in the Panels menu read "Playback".
- [ ] The test that guards the retired names is updated so that "Run" is no longer retired for the Panel and the old names for it are.
- [ ] A Layout saved before the rename restores with the Panel in the same place.
- [ ] GLOSSARY.md and the guide use "Playback" for the Panel and do not use "Run" for it.
- [ ] Page tests pass for the menu and the restore.
- [ ] Verified live on the second monitor.
