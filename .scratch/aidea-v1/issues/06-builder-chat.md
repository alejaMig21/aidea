# 06: Chat with the builder

**What to build:** The person types in the chat bar and the user's own installed, unmodified Claude Code, launched in non-interactive streaming mode through an Agent adapter, answers in real time. Sub-agent activity is visible. The bare mode is not used, so the person's subscription login and their plugins, skills, hooks and memory keep working. aidea never reads or stores credentials. If Claude Code is missing or not signed in, the person gets a clear message saying what to fix.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] A message sent through the protocol produces streamed reply events in order.
- [x] Sub-agent messages are reported as nested under the call that started them.
- [x] Missing installation and missing sign-in each produce a distinct, clear error.
- [x] Tests use the fake Agent adapter replaying a stream recorded once from a real session.
- [x] Manual check with the real Claude Code confirms the reply works with the person's existing plugins and subscription login.

## Notes from the review

- Implemented and merged; verified live with the real Claude Code (reply streamed, cost shown). Real recordings cover a normal reply and a signed-out run; the sub-agent nesting fixture is hand-written.
- Not-signed-in detection relies on the `authentication_failed` marker Claude Code emits today. Each message loads the person's plugins, so even a one-word reply costs roughly 12 cents of usage.
- Known gaps: no limit on concurrent builder runs; on Windows stopping a run kills only the top process, not its children; permission requests are denied until ticket 07.
