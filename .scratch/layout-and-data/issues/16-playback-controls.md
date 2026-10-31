# 16: Playback can step back, change speed and be driven by keys

**What to build:** In Run, the person plays, pauses, steps forward and back, jumps to the start or the end and changes the speed, with keyboard shortcuts, as in visualgo.net. Flow and Data (once it exists) follow the same position.

**Blocked by:** 02 (Run panel).

**Status:** resolved (commit ad58d17, then a fix after the review: shortcuts now act only while Run is on screen, ignore a held key and stay out of the Files tree)

- [x] Step back and jump to start or end work on a recording of any length within the existing step limit.
- [x] Speed can be changed during play; the chosen speed is remembered.
- [x] Documented shortcuts for play or pause, step, and speed; no conflict with typing in the form fields.
- [x] Flow highlights the active step correctly after going backwards.
- [x] Verified live.

**Verification notes:** Already there: step back and forward, the slider, jump to start, play and pause. Added in `60-playback.js`: jump to end, a Speed choice (kept in localStorage, changeable while playing), and keys (Space, left and right arrows, Home, End, - and +) listed in the panel and in button titles; they do not act while a form field, select or button that uses the key has focus. No core change, so no new protocol test. Measured live (headless Chrome, in-process core, fixture `more.risky`, 12 steps) at 1920 and 1280 wide: keys step and jump, Flow marks the right step after going back (the step on screen matched the recording position and the visited set shrank), speed `-` while playing took effect and was remembered after a reload, typing in a field did not move Playback, no page errors. Not measured: a recording near the step limit, screen readers, other browsers.
