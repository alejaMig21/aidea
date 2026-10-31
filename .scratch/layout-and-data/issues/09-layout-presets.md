# 09: Layouts are saved as Presets

**What to build:** The person saves the current Layout as a named Preset, switches Presets in one click, renames and deletes their own, and resets to the default. aidea ships built-in Presets that cannot be deleted or overwritten: the default, the classic IDE arrangement (Files, Code, bottom area) and Canvas only. The current Layout and the Presets survive closing and reopening aidea. They are stored by the core in the per-user preferences store, never inside a Project folder. The person chooses whether a Layout is remembered per Project or shared.

**Blocked by:** 08 (the docking engine), 19 (the Layout as saved data that is restored safely).

**Status:** ready-for-agent

- [ ] Protocol tests: save, list, rename, delete, reset; built-ins cannot be deleted or overwritten; the data survives a restart of the core; isolated by the preferences-file setting.
- [ ] No file is written inside a Project folder.
- [ ] The classic IDE arrangement is a built-in Preset and is not the default.
- [ ] Per-Project versus shared memory of the Layout works as chosen.
- [ ] Verified live: save, close aidea, reopen, the Layout is back.
