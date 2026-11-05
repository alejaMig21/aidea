# 04: The surface is required for plugins the Builder writes, a warning for the rest

**What to build:** A plugin the Builder writes that adds a Panel, a layer or other state of its own cannot be proposed for installing without a valid view, valid checks and a lesson; the reason is shown in plain words. A plugin with no state of its own (a theme, a guard rule) needs only its lesson. For every other plugin a missing or stale surface is a warning in the quarantine report, at load and in the update difference, never a block. The plugin template carries an empty surface and the Creator Mode skill says to write and update it.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] A Builder-written plugin with a Panel and no valid surface is not proposed; a Builder-written theme with only a lesson is.
- [x] A third-party plugin without a surface installs with a warning.
- [x] The template, copied unchanged, still passes the scan and installs.
- [x] The skill tells the agent to write and update the view and the checks.
- [x] Core API tests with a fake Builder pass.

Source: `.scratch/plugin-teaching/spec.md`.

## What was built (2026-11-05)

- `src/core/plugins/surface.ts`: a plugin has "state of its own" when it adds a Panel (interface half), provides a service or declares events; then it owes a teaching surface: `teach` with at least one check, a module that exists, exports a `view` and still holds each named check. A theme or a guard rule with none of those owes only its lesson.
- `propose_plugin` refuses a Builder-written plugin with state of its own and no valid surface, in plain words (the problems named, and where to copy it from); a theme with only a lesson and a Panel with a valid surface are proposed.
- For every other plugin the scan only warns (`no-surface`, `surface-stale`), the warnings also go to the plugin log at load, and `difference()` returns `surfaceStale` ("The plugin changed, its teaching surface did not." in the manager).
- The template now has `main.js` (`ctx.teach.state`) and `teach.mjs` (a view and one check) and the manifest names them; copied unchanged it scans with no blocking finding and no surface or lesson warning. The skill (step 6) says to write and update the surface and what it holds.
- Tests: `test/plugin-surface.test.ts` (5). Live (main monitor, the person's browser, `serve-fake-builder-surface.mjs`): a stand-in Builder proposed three folders: the Panel without a surface was REFUSED with the reason, the Panel with a surface and the guard rule were PROPOSED and are the two in the quarantine.
- Note: the built-in plugins Terminal and Run have a Panel and no surface yet: the Run plugin's is plugin-teaching 05; the Terminal's is not ticketed (it logs a warning at load).
