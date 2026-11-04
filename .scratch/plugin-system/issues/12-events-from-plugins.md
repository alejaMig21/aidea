# 12: Events from plugins

**What to build:** A plugin can define events with its own name, a declared mode (announce only, or able to ask for a decision) and a version, and other plugins can react to them without importing it. The kernel's own events follow the same rule.

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] An event is namespaced by the plugin that defines it; a plugin cannot define an event in another's namespace.
- [x] An announce event cannot change anything; an ask event can only deny or ask.
- [x] Deactivating either plugin removes its listeners and its events cleanly.
- [x] Core API tests with two fixture plugins pass; `npm run verify` is green.

## Live check
Not verified live yet: the behaviour is covered by core API tests; the manager screen shows the update difference but that path was not clicked through in Electron.

Live check (2026-11-04, Electron, primary screen): the events a plugin declares were listed by GET /plugins. Script: live-shots2/results.json (17 of 17).
