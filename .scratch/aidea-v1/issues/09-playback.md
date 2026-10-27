# 09: Playback

**What to build:** From an Algorithm graph, the person picks a function and sample inputs (taken from the Project's tests or typed in). aidea runs the function in the Project's own Python environment, records which steps ran and with what values, and replays the recording on the graph. The person can pause, step forward, step back and scrub. Playback never re-runs live. Only functions without external effects, or with those effects replaced by fake data, can be played.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Choosing a pure function and inputs records a trace and shows it on the Algorithm graph.
- [ ] Pause, step forward, step back and scrub move the highlighted step and displayed values.
- [ ] A function with external effects is refused with a clear message unless those effects are replaced.
- [ ] Replaying the same recording twice gives identical results without running the code again.
