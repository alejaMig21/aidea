# 01: Open the person's two real projects and report what works

**What to build:** The person wants to work, with aidea, on two projects of their own (`D:\Projects\hubstaff-automation`, about 590 Python files, and `D:\Projects\Telegram`, about 210 Python files). Find out, read-only, how the first version copes with them: open each in the real app, look at every layer, time the analysis, and write down what works, what is slow or unreadable, and what is missing. Nothing is written inside those two folders (no `.aidea`, no edits, no recording of runs, no model session on them): only the core's analysis and the drawing are exercised. The result is a report in this ticket, and one new ticket for every gap that matters.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The report lists, for each project: how long opening takes, how many modules, classes, functions and relationships are found, how many relationships are unresolved, and whether the Components layer is readable at the default zoom and after Fit.
- [x] Each layer (Business, Requirements, Architecture, Components, Algorithms for one function, Code) is opened for each project and what is shown is described honestly (empty authored layers are expected).
- [x] Problems found (a layer that hangs, an unreadable canvas, a crash, a message that does not help) become tickets with a reproduction, in `.scratch/real-projects/issues/`.
- [x] Verified in the real app on the main screen and with headless captures at 1920x1080 and 1280x800; the person's folders are unchanged afterwards (`git status` clean in each, if they are repositories).

## Report (done overnight, read-only; the two folders were not changed: `git status` of each is identical before and after)

| | hubstaff-automation | Telegram |
|---|---|---|
| Python files | 587 (+ build copies, see below) | 209 |
| Modules / classes / functions found | 823 / 1,314 / 13,520 | 209 / 659 / 3,964 |
| Time for the core to open and analyse it | 15.8 s (19.7 s in the browser) | 4.8 s |
| Relationships unresolved | 974 | 70 |
| Components layout (rectangles) | 19,998 in 5.2 s | 5,975 in 0.7 s |
| Algorithm graph of one function | 0.18 s (15 steps) | 0.14 s (13 steps) |
| Page after opening, before the fixes | not measured | frozen for more than 5 minutes |

What was found, in the order it was found:

1. **The page froze** drawing the Components layer of Telegram (more than five minutes, no end): the travelling dots (`notationPacket`) asked the browser for the length of each edge between insertions, so the browser laid the whole drawing out again for every dot, which grows with the square of the number of edges. Fixed: lengths are read before anything is inserted, and only the first 250 edges get dots. Telegram now draws in about 3 s; hubstaff in about 9 s (193,000 SVG elements).
2. **Build output was analysed as part of the project**: `dist/` of hubstaff (two PyInstaller copies, 236 modules) and, for any project, `build/`, `env/` and `site-packages/`. Fixed with a test (`test/skip-dirs.test.ts`): they are skipped like `venv` and the hidden folders.
3. **The Components layer is one long row**: every module is a column side by side, so Telegram is a strip of about 40,000 px; at normal zoom only 2 of its 209 modules are visible and Fit shrinks it to nothing (a screenshot after Fit even timed out at 30 s in headless Chrome). The page runs at about 8 frames per second with 30,000 SVG elements (software rendering, headless). This is the real gate for working on these two projects: ticket `03-big-projects-overview`.
4. Authored layers (Business, Requirements, Architecture) are empty, as expected for projects without `.aidea`; Algorithms and Code work for any function (0.2 s).
5. Opening is slow for hubstaff (16 to 20 s, most of it the relationship analysis) with no progress shown: ticket `04-opening-a-big-project-says-so`.

Verdict: both projects are Python, so the first version's analyser understands them. Telegram is workable once the overview exists; hubstaff-automation too, with the overview and a slower first open.
