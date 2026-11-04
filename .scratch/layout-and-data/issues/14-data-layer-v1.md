# 14: The Data layer draws lists and dictionaries, in step with Flow

**What to build:** A Data layer sits next to Flow in the Layer bar. While a function is played, Data draws its variables: a list as a row of cells with positions, a dictionary as keys pointing to values, scalars as labelled boxes, a value that aidea cannot draw as a plain labelled box. What changed since the previous step is highlighted. Data, Flow, Run and the trace table all follow the one Playback position. Large values are cut at a stated limit. Data is derived from the code: nobody writes it and the Tutor proposes nothing on it. A language that cannot record values says so plainly. Its drawing rules and sizes come from the shared interface scale.

**Blocked by:** 01 (Flow name), 13 (structured values).

**Status:** done (built, tested, checked live in Electron on the main monitor 2026-11-04)

- [x] The layers list and help include Data with its fields (what it is, guiding question, example, order, elements); a test keeps interface copy and the help structure equal.
- [x] Stepping Playback moves Flow and Data together; the changed value is highlighted.
- [x] A 10,000 item list is cut with "N more hidden", and stays smooth.
- [x] An unsupported language shows the plain statement, not an empty layer.
- [x] Sizes and colours on the shared scale; verified live at 1920, 1280 and narrow with screenshots.

## Built

- Core: `data` in `LAYER_HELP` (what it is, the guiding question, an example, the order variable, list, dictionary, change, limit and an entry for each) and in `LAYER_CONCEPTS`; a class on Data is a class on a derived layer (no proposals). Tests: `test/layer-class.test.ts`, `test/flow-layer.test.ts`.
- Page: `src/ui/features/58-data.js`. The tab "Data" sits after Flow and is disabled until a function's Flow is open. It draws the shapes of the visit that Playback shows (`pbRecording`, `pbIndex`): a scalar as a box, a list as cells with their places above, a dictionary as key, arrow, value rows, an object as a titled box with its fields, a reference or a cut part as a box; `changed` variables get a heavier line and the word CHANGED. A part the core cut is a dashed cell "N more hidden" (the core cuts at 100 items). A recording without shapes says "This language does not record the values of a run for Data yet. Python functions do."; a budget that ran out says so. Flow, Data, the Playback panel and the trace table follow one position: `playbackLayer()` (50-algorithm.js) replaces the checks for the Flow layer in 60-playback, 48-stepmode, 48-trace-table and the refresh in 06-topbar. Fit leaves room for the trace table. Legend registered (`notationRegisterLegend("data", ...)`).
- Tests: `test/data-layer-page.test.ts`. Live: `.scratch/run-and-terminal/live-scripts/data.mjs`, captures in `14-shots/`.
- Not drawn yet (ticket 15): objects that point to other objects as nodes and arrows, trees, aliases.
