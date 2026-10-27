# 06: Chat with the builder

**What to build:** The person types in the chat bar and the user's own installed, unmodified Claude Code, launched in non-interactive streaming mode through an Agent adapter, answers in real time. Sub-agent activity is visible. The bare mode is not used, so the person's subscription login and their plugins, skills, hooks and memory keep working. aidea never reads or stores credentials. If Claude Code is missing or not signed in, the person gets a clear message saying what to fix.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A message sent through the protocol produces streamed reply events in order.
- [ ] Sub-agent messages are reported as nested under the call that started them.
- [ ] Missing installation and missing sign-in each produce a distinct, clear error.
- [ ] Tests use the fake Agent adapter replaying a stream recorded once from a real session.
- [ ] Manual check with the real Claude Code confirms the reply works with the person's existing plugins and subscription login.
