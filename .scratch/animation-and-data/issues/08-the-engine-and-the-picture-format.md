# 08: The engine and the picture format

**What to build:** The first delivery of the animation engine (spec: `.scratch/animation-and-data/spec.md`, decisions 3 to 6 and 9). The picture format (a step is a whole picture: pieces with stable ids, elements with stable ids), the registry of pieces (name, how it is drawn, how it writes itself as text; open to plugins through a slot of the plugin API), and the animation between one picture and the next (what appeared, moved or changed, found by comparing two pictures), at the speed of Playback and as a plain change when the Animations switch is off. "Text" and "Save image" are the engine's. Proved with one piece, the list, drawn by a fixture that is not Data.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A fixture hands the engine a recording of pictures with a list that gets elements added, moved and changed; the engine draws each step and the transition between two steps.
- [ ] What changed is found by comparing two pictures (CHANGED, NEW and WAS in words as well as by look); the recording does not mark it.
- [ ] A transition lasts a fraction of the Playback speed; with Animations off a step is a plain change; jumping to any step or going back needs no replay.
- [ ] A piece is added through the registry, and the plugin API has a slot for it (documented in `docs/plugin-api.md`).
- [ ] The text form and the saved image work for the list piece.
- [ ] The note for a cut piece ("... and N more") is drawn by the engine.
- [ ] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/animation-and-data/spec.md`.
