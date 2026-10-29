# 01: A mockup of the new Tutor column, for the person to approve

**What to build:** Before changing the real column, a throwaway prototype of the redesigned Tutor column (decisions in ticket 02), shown inside the real app so the person can judge it next to the real Builder and Canvas columns and see that it does not stand out from them. It has three states the person can switch between: at rest, in the middle of a class, and with the sections open. It uses no model and no real data (stub content), only the interface's own styles and the shared scale of `docs/agents/ui-style.md`. It lives on its own branch, `prototype/tutor-column`, and is never merged into the working branch; only its verdict goes into ticket 02.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The prototype branch exists and shows, on the real app and at full screen on the second monitor, the three states: at rest (topic field, "Start a class", one help line, the Probe link, Tutor model and review checkbox, three folded sections with a summary line each), mid-class (an answered review card, a step title, a prediction card with "Add what you thought" folded) and sections open (numbered Plan with dependencies and progress, Differences, Contract).
- [x] Direct / Class appears at the foot of the Builder column in the prototype, and the default widths are about Builder 380, Tutor 540 and Canvas the rest.
- [x] Captures of the three columns side by side, for each state, using only sizes and colours of the shared scale.
- [x] The person has looked at it and said what to change or that it is approved; the verdict is written in ticket 02.

## Review notes

- [x] The prototype is on the branch `prototype/tutor-column` (commit `470a130`, file `src/ui/features/99-prototype-tutor-column.js`), never merged. It runs inside the real app with stub content: `npm run desktop` or `npm run core` on that branch, and the bar at the bottom (or the arrow keys) switches the three states. It was shown at full screen on the second monitor next to the real Builder and Canvas.
- [x] Verdict of the person: "the mockup looks right" (approved without changes).
- NOT done: the prototype does not wire any behaviour (no folding memory, no real Probe link, no Direct/Class effect); the widths in it come from changing the layout state in memory.
