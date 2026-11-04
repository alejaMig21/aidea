# 11: Guard rules from plugins

**What to build:** A plugin can add a guard rule that says "no" or "ask the person", never "let it pass" against another rule. The kernel combines the rules (any "no" wins) and shows the question when one asks. The protection of the authored layers moves onto this mechanism with the same behaviour.

**Blocked by:** 02.

**Status:** ready-for-agent

- [x] A fixture rule that denies stops the action; one that asks pauses it until the person answers.
- [x] A fixture that tries to allow something another rule denied is refused at registration or has no effect.
- [x] The existing tests of the authored-layer protection pass unchanged.
- [x] Core API tests pass; `npm run verify` is green.

## Notes (2026-11-04)
- Guard rules run in front of the Builder's permission requests (the `approve` tool): a deny refuses with no card, an ask puts the question on the card (a `note` field shown above the request), an allow is ignored, a rule that throws makes the person ask. Rules are synchronous.
- The protection of the authored layers (`guard.ts`) stays as it was: it acts AFTER a Builder turn (it reports and offers to revert changes made outside a Proposal), so it is not an action rule. Its tests pass unchanged. Moving it onto the mechanism is left for when the kernel checks actions of that kind.
