# 13: Settings, data and secrets

**What to build:** Each plugin has a private data folder named by its id. Its settings follow a schema in the manifest and are drawn as a form by the manager. Its secrets go to the operating system's secure store, never to a file.

**Blocked by:** 06.

**Status:** ready-for-agent

- [x] The manager draws a form from the settings schema and saves valid values only.
- [x] A plugin reads and writes only its own data folder; the API gives no way to reach another plugin's.
- [x] A secret is never written to a settings file, the plugin store or a log (a test searches for it).
- [x] Core API and page tests pass; `npm run verify` is green.

Note: the default secret store keeps secrets in memory (they last until aidea closes). The core runs as a child process of the window and cannot reach Electron safeStorage; a bridge from the window is still to build. startCore takes a `secretStore` for an embedder that can.

Live check (2026-11-04, Electron, primary screen): the settings form was drawn from the schema, saved valid values, named a bad field and saved nothing; the secret was never in the page, the answers or any file of the plugin store. Script: live-shots2/results.json (17 of 17).
