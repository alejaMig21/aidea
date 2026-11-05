# 03: Say why module pairs are hidden, and let the person see them

**What to build:** With the tests open the overview says "Showing the 400 strongest of 942 module pairs; 542 hidden" and nothing else. What is hidden is relationship lines between modules (a pair is every two modules that talk to each other), not modules; the person read it as missing components. Say what a pair is and why only 400 are drawn (to keep the drawing smooth, strongest first), and give a way to see the rest: a control to draw more, and the whole set of lines of a module when it is selected, so nothing is out of reach.

**Blocked by:** big-projects 02.

**Status:** ready-for-agent

- [ ] The note says in plain words that the hidden items are lines between modules, and why they are hidden.
- [ ] A control draws the hidden lines (all, or in steps); the cost is stated next to it.
- [ ] Selecting a module draws every line of that module, even those beyond the cap.
- [ ] The legend defines a pair and the cap; the language-neutral text test passes.

Source: the person's report of 2026-11-05 ("shows 400 of 900 and something components and does not explain why"). The code is `MAX_PAIRS` in `src/core/components-layout.ts` and the note in `src/ui/features/47-components.js`.
