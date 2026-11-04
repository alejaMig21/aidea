# 02: A plugin loads

**What to build:** The kernel loads a plugin from a folder of the plugin store: it reads the manifest without running code, activates the host half, registers what it adds and can undo all of it when the plugin is deactivated. A plugin that throws while activating is switched off and reported, and aidea keeps running. The core lists every plugin with its state and the reason when it is not active. Only the core is touched here (no window yet).

**Blocked by:** 01.

**Status:** ready-for-agent

- [x] The core takes a plugin store folder as an option and lists its plugins on a route, with id, title, version and state (active, inactive, failed) and a reason.
- [x] A good fixture plugin activates; deactivating it runs every undo it registered and leaves the registries as they were.
- [x] A plugin that throws on activation is reported as failed and every other plugin stays active.
- [x] A manifest that is missing or invalid is reported with the field, and nothing of that plugin runs.
- [x] Core API tests with real fixture folders pass.
- [x] `npm run verify` is green.
