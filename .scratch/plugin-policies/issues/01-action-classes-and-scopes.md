# 01: Actions carry a class and a scope

**What to build:** A closed list of classes of action and the scope of each: writes inside the Project (code, authored layers), writes outside the Project, runs a program, uses the network, reads secrets. Plugins declare the classes they use (the scan compares with what their code does, as with capabilities today), and the kernel tags every action it mediates with its class and scope. The list is written in `docs/plugin-api.md`.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (core tests; the live read of the findings was not confirmed)

- [x] The list of classes and scopes exists in `docs/plugin-api.md` and in the code, closed.
- [x] A plugin that declares a class it does not use, or uses one it did not declare, is a scan finding.
- [x] An action mediated by the kernel arrives at the guard with its class, scope, and the plugin that did it.
- [x] Core API tests pass.

Source: `.scratch/plugin-policies/spec.md`.

## What was built (2026-11-05)

- `src/core/plugins/actions.ts`: the closed list of classes (`writes-project`, `writes-outside`, `runs-program`, `uses-network`, `reads-secrets`) and `classOfTool`, which classifies a Builder tool by what it does and where (a write inside or outside the Project with its path, Bash, WebFetch/WebSearch; reading and aidea's own tools are no class). Written in `docs/plugin-api.md` ("Classes of action"); a test keeps the two lists equal.
- Manifest `actions`: validated against the list. The scan compares a declared list with the code: a class used and not declared blocks (any file write needs `writes-project` or `writes-outside`), a class declared and not used warns; a plugin without `actions` is judged by its capabilities as before. The Run plugin declares its actions.
- The kernel tags what it mediates: the Builder's permission request reaches the guard rules with `class`, `scope`, `project` and `by: {role: "builder"}`; a tool a plugin offers carries `by: {role: "plugin", plugin}` and the `class` it declared.
- Tests: `test/action-classes.test.ts` (6); verify 1031 pass, 0 fail.
- Live: NOT confirmed. `.scratch/plugin-policies/live-scripts/serve-actions.mjs` serves three plugins in the quarantine, but the text of the findings was not found when read from the Plugins manager (the check ran out of budget); the findings are proven in the core tests only.
