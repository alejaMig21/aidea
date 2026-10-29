# 05: What happens when the person takes a long time to answer a question

**What to build:** The Tutor is a Claude Code process that waits, inside a tool call, until the person answers. The first spike measured that a wait of up to 130 seconds works; nothing longer has been tried with the real Claude Code, and a person who goes for a coffee or reads a long explanation can easily take more than that. Measure what really happens at 3, 10 and 30 minutes of waiting (does the tool call time out, does the process end, does the answer still get through when it comes), then make the behaviour kind: an answer that arrives in time continues the class; one that cannot (the process has ended) tells the person plainly and offers to start again where they left off, and never loses the question or the answers already given.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A written finding in this file: for waits of 3, 10 and 30 minutes with the real Claude Code, what happens to the tool call and to the process (record the Claude Code version).
- [ ] Through the protocol with a scripted Teacher: a question the person answers after the core has given up on it (the class ended) answers with a clear error, and the card in the interface shows "Expired: the Tutor stopped waiting" as today, with a plain line offering to start a class on the same topic.
- [ ] If the real process survives long waits, a test with a long wait is not added to the suite (too slow); the finding says so. If it does not, the core's own timeout is set below the real one and tells the person before the process ends.
- [ ] Verified live on the second monitor: leave a question unanswered for the longest wait that works, answer it, and the class goes on; and one that does not work shows the plain message.
