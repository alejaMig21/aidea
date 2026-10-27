# 07: Permission cards

**What to build:** When the builder needs permission (to edit a file, run a command), aidea receives the request and shows a card in the chat bar with approve and reject. The person's existing permission rules are applied first, so only unresolved requests reach a card. The answer is returned to the builder.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] A permission request from the builder reaches the interface as a pending card.
- [ ] Approving lets the action run; rejecting denies it and the builder is told so.
- [ ] A request already covered by the person's rules produces no card.
