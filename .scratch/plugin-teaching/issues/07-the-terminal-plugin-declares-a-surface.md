# 07: The Terminal plugin declares a teaching surface

**What to build:** The Terminal plugin has a Panel (state of its own) and ships a lesson, but no teaching surface, so the scan warns at every load (plugin-teaching 04). Give it one: a read-only view of its tabs (which programs have a tab and the last lines each wrote) and a named check, for example "a program wrote something to its tab", with the module and the state snapshot in its host half. Update its lesson refs if needed.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Terminal plugin declares `teach` with a view, at least one check, and a module; the scan shows no surface warning for it.
- [ ] The Tutor reads the view and runs the check for the Terminal (a test with a fake program).
- [ ] Core API tests pass; `npm run verify` is green.

Source: `.scratch/plugin-teaching/spec.md` and plugin-teaching 04.
