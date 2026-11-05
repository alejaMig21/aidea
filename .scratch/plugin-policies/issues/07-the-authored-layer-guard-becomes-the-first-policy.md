# 07: The authored-layer guard becomes the first policy

**What to build:** The protection of `.aidea/` (`src/core/guard.ts`) still has its own watcher and rules next to the guard-rule mechanism of plugin-system 11. Move it onto the policy mechanism of this effort: it becomes the first policy, matching the class "writes to the authored layers" (ticket 01) for any plugin, with the same behaviour. It proves the mechanism on something real before the Contract plugin relies on it, and leaves one way to guard instead of two.

**Blocked by:** plugin-policies 02.

**Status:** ready-for-agent

- [ ] Every existing test of the authored-layer protection passes unchanged.
- [ ] The rule matches by class and scope and names no plugin; a plugin other than the Builder that writes to `.aidea/` is held by it too (a fixture proves it).
- [ ] The run recipe file keeps its exemption (the person's consent protects it), as before.
- [ ] Core API tests pass; `npm run verify` is green.

Source: `.scratch/plugin-policies/spec.md`; the old backlog row "Move the authored-layer guard onto the plugin guard mechanism".
