# 14: Live inspection, template and skill

**What to build:** Creator Mode, first half. A read-only inspection of the running app lists its services, events, slots, settings schemas and style tokens. A plugin template to copy, and a skill document that tells an agent how to write a plugin.

**Blocked by:** 03, 12.

**Status:** ready-for-agent

- [ ] The inspection lists what is really registered, including what active plugins added, and changes nothing.
- [ ] The template, copied unchanged into the quarantine, passes the scan and installs.
- [ ] The skill says: start small, inspect the live app, copy the template, check, stop.
- [ ] Core API tests pass; `npm run verify` is green.
