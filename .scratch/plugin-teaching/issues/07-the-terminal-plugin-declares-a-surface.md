# 07: The Terminal plugin declares a teaching surface

**What to build:** The Terminal plugin has a Panel (state of its own) and ships a lesson, but no teaching surface, so the scan warns at every load (plugin-teaching 04). Give it one: a read-only view of its tabs (which programs have a tab and the last lines each wrote) and a named check, for example "a program wrote something to its tab", with the module and the state snapshot in its host half. Update its lesson refs if needed.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] The Terminal plugin declares `teach` with a view, at least one check, and a module; the scan shows no surface warning for it.
- [x] The Tutor reads the view and runs the check for the Terminal (a test with a fake program).
- [x] Core API tests pass; `npm run verify` is green.

Source: `.scratch/plugin-teaching/spec.md` and plugin-teaching 04.

## What was built (2026-11-05)

- The Terminal plugin declares `teach`: view `state` (its tabs: program name, whether it runs, exit code, the last five lines) and the check `program-wrote {program}` ("a program started with Play wrote something to its tab"), with `main.js` (the snapshot) and `teach.mjs` (the view and the check). The scan shows no surface or lesson warning for it.
- The output belongs to the Run plugin, which now offers it as a service (`run.output`, the same answer as its `output` call); the Terminal asks it at the moment the Tutor asks (nothing is required: with Run off the tabs are empty). At most the last 20 lines of each tab travel.
- Plugin API: the function given to `ctx.teach.state` is now called with `{ project }`, the id of the Project of the Tutor's session (the MCP route, the lesson tasks and practice pass it), so a per-Project plugin can answer. `docs/plugin-api.md` says so.
- Tests: `test/terminal-surface.test.ts` (2): the scan, and a fake Tutor session reading the view and running the check after a real tiny program printed. Live (main monitor, the person's browser, `serve-fake-terminal.mjs`): after Play, the stand-in Tutor said `Tabs: hello [hello from the part]. Check: the program wrote something`; no page errors.
