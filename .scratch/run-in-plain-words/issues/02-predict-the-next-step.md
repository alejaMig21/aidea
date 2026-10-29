# 02: Predict before you step

**What to build:** Learning by watching is weak; predicting is strong, and the Tutor already works that way. Add an optional "Guess first" mode to stepping through a recording: before the next step runs, ask "After this step, what will `total` be?" with a few options (the real value and plausible others made from the values already seen), accept the answer and how sure the person is, then reveal the step and say whether the guess was right. The answers are Evidence of kind prediction about a run, never graph content, and never block the stepping (a "Skip" is always there).

**Blocked by:** run-in-plain-words 01.

**Status:** done

- [x] Through the protocol: a route records a run prediction as Evidence with the right shape, validated like other answers; the correct option is never sent to the interface before the guess.
- [x] The options are deterministic for a recording and always include the true value exactly once.
- [x] In the interface the mode is off by default, can be turned on and off while stepping, and works with the keyboard.
- [x] Verified in the real app on the main screen with a recording of a fixture function: guess right, guess wrong, skip.
