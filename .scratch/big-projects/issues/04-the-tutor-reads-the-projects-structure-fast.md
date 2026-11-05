# 04: The Tutor reads the structure of a project quickly

**What to build:** The Tutor helps the person build the layers of a project, but today it can only list and read files one by one, so understanding a project it has not seen costs many reads and a lot of the session. Give it read tools over the structural map of the Project: an overview (packages, entry points, the modules most others depend on), who calls or imports a given function or module, and the code of one function. The map is the one aidea already builds (modules, classes, functions and 13,004 relationships for Telegram, each with its Resolution) and, later, whatever an index provider fills in for languages aidea has no plugin for (layer-inference 10): the tools do not care which source filled it. They answer from the map, so they are fast and cost the session little. The code graph is evidence for the Tutor's judgement and for choosing what to read; it is never drawn on the Canvas (layer-inference spec).

**Blocked by:** layer-inference 02.

**Status:** ready-for-agent (reshaped 2026-11-05: provider-agnostic; the fingerprint is layer-inference 02)

- [ ] The Tutor has `read_structure` (overview), `read_relations` (callers and callees or importers of one Node) and `read_code` (the text of one function or class), all read-only and limited to the Project folder like the other read tools; they sit next to `read_fingerprint` (layer-inference 02) and do not duplicate it.
- [ ] Each answer is bounded in size and says when it was cut and how to ask for more.
- [ ] On Telegram the answers arrive in well under a second and the overview fits in a few thousand characters (measured and written here).
- [ ] A scripted class on a fixture Project uses them and reads fewer files than without (a count in the test).
- [ ] The pinned list of Tutor tools in the tests is updated; core API tests pass.

Source: the person's remark of 2026-11-05 that the Tutor, who helps build the layers, is the one who needs fast means to inspect a project.
