# 09: Playback

**What to build:** From an Algorithm graph, the person picks a function and sample inputs (taken from the Project's tests or typed in). aidea runs the function in the Project's own Python environment, records which steps ran and with what values, and replays the recording on the graph. The person can pause, step forward, step back and scrub. Playback never re-runs live. Only functions without external effects, or with those effects replaced by fake data, can be played.

**Blocked by:** 05

**Status:** ready-for-agent

- [x] Choosing a pure function and inputs records a trace and shows it on the Algorithm graph.
- [x] Pause, step forward, step back and scrub move the highlighted step and displayed values.
- [x] A function with external effects is refused with a clear message unless those effects are replaced.
- [x] Replaying the same recording twice gives identical results without running the code again.

## Notes from the review

- Implemented and merged; verified live. The core runs the function once in a child Python process under a tracer and keeps the Recording (the steps visited and the values on arrival); replaying reads it from memory and never runs the code again. Recordings are lost when the core restarts.
- **This runs the Project's own code, including whatever its modules do when imported.** Guards: calls to files, network, processes and native code in the function's own body are refused before running unless replaced with fake data (names only, aliases resolved); while running, an audit hook stops file writes, reads outside the Project and the Python installation, network, new processes and calls into native code, also inside helpers. These are a safety net for mistakes, not a sandbox: the person is told so in the panel. The three bypasses found in review (native calls, low-level Windows process creation, reading any file) were reproduced and are now blocked.
- The Project's own virtual environment is used only when the person ticks the box (it runs a program that ships with the Project); otherwise the Python on the PATH runs, and the Recording says which one ran.
- Known gaps: sample inputs are typed JSON (reading them from the Project's tests is not built); generators and async functions are refused; a recursive function is recorded for its outermost call only; module import time code is not covered by the static check; a library that reads files outside the Project at run time is blocked; the values shown are `repr` cut at 80 characters, and printed output is shown only at the last step.
