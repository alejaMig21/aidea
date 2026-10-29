# 07: Tests and fixtures drown the overview of a real project

**What to build:** Opening aidea's own repository, the overview has 183 modules and 24 folder blocks; about 90 modules and 20 of the blocks are `test/` files and `test/fixtures/*` (small Python and TypeScript projects that exist only to be analysed). At Fit they take the lower half of the screen and the language line counts them too ("Python, 39 files" is 5 real files plus 34 fixture files). A person learning the code wants `src/core`, `src/ui` and `electron` first. Fold folders that are tests or fixtures (a name such as `test`, `tests`, `__tests__`, `fixtures`, `spec`) into one block each, closed by default, with a plain line "N test modules hidden - show" that opens them; the pair count and the language line say what they hold.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] On the aidea repository the first screen at Fit shows `electron`, `src/core`, `src/core/routes`, `src/ui/features` and one closed block for tests; opening it shows what is there now.
- [ ] A project with no test folders draws exactly as before.
- [ ] The count of hidden modules and pairs is written on the screen, so nothing is hidden silently.
- [ ] Verified on a copy of the aidea repository and on Telegram at 1920 and 1280 pixels wide.
