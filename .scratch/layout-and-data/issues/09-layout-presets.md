# 09: Layouts are saved as Presets

**What to build:** The person saves the current Layout as a named Preset, switches Presets in one click, renames and deletes their own, and resets to the default. aidea ships built-in Presets that cannot be deleted or overwritten: the default, the classic IDE arrangement (Files, Code, bottom area) and Canvas only. The current Layout and the Presets survive closing and reopening aidea. They are stored by the core in the per-user preferences store, never inside a Project folder. The person chooses whether a Layout is remembered per Project or shared.

**Blocked by:** 08 (the docking engine), 19 (the Layout as saved data that is restored safely).

**Status:** done (built, tested, checked live in Electron on the second monitor 2026-11-04)

- [x] Protocol tests: save, list, rename, delete, reset; built-ins cannot be deleted or overwritten; the data survives a restart of the core; isolated by the preferences-file setting.
- [x] No file is written inside a Project folder.
- [x] The classic IDE arrangement is a built-in Preset and is not the default.
- [x] Per-Project versus shared memory of the Layout works as chosen.
- [x] Verified live: save, close aidea, reopen, the Layout is back.

## Built

- Core: `src/core/presets.ts` (names of the three built-ins, `validPresets`, `validProjectLayouts`, `validLayoutScope`) and three new names for `PUT /ui/<name>` in `src/core/routes/ui.ts`: `presets` (the person's own, the whole set at each change; a built-in name, a repeated name in other letters, more than 20 and anything too large are refused), `layoutScope` ("shared" or "project") and `projectLayouts` (by Project path). Kept in the preferences file under `~ui`; nothing is written in a Project. The page is served with `<meta name="aidea-presets">` (the built-in names and the default).
- Page: `07-layout.js` gained `layoutCapture`, `layoutUse` and `layoutResetDock`; `08-layout-presets.js` adds the rows under the Panels in the menu (Default, Classic IDE, Canvas only, the person's own, "Save this layout as…", "Your layouts…" with Rename and Delete, "A layout for each Project"). Built-ins are only which Panels are wanted; the arrangement is the default one. `01-dialog.js` is now `dialogShow` with `dialogConfirm` and `dialogPrompt` made of it (stack of dialogs, Tab wraps, a button may keep the dialog open when a field is not good).
- Tests: `test/layout-presets.test.ts` (protocol), `test/layout-presets-page.test.ts`. Live: `.scratch/run-and-terminal/live-scripts/presets.mjs` 8 of 8; captures in `09-shots/`.
- Decision: "reset to the default" is the built-in Default. With the choice "a layout for each Project", a Project that has none yet starts from the layout on screen.
