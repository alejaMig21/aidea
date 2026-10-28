# 06: Measure: a short Probe before the first class of each layer

**What to build:** Before the first class of a layer, the Prober asks at most five questions limited to what that layer needs (for example for Architecture: what a container is, what a relationship means), skipping any idea the Learner graph already holds. Every question can be skipped with "I already know this". The result is handed over through a tool with a fixed shape (what the person knows, where understanding ends, per topic), recorded as Evidence, and starts the Plan (ticket 07) or the class. The Probe never blocks: the person can skip all of it.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Through the protocol with a scripted Prober: no more than five questions are accepted per Probe; a question about an idea already in the graph is not asked.
- [ ] "I already know this" skips a question and is Evidence; skipping the whole Probe starts the class anyway.
- [ ] The handover tool rejects a malformed result with a message the model can act on.
- [ ] The Probe of a layer runs once per person and Project unless the person asks to redo it.
- [ ] Verified with a headless browser: screenshot of the Probe in the Tutor column with the skip controls.
