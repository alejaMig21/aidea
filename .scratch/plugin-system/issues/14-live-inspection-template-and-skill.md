# 14: Live inspection, template and skill

**What to build:** Creator Mode, first half. A read-only inspection of the running app lists its services, events, slots, settings schemas and style tokens. A plugin template to copy, and a skill document that tells an agent how to write a plugin.

**Blocked by:** 03, 12.

**Status:** ready-for-agent

- [x] The inspection lists what is really registered, including what active plugins added, and changes nothing.
- [x] The template, copied unchanged into the quarantine, passes the scan and installs.
- [x] The skill says: start small, inspect the live app, copy the template, check, stop.
- [x] Core API tests pass; `npm run verify` is green.

Live check (2026-11-04, Electron, primary screen): GET /plugins/inspect and /plugins/skill answered in the running app. Script: live-shots2/results.json (17 of 17).
