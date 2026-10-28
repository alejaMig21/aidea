# 02: "Pause and step" only where it moves something

**What to build:** "Pause and step" in the header keeps pausing the animations on every layer. The text "Nothing moves here" is removed. The Previous hop and Next hop buttons, and their counter, appear only on the Algorithms layer when a Playback recording is shown, where they step through the real execution; on every other layer only the pause is left, with nothing disabled and unexplained next to it. Leaving that layer or the recording hides them again.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] On Business, Requirements, Architecture and Components, pausing shows no hop buttons, no counter and no "Nothing moves here" text; animations still stop and start again.
- [ ] On Algorithms with a recording, pausing shows Previous and Next, which step through the recording, with the counter ("Step n / m") as today.
- [ ] On Algorithms without a recording there are no hop buttons either.
- [ ] Switching layer while paused shows or hides the controls to match the layer shown, and stepping state is reset as today.
- [ ] Verified with a headless browser: screenshots of a paused authored layer and a paused Algorithms layer with a recording; no console errors.
