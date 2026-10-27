# 08: Builder proposals

**What to build:** The core offers its own tool server to the builder. The builder creates or changes Nodes and Trace links on the authored layers only through these tools. Each change arrives as a highlighted Proposal on the Canvas that the person accepts or rejects; accepted changes are written to the authored files, rejected ones leave nothing behind. The builder cannot write those files directly.

**Blocked by:** 03, 06

**Status:** ready-for-agent

- [ ] A builder tool call that adds a Node produces a pending Proposal and no change to the files.
- [ ] Accepting writes the Node to the authored files; rejecting leaves them untouched.
- [ ] Invalid tool input is rejected with a clear error and creates no Proposal.
- [ ] The Proposal highlights the affected Nodes on the Canvas.
