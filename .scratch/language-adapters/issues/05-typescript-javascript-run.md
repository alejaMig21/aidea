# 05: Running a TypeScript or JavaScript function for Playback

**What to build:** The third operation of the adapter for the second language. Running the person's own code is the risky part: the Python Playback has guards that are a safety net and not a sandbox. Decide, before building, how a JavaScript function is run (a separate Node process with permissions turned off, a worker, something else), what is allowed (files, network, new processes) and what the person is told. The decision is the person's; write the options with their cost here and wait for the choice.

**Blocked by:** language-adapters 04 and the person's choice.

**Status:** blocked by `.scratch/language-plugins/spec.md` (2026-11-04): languages become plugins, and how to run JavaScript safely is decided inside the TypeScript plugin (slice 6 there). Question still open for the person: a separate Node process with permissions turned off, a worker, or something else?

- [ ] The chosen way of running, what is blocked and what the person is warned about are written here.
- [ ] Through the protocol: a function with a file write or a network call is refused or replaced by fake data as in the Python Playback.
- [ ] Verified in the real app.
