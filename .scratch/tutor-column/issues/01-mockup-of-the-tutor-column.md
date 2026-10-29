# 01: A mockup of the new Tutor column, for the person to approve

**What to build:** Before changing the real column, a throwaway prototype of the redesigned Tutor column (decisions in ticket 02), shown inside the real app so the person can judge it next to the real Builder and Canvas columns and see that it does not stand out from them. It has three states the person can switch between: at rest, in the middle of a class, and with the sections open. It uses no model and no real data (stub content), only the interface's own styles and the shared scale of `docs/agents/ui-style.md`. It lives on its own branch, `prototype/tutor-column`, and is never merged into the working branch; only its verdict goes into ticket 02.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [ ] The prototype branch exists and shows, on the real app and at full screen on the second monitor, the three states: at rest (topic field, "Start a class", one help line, the Probe link, Tutor model and review checkbox, three folded sections with a summary line each), mid-class (an answered review card, a step title, a prediction card with "Add what you thought" folded) and sections open (numbered Plan with dependencies and progress, Differences, Contract).
- [ ] Direct / Class appears at the foot of the Builder column in the prototype, and the default widths are about Builder 380, Tutor 540 and Canvas the rest.
- [ ] Captures of the three columns side by side, for each state, using only sizes and colours of the shared scale.
- [ ] The person has looked at it and said what to change or that it is approved; the verdict is written in ticket 02.
