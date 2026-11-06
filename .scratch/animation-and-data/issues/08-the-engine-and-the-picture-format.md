# 08: The engine and the picture format

**What to build:** The first delivery of the animation engine (spec: `.scratch/animation-and-data/spec.md`, decisions 3 to 6 and 9). The picture format (a step is a whole picture: pieces with stable ids, elements with stable ids), the registry of pieces (name, how it is drawn, how it writes itself as text; open to plugins through a slot of the plugin API), and the animation between one picture and the next (what appeared, moved or changed, found by comparing two pictures), at the speed of Playback and as a plain change when the Animations switch is off. "Text" and "Save image" are the engine's. Proved with one piece, the list, drawn by a fixture that is not Data.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-06 (the engine, the registry and the slot engine.piece, proved with the list)

- [x] A fixture hands the engine a recording of pictures with a list that gets elements added, moved and changed; the engine draws each step and the transition between two steps.
- [x] What changed is found by comparing two pictures (CHANGED, NEW and WAS in words as well as by look); the recording does not mark it.
- [x] A transition lasts a fraction of the Playback speed; with Animations off a step is a plain change; jumping to any step or going back needs no replay.
- [x] A piece is added through the registry, and the plugin API has a slot for it (documented in `docs/plugin-api.md`).
- [x] The text form and the saved image work for the list piece.
- [x] The note for a cut piece ("... and N more") is drawn by the engine.
- [x] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/animation-and-data/spec.md`.

## What was built (2026-11-06)

- `src/ui/features/59-engine.js`: `animEngine` with the registry of pieces (`pieces`), `mount(host, { speed, animated })` -> `{ show(recording, index), text(recording, index), svg() }`. The list piece ships in the same registry.
- NEW and CHANGED come from comparing step `i` with step `i - 1` through each piece's `elements(piece)`; a changed element also says `WAS <old>`. A piece with no earlier picture is drawn without marks.
- Motion: only one step forward animates (about 70% of the Playback speed, moves what moved and fades in what is new); Animations off, a jump or going back redraws the picture plainly, no replay.
- The slot `engine.piece` is declared in the same file, listed in `src/core/plugins/api.ts` and documented in `docs/plugin-api.md`; a kind that exists or an incomplete entry is refused.
- Tests: `test/engine-page.test.ts` + `test/engine-page.js` (a fixture that is not Data, in the real page). `npm run verify`: 1070 pass, 0 fail.
- Left for `an2`: the engine does not draw a piece's `name` as a label yet (it only writes it in the text form); Data needs the label, the Text and Save image buttons wired to `text()`/`svg()`, and `pb` speed / the Animations switch passed to `mount`.
