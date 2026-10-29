# 02: "Pause and step" only where it moves something

**What to build:** "Pause and step" in the header keeps pausing the animations on every layer. The text "Nothing moves here" is removed. The Previous hop and Next hop buttons, and their counter, appear only on the Algorithms layer when a Playback recording is shown, where they step through the real execution; on every other layer only the pause is left, with nothing disabled and unexplained next to it. Leaving that layer or the recording hides them again.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] On Business, Requirements, Architecture and Components, pausing shows no hop buttons, no counter and no "Nothing moves here" text; animations still stop and start again.
- [x] On Algorithms with a recording, pausing shows Previous and Next, which step through the recording, with the counter ("Step n / m") as today.
- [x] On Algorithms without a recording there are no hop buttons either.
- [x] Switching layer while paused shows or hides the controls to match the layer shown, and stepping state is reset as today.
- [x] Verified with a headless browser: screenshots of a paused authored layer and a paused Algorithms layer with a recording; no console errors.

## Review notes

- [x] Only `src/ui/features/48-stepmode.js` changed. The hop machinery (stepping dot `#nt-hop`, edge highlight, `stepHop`, `stepEdges`, hop counter, "Nothing moves here") had no use left once hop buttons exist only for a recording, so it is deleted rather than hidden. Previous/Next/counter are shown only when paused and a recording is shown on Algorithms; the labels are "step" everywhere now.
- [x] Red first in headless Chrome (no window): before the change every paused layer showed Previous hop, Next hop and either "Hop 0 / n" with a moving dot or "Nothing moves here"; after it only "Resume live" shows on Business, Requirements, Architecture, Components and Algorithms without a recording, and "Step 1 / 3" with Previous/Next on Algorithms with a real recording of `__init__` (Next goes to "Step 2 / 3", the trace table follows). Going back to Components resets to "Pause and step". No console errors. 384 tests, 383 pass, 1 skipped; typecheck clean.
- [x] Code-review: the step controls now also refresh when a new function is opened (`algorithm-opened`), so a dropped recording cannot leave them showing.
- NOT done: no automated test of the interface (the check is a headless script outside the suite); the pause itself on authored layers is unchanged (it still freezes dashes, glow and packets via the existing animation switch); one full-suite run failed once with a "bad port" fetch error in `decision-classes.test.ts` (random port the browser fetch refuses, unrelated) and passed on rerun.
