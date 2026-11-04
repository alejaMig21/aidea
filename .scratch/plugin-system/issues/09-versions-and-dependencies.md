# 09: Versions and dependencies

**What to build:** The API version a plugin asks for is checked at install and at load. A plugin that needs a version aidea does not offer shows as incompatible and does not activate. A plugin whose required service is missing stays inactive and says why. Required plugins cannot be removed.

**Blocked by:** 07.

**Status:** ready-for-agent

- [x] An incompatible plugin is listed with the reason and does not activate, at install and after a restart.
- [x] Removing a plugin another one needs leaves the other inactive with a stated reason, and enabling it again re-activates it.
- [x] A required plugin cannot be removed or disabled.
- [x] Core API tests pass; `npm run verify` is green.

## Live check
Not verified live yet: the behaviour is covered by core API tests; the manager screen shows the update difference but that path was not clicked through in Electron.
