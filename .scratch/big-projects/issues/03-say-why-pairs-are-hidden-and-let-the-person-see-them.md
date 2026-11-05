# 03: Say why module pairs are hidden, and let the person see them

**What to build:** With the tests open the overview says "Showing the 400 strongest of 942 module pairs; 542 hidden" and nothing else. What is hidden is relationship lines between modules (a pair is every two modules that talk to each other), not modules; the person read it as missing components. Say what a pair is and why only 400 are drawn (to keep the drawing smooth, strongest first), and give a way to see the rest: a control to draw more, and the whole set of lines of a module when it is selected, so nothing is out of reach.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser on Telegram)

- [x] The note says in plain words that the hidden items are lines between modules, and why they are hidden.
- [x] A control draws the hidden lines (all, or in steps); the cost is stated next to it.
- [x] Selecting a module draws every line of that module, even those beyond the cap.
- [x] The legend defines a pair and the cap; the language-neutral text test passes.

Source: the person's report of 2026-11-05 ("shows 400 of 900 and something components and does not explain why"). The code is `MAX_PAIRS` in `src/core/components-layout.ts` and the note in `src/ui/features/47-components.js`.

## What was built (2026-11-05)

- The note of the overview says what is hidden: "Showing the 400 strongest of 942 module pairs. A pair is two modules that talk to each other, drawn as one line; 542 lines are not drawn so the picture stays smooth, strongest first." It offers "Draw 400 more" and "Draw all 942 (slower)" (and "Draw fewer" to go back), and tells the person that clicking a module draws every line it has. The legend's "not shown" entry defines a pair and the cap in the same words.
- Core (`components-layout.ts`, `routes/focus.ts`): the overview takes `maxPairs` (a number, or all) and `focus` (a module whose every line is drawn even beyond the cap); `GET /layout?...&pairs=<n|all>&focus=<module>`; a number below 50 is 50, junk is the default, a huge number is the whole set; the answer's `pairs` now has `cap`.
- UI (`47-components.js`): a click on a module box of the overview sets the focus (a second click clears it; a double click still opens the module; a note says "Every line of X is drawn" with a "clear" button); a different Project starts again at the default.
- Tests: `test/components-pairs.test.ts` (4): the default 400, steps and all, the focus beyond the cap, the route's clamping. Live (main monitor, the person's browser, Telegram): with its tests open the note read as above, "Draw 400 more" drew 800 lines, and a click on a module set the focus note; no page errors. The cost is stated as "slower" and was not measured for all 942 lines on screen; the window at 1280 pixels was not looked at.
