# 03: Authored layers in the repository

**What to build:** Business, Requirements and Architecture content is kept as plain text files inside the Project's repository and shown on the Canvas as Nodes. Business uses the Business Model Canvas structure, Requirements uses user stories, Architecture uses C4-style containers and technology choices. Each Node carries a Rationale including rejected alternatives, shown in the right-hand panel when the Node is selected. The person can hand-edit the files; every load validates them and reports mistakes clearly.

**Blocked by:** 01

**Status:** done

- [x] Authored files in a Project appear as Nodes on the first three Layers.
- [x] Selecting a Node shows its Rationale in the right-hand panel.
- [x] A malformed hand edit is reported with a clear message and does not crash the core.
- [x] Authored files are plain text and sit inside the Project repository.

## Notes from the review

- Implemented and merged. The Business Model Canvas blocks and the C4-style containers are drawn as plain cards in a grid, not in canvas or nested layouts; parents are validated but not drawn.
- A hand-edited `.aidea` folder that is a link elsewhere is ignored, and an Architecture Node whose parent does not exist is dropped with an error.
