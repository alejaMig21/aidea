# 01: The manifest can declare a teaching surface

**What to build:** A plugin's manifest accepts a `teach` field: the name of a read-only view of its state and a list of named checks (each with a name, one plain sentence of what it verifies, and optional arguments with their shape). The lesson file stays declared as in plugin-lessons 01. The field is validated with the problem named, and `docs/plugin-api.md` describes it.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A manifest with a valid `teach` field loads; one with a check that has no sentence, a duplicate name or a bad argument shape is refused with the field named.
- [ ] The scan lists the view and the checks among what the plugin declares.
- [ ] `docs/plugin-api.md` describes the field.
- [ ] Core API tests pass; `npm run verify` is green.

Source: `.scratch/plugin-teaching/spec.md`.
