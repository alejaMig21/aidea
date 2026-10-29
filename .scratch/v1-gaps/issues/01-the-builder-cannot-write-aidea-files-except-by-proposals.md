# 01: The builder cannot change the authored files except through Proposals

**What to build:** Today only the builder's Write, Edit and MultiEdit tools are denied on `.aidea/**`. A shell command or a notebook edit can still change the authored layers, so the promise of the first version (user story 35: the builder leaves the Canvas in a broken state only if the person accepts it) does not hold. Make it hold. Recommended default (decision taken overnight, see LOG): the core remembers the exact content of every authored file after each accepted Proposal or hand edit it knows about; after each builder turn it compares, and any change it did not make is shown to the person in plain words with a button to restore the previous content. Also deny the extra writing tools that can be named (NotebookEdit and shell patterns that name `.aidea`), knowing a pattern is not a wall.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Through the protocol with a fake adapter that changes a `.aidea` file while the turn runs: the change is reported once with the file name, restoring brings back the previous content byte for byte, and a change made by an accepted Proposal is never reported. A file created outside the known set is reported too. The denied-tools list includes NotebookEdit. (`test/authored-guard.test.ts`; the chat line and Restore button checked in headless Chrome at 1920 and 1280.)
- [ ] Verified live: ask the real builder to edit a `.aidea` file with a shell command and see the report.
