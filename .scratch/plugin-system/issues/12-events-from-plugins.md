# 12: Events from plugins

**What to build:** A plugin can define events with its own name, a declared mode (announce only, or able to ask for a decision) and a version, and other plugins can react to them without importing it. The kernel's own events follow the same rule.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] An event is namespaced by the plugin that defines it; a plugin cannot define an event in another's namespace.
- [ ] An announce event cannot change anything; an ask event can only deny or ask.
- [ ] Deactivating either plugin removes its listeners and its events cleanly.
- [ ] Core API tests with two fixture plugins pass; `npm run verify` is green.
