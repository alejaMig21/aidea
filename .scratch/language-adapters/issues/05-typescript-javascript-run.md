# 05: Running a TypeScript or JavaScript function for Playback

**What to build:** The third operation of the adapter for the second language. Running the person's own code is the risky part: the Python Playback has guards that are a safety net and not a sandbox. Decide, before building, how a JavaScript function is run (a separate Node process with permissions turned off, a worker, something else), what is allowed (files, network, new processes) and what the person is told. The decision is the person's; write the options with their cost here and wait for the choice.

**Blocked by:** language-adapters 04 and the person's choice.

**Status:** decided, ready to build inside the TypeScript plugin (`.scratch/language-plugins` ticket 03). CORRECTION 2026-11-04: an earlier audit called this needs-info; the decision was made on 2026-11-03 (`.scratch/future/interviews-pending.md`, section 7) and the audit had not read it.

- [x] The chosen way of running, what is blocked and what the person is warned about are written here. (Decided 2026-11-03: a separate Node process with Node's `--permission` flag, which blocks file writes and starting processes, measured on Node 24.11.1; plus aidea's own guard that replaces network calls with fake data, as the Python Playback does. The person is told it is a safety net, not a sandbox. Concern recorded by the person: the network guard is software and not a barrier; revisit before aidea runs code from repositories the person did not write, and consider an operating-system block of the network for that process.)
- [ ] Through the protocol: a function with a file write or a network call is refused or replaced by fake data as in the Python Playback.
- [ ] Verified in the real app.
