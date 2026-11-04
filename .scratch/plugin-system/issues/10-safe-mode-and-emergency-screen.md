# 10: Safe mode and the emergency screen

**What to build:** aidea can start with every third-party plugin off. A minimal screen of the kernel, which depends on no plugin, lists plugins with their state and reason and can switch any of them off.

**Blocked by:** 07.

**Status:** ready-for-agent

- [ ] A start option (and a control in the window) starts aidea in safe mode: no third-party plugin activates.
- [ ] The emergency screen works when every plugin is broken or missing.
- [ ] Switching a plugin off from it saves the choice for the next start.
- [ ] Core API and page tests pass; `npm run verify` is green.
