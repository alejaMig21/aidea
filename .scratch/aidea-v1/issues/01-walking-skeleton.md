# 01: Walking skeleton

**What to build:** A person opens a small Python repository as a Project, sees it in the Projects list on the left, and sees a Canvas in the center that can be panned and zoomed and shows the derived Nodes for the Project's modules, classes and functions. The core runs separately from the interface and they talk only through the local protocol. This ticket also establishes the test setup: tests enter through the protocol, use a fake Agent adapter and a fixed fixture Python Project.

**Blocked by:** None (can start immediately). Prerequisite: the repository is not under version control yet; initialise it first.

**Status:** ready-for-agent

- [ ] Opening the fixture Project through the protocol returns Nodes for its modules, classes and functions.
- [ ] Opened Projects appear in the Projects list; the Canvas pans and zooms in the desktop app.
- [ ] Protocol-level tests run with the fake Agent adapter and the fixture Project, with no login and no network.
- [ ] The mechanism used to analyse Python is chosen and, if it meets the ADR criteria, recorded as an ADR.
- [ ] The interface contains no domain logic.
