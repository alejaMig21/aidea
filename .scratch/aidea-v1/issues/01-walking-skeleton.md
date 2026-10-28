# 01: Walking skeleton

**What to build:** A person opens a small Python repository as a Project, sees it in the Projects list on the left, and sees a Canvas in the center that can be panned and zoomed and shows the derived Nodes for the Project's modules, classes and functions. The core runs separately from the interface and they talk only through the local protocol. This ticket also establishes the test setup: tests enter through the protocol, use a fake Agent adapter and a fixed fixture Python Project.

**Blocked by:** None (can start immediately). Prerequisite: the repository is not under version control yet; initialise it first.

**Status:** done

- [x] Opening the fixture Project through the protocol returns Nodes for its modules, classes and functions.
- [x] Opened Projects appear in the Projects list; the Canvas pans and zooms in the desktop app. (Verified by the person in the Electron window on 2026-10-27: opened the shop fixture, panned and zoomed the Canvas, opened a function's graph and used the chat.)
- [x] Protocol-level tests run with the fixture Project, with no login and no network. (The fake Agent adapter is deferred to ticket 06, since no Agent adapter exists yet.)
- [x] The mechanism used to analyse Python is chosen and, if it meets the ADR criteria, recorded as an ADR. (Python's standard-library `ast`, run as a subprocess. Not ADR-worthy: it sits behind the protocol, so it is easy to reverse.)
- [x] The interface contains no domain logic.

## Notes from the review

- The core binds to the local address only, rejects requests whose Host or Origin is not its own, caps request bodies at 64 KB and limits analysis time to 60 seconds.
- Project ids are the full folder path, so two folders with the same name stay separate.
- Known gaps, not defects of this ticket: nested functions are not listed; a package's `__init__.py` becomes the module `pkg.__init__`; the analyzer uses the `python` found on PATH, not the Project's own interpreter (matters for ticket 09, Playback).

- Desktop window: Electron 45 installed by hand (the download kept failing); `AIDEA_DISPLAY=secondary` opens it on the second monitor. The window is placed with `setBounds` called twice because the constructor's x and y, and a single call, landed on the wrong screen or at the wrong size when the screens have different scales.
