# 07: Tests and fixtures drown the overview of a real project

**What to build:** Opening aidea's own repository, the overview has 183 modules and 24 folder blocks; about 90 modules and 20 of the blocks are `test/` files and `test/fixtures/*` (small Python and TypeScript projects that exist only to be analysed). At Fit they take the lower half of the screen and the language line counts them too ("Python, 39 files" is 5 real files plus 34 fixture files). A person learning the code wants `src/core`, `src/ui` and `electron` first. Fold folders that are tests or fixtures (a name such as `test`, `tests`, `__tests__`, `fixtures`, `spec`) into one block each, closed by default, with a plain line "N test modules hidden - show" that opens them; the pair count and the language line say what they hold.

**Blocked by:** None.

**Status:** done

**Built:** folders with a path part `test`, `tests`, `__tests__`, `fixtures`, `spec`, `specs` fold into one dashed closed block (`tests:folded`); `GET /layout?...&tests=1` opens them (drawn after the other folders). The response carries `tests: {modules, folders, pairs, open}`. The line at the bottom says "N test modules hidden (P pairs touch them, not counted above) - show" and flips to "includes N test modules ... - hide"; double click or Enter on the block also opens it. The top-bar language line is left as it is (it says what the project holds, files on disk); the bottom line says what is folded.

- [x] On the aidea repository the first screen at Fit shows `electron`, `src/core`, `src/core/routes`, `src/ui/features` and one closed block for tests (also `src/core/adapter`, a real one-module folder); opening it shows the 89 test modules.
- [x] A project with no test folders draws exactly as before (test: no `tests` entry, same rect count).
- [x] The count of hidden modules and pairs is written on the screen.
- [x] Verified on a copy of the aidea repository and on Telegram (129 test modules) at 1920 and 1280 pixels wide, closed, open, closed again.
