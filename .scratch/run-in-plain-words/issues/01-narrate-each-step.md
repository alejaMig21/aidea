# 01: Each step of a recording is told in plain words

**What to build:** Stepping through a Playback recording shows the variables, which is what a debugger does and what a person who is not an engineer finds hard to read. Next to the step controls, say in one plain sentence what just happened: which line ran, which variable changed and from what to what ("Line 12 ran: total went from 0 to 5"), and what the step decided ("the condition percent > 0 was true, so it took the first way"). The sentence is derived from the recording's data by the core or the interface; nothing is invented and nothing is asked of a model.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Through the protocol or a pure function with tests on recordings of the fixtures: for assignments, calls, branches, loops, returns and exceptions the sentence is the expected one, and for an unrecognised step the sentence says only the line and what changed.
- [x] The sentence appears for the current step while stepping, in the Algorithms column, in `--text` at 13.5px; it does not change the existing controls.
- [x] Values are shown as the program holds them, shortened with an ellipsis when long.
- [x] Verified in the real app on the main screen: record a run of a fixture function and read five steps in a row; the text is correct and helps.
