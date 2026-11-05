# 04: The screen says, for each rule and plugin, whether it is prevented or detected

**What to build:** A view of the policies in force: which plugin imposes each, what it conditions, and for each plugin affected whether the condition is PREVENTED (aidea sees the permission) or DETECTED AND REVERTED (it does not). When something is stopped, the message says which policy stopped it and why, in plain words, so "why was my Builder stopped" has an answer. It never claims a guarantee it cannot give.

**Blocked by:** plugin-policies 02.

**Status:** ready-for-agent

- [ ] The view lists each active policy, its source plugin and the plugins it affects, with prevented or detected.
- [ ] A stopped action shows the policy, the rule and the reason in words.
- [ ] Page tests at 1920 and 1280 pixels pass; the language-neutral text test passes.

Source: `.scratch/plugin-policies/spec.md`.
