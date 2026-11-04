# 11: Guard rules from plugins

**What to build:** A plugin can add a guard rule that says "no" or "ask the person", never "let it pass" against another rule. The kernel combines the rules (any "no" wins) and shows the question when one asks. The protection of the authored layers moves onto this mechanism with the same behaviour.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] A fixture rule that denies stops the action; one that asks pauses it until the person answers.
- [ ] A fixture that tries to allow something another rule denied is refused at registration or has no effect.
- [ ] The existing tests of the authored-layer protection pass unchanged.
- [ ] Core API tests pass; `npm run verify` is green.
