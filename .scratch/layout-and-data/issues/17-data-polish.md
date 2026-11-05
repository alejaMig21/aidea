# 17: Data polish: zoom, text beside the drawing, export, named examples, Tutor

**What to build:** The person zooms and moves over a large drawing in Data, sees the text form of a value next to its drawing, and exports the drawing as an image. Run offers named examples for a list of numbers (empty, random, sorted, nearly sorted, many duplicates). The Tutor can point at a value or a step in Data when it asks for a prediction, and the layer help teaches how to read Data.

**Blocked by:** 14 (Data layer v1), 16 (Playback controls).

**Status:** built (zoom, text, export, named lists, the Tutor pointing at Data); the live check is open

- [x] Zoom and pan work on a large drawing and the frame can be reset. (The canvas already had wheel, drag, buttons and Fit; Fit also repeats by itself when a drawing grows. Page test: wheel zooms, Fit returns the same frame.)
- [x] The text form shown matches the drawing for the same step. ("Text" button: `name = value` from the step's own `locals`, cut at 100 characters.)
- [x] Export produces an image of the current drawing. ("Save image": standalone SVG with colours written out. Tested as a string; the download itself and the save dialog in Electron were not clicked through.)
- [x] The named examples fill the form correctly and run. (Empty, Random, Sorted, Nearly sorted, Many duplicates: ten numbers, offered for the first parameter that looks like a list of numbers: annotated `list[...]`, or unannotated with a list default or a name like arr, nums, items.)
- [x] The Tutor can reference a Data element in a prediction question (protocol test on the element tags). (`predict` takes an optional `point`: `{layer: "data", step, variable}`; `parsePoint` in `src/core/tutor.ts` refuses a bad one in plain words; the `tutor_question` event carries it; `window.dataUi.point` shows that step and marks the variable LOOK HERE, `clearPoint` runs when the card is answered. Tested: `test/teach-loop.test.ts` and `test/data-layer-page.test.ts`. The two lines in `50-tutor.js` that call it are not covered by a test of their own: the live check does.) (The part about Data teaching with its own help moved to `.scratch/plugin-lessons/spec.md`: every part of the app gets its lesson there.)
- [ ] Verified live.
