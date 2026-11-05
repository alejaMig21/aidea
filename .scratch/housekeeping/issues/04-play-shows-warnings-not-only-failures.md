# 04: Play shows warnings, not only failures

**What to build:** When Play starts the parts of a Project, a part can be running and yet say something worrying. Today the person sees running or failed. Detect warnings and show them on the part (words as well as colour). The person left open how warnings are detected and shown.

**Blocked by:** None (can start immediately).

**Status:** needs-info: how a warning is detected (a pattern the recipe declares, the stderr, an exit code) and shown

- [ ] The way a warning is detected is chosen and written here.
- [ ] A part that raises a warning shows it in its Terminal tab and in the Play status, in words.
- [ ] A part that only warns is still running and is not stopped.
- [ ] Core API and page tests pass.

Source: `.scratch/future/interviews-pending.md` topic 1.
