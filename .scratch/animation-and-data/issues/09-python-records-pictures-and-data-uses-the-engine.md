# 09: Python records pictures and Data uses the engine

**What to build:** The second delivery (spec decisions 7 and 4). The language plugin that runs a function (Python, `playback.py`) writes the recording of a run in the engine's format: a picture for each step, pieces with stable ids (`value`, `list`, `map`, `object`, with a pointer as an edge between two element ids). No translator is kept: the old recorded shapes go away. Data draws with the engine and what it draws today does not change (a box, a row of cells, keys pointing to values, objects with arrows, CHANGED / NEW / WAS, "Text", "Save image"). The limits stay as they are (spec decision 10).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A function played in Python records pictures of the new format with stable element ids.
- [ ] Data draws with the engine and shows what it showed before for the same functions.
- [ ] The tests that fixed the old recorded shapes (`playback-shapes`, `playback`, the Data page test and the ones that read the recording) are moved to the new format; the rest pass untouched.
- [ ] Steps, values, the 6 levels of depth, the 500 elements and the 2,000 steps behave as before.
- [ ] The TypeScript adapter and any other language plugin that records are told the new format in `docs/plugin-api.md`.
- [ ] Core API and page tests pass; `npm run verify` is green; verified live with a real Python function in the page.

Source: `.scratch/animation-and-data/spec.md`.
