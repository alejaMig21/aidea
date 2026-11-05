# 03: A mechanical check that a lesson still names what its plugin has

**What to build:** Each `refs` entry of a lesson is compared with what the live inspection (`GET /plugins/inspect`) says the plugin declares. A ref that no longer exists is a finding: "the lesson names X, the plugin no longer has it". The finding is a warning, never a block. It shows in the quarantine report, when the plugin loads, and in the update difference, where it also says "the plugin changed, the lesson did not". The check proves only that the names exist, not that the prose is right.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A fixture plugin whose lesson names a missing Panel produces the warning in the quarantine report and at load.
- [ ] An update that changes the plugin but not the lesson shows "the plugin changed, the lesson did not" in the difference.
- [ ] A plugin without a lesson gets a warning, not a block.
- [ ] Core API tests pass.
