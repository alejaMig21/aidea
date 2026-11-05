# 01: The manifest can declare a teaching surface

**What to build:** A plugin's manifest accepts a `teach` field: the name of a read-only view of its state and a list of named checks (each with a name, one plain sentence of what it verifies, and optional arguments with their shape). The lesson file stays declared as in plugin-lessons 01. The field is validated with the problem named, and `docs/plugin-api.md` describes it.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live in Electron on the second monitor: the scan of a quarantined plugin lists the view and the checks)

- [x] A manifest with a valid `teach` field loads; one with a check that has no sentence, a duplicate name or a bad argument shape is refused with the field named.
- [x] The scan lists the view and the checks among what the plugin declares.
- [x] `docs/plugin-api.md` describes the field.
- [x] Core API tests pass; `npm run verify` is green.

Source: `.scratch/plugin-teaching/spec.md`.

## What was built (2026-11-05)

- `manifest.ts`: `teach` = `{ view, checks: [{ name, says, args? }] }`, validated by `teachProblems` (names, unique check names, a sentence of up to 160 characters, up to 5 arguments of string, number or boolean, up to 20 checks). `docs/plugin-api.md` describes `teach` and `lesson`.
- The scan needed no code: its report already carries the manifest, so the view and the checks are in it (`test/plugin-teach-manifest.test.ts`).
- Live: `.scratch/plugin-teaching/live-scripts/teach-scan.mjs` (a plugin with `teach` is quarantined and its scan lists it; one with an empty sentence is refused naming `says`).
