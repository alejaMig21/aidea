# 01: Open the person's two real projects and report what works

**What to build:** The person wants to work, with aidea, on two projects of their own (`D:\Projects\hubstaff-automation`, about 590 Python files, and `D:\Projects\Telegram`, about 210 Python files). Find out, read-only, how the first version copes with them: open each in the real app, look at every layer, time the analysis, and write down what works, what is slow or unreadable, and what is missing. Nothing is written inside those two folders (no `.aidea`, no edits, no recording of runs, no model session on them): only the core's analysis and the drawing are exercised. The result is a report in this ticket, and one new ticket for every gap that matters.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The report lists, for each project: how long opening takes, how many modules, classes, functions and relationships are found, how many relationships are unresolved, and whether the Components layer is readable at the default zoom and after Fit.
- [ ] Each layer (Business, Requirements, Architecture, Components, Algorithms for one function, Code) is opened for each project and what is shown is described honestly (empty authored layers are expected).
- [ ] Problems found (a layer that hangs, an unreadable canvas, a crash, a message that does not help) become tickets with a reproduction, in `.scratch/real-projects/issues/`.
- [ ] Verified in the real app on the main screen and with headless captures at 1920x1080 and 1280x800; the person's folders are unchanged afterwards (`git status` clean in each, if they are repositories).
