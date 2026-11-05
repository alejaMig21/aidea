# 03: Detect and revert a write to the Project that nobody mediated

**What to build:** Where aidea does not mediate an action (a plugin that writes straight to disk with its own code, an agent whose protocol has no permission step) it cannot prevent it, so it detects it: a watcher on the Project's files, as the one that guards `.aidea/`, compares what changed with what the active policies allow, and reverts the change or flags it as a Difference, as the policy says. The Project's own git state is respected: a revert never discards what the person wrote by hand.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] A fixture plugin that writes straight to disk in breach of a policy has its change detected and reverted (or flagged), in a test with a temporary Project.
- [ ] A change the person made by hand in an editor is never reverted.
- [ ] The detection does not slow the Project when thousands of files exist (measured on Telegram).
- [ ] Core API tests pass.

Source: `.scratch/plugin-policies/spec.md`.
