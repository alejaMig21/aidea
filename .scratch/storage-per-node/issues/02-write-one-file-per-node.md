# 02: Accepting a Proposal writes one file per Node

**What to build:** Second step of ADR 0005 (migrate): accepting a Proposal to add, change or remove a Node writes or removes that Node's own file under `.aidea/<layer>/`. When a layer is still stored as a single file, its first accepted write converts it: every Node is written to its own file first, and only after all of them are on disk the old single file is removed (a failure leaves the old file and no half-converted layer). Pattern groups are written to their own files. The Node's content and the order in which the layer is drawn do not change.

**Blocked by:** storage-per-node 01.

**Status:** resolved

- [x] Through the protocol: accepting an add, an update and a remove on a per-Node project changes only that Node's file; on a single-file project the first accepted write converts the layer and the drawn result is identical before and after.
- [x] A write that fails halfway (a read-only folder, for example) leaves the layer as it was and tells the person.
- [x] Two Proposals for different Nodes accepted one after the other touch two different files (checked by file name), which is what avoids the merge conflict.
- [x] Pattern groups accepted from a Proposal are stored as their own files; the hand-editable format of a Node file is documented in the loader's header comment and in ADR 0005's consequences.
- [x] Verified in the real app (2026-11-04, Vivaldi through the Claude extension, real Claude Code): on a copy of `test/fixtures/studio-requirements` (layers stored one file per layer) the Builder made a Proposal for a requirement, "Review" then "Accept" in the interface. Result on disk: `.aidea/requirements.json` was gone and `.aidea/requirements/` held nine files `001-...` to `009-...` for the existing Nodes plus `010-us-export-sales-csv.json` for the new one; `.aidea/architecture.json` was untouched (a layer converts on its own first write). The new file has the Node's content as proposed.
