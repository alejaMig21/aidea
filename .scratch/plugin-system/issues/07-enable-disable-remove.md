# 07: Enable, disable and remove

**What to build:** The manager enables, disables and removes plugins with one set of status words (applied, failed, restart required). Removing a plugin asks whether to delete its data, keeping it by default. Changes to code that already ran ask for a restart with a "Restart aidea" button.

**Blocked by:** 06.

**Status:** ready-for-agent

- [ ] Enable and disable apply live; removing a plugin that never ran in this session applies live.
- [ ] Removing or updating a plugin whose code already ran reports restart required and shows the button.
- [ ] Removal asks to delete the data, "keep" being the default; the data stays when kept.
- [ ] A saved Layout survives the removal of a plugin whose Panel was in it.
- [ ] Core API and page tests pass; `npm run verify` is green.
