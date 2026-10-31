# 14: The Data layer draws lists and dictionaries, in step with Flow

**What to build:** A Data layer sits next to Flow in the Layer bar. While a function is played, Data draws its variables: a list as a row of cells with positions, a dictionary as keys pointing to values, scalars as labelled boxes, a value that aidea cannot draw as a plain labelled box. What changed since the previous step is highlighted. Data, Flow, Run and the trace table all follow the one Playback position. Large values are cut at a stated limit. Data is derived from the code: nobody writes it and the Tutor proposes nothing on it. A language that cannot record values says so plainly. Its drawing rules and sizes come from the shared interface scale.

**Blocked by:** 01 (Flow name), 13 (structured values).

**Status:** ready-for-agent

- [ ] The layers list and help include Data with its fields (what it is, guiding question, example, order, elements); a test keeps interface copy and the help structure equal.
- [ ] Stepping Playback moves Flow and Data together; the changed value is highlighted.
- [ ] A 10,000 item list is cut with "N more hidden", and stays smooth.
- [ ] An unsupported language shows the plain statement, not an empty layer.
- [ ] Sizes and colours on the shared scale; verified live at 1920, 1280 and narrow with screenshots.
