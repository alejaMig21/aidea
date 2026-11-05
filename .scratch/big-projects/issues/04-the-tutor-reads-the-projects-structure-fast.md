# 04: The Tutor reads the structure of a project quickly

**What to build:** The Tutor helps the person build the layers of a project, but today it can only list and read files one by one (`list_files`, `read_file`), so understanding a project it has not seen costs many reads and a lot of the session. aidea already holds a code graph of the Project (modules, classes, functions and 13,004 relationships for Telegram, each with its Resolution). Give the Tutor read tools over it: an overview (packages, entry points, the modules most others depend on), who calls or imports a given function or module, and the code of one function. They answer from the analysis aidea already made, so they are fast and cost the session little. This is the first, own answer to the idea of a code-graph tool for the agents; the spike in the backlog compares it with Codebase Memory MCP afterwards.

**Blocked by:** 01 (so that the analysis is fast to have).

**Status:** ready-for-agent

- [ ] The Tutor has `read_structure` (overview), `read_relations` (callers and callees or importers of one Node) and `read_code` (the text of one function or class), all read-only and limited to the Project folder like the other read tools.
- [ ] Each answer is bounded in size and says when it was cut and how to ask for more.
- [ ] On Telegram the answers arrive in well under a second and the overview fits in a few thousand characters (measured and written here).
- [ ] A scripted class on a fixture Project uses them and reads fewer files than without (a count in the test).
- [ ] The pinned list of Tutor tools in the tests is updated; core API tests pass.

Source: the person's remark of 2026-11-05 that the Tutor, who helps build the layers, is the one who needs fast means to inspect a project.
