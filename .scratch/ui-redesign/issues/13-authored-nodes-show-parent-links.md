# 13: Authored nodes show their parent link

**What to build:** Mockup A shows Architecture Nodes joined by connector lines (Web app to Quote database; a dashed line from Web app to the Proposal Cache). Today the core drops authored Nodes in a four-per-row grid and the interface draws no line, even though Architecture Nodes already carry an optional `parent`. On the Architecture Layer, a Node whose `parent` exists on that Layer sits below its parent (siblings side by side in one row under it, centred on the parent), roots keep the grid, and a connector line joins parent and child: solid for accepted Nodes, dashed accent for a Proposal. Business and Requirements Layers have no parent, so they stay as they are. The preview that places a Proposal's Node uses the same layout.

**Blocked by:** 12 (done)

**Status:** done

- [~] Through the core protocol: on a Project whose Architecture has a Node with a `parent`, the child's rectangle is below the parent's and horizontally overlapping it; a root keeps its grid place; a `parent` that does not exist leaves the Node as a root.
- [~] The Layer response lets the interface draw the connector (the parent id of each Node is available), covered by a protocol test.
- [~] A Proposal that adds a child Node is placed under its parent in the preview.
- [~] Checked live with a screenshot next to `mockups/A-session-top-bar-switcher.png`: connector lines present, dashed for the Proposal.

## Review notes

- [x] Child below parent and overlapping it; root keeps its place; missing parent is a root; cycles become roots (test/layout-parents.test.ts, through GET /layout).
- [x] The Layer response already carries each Node `parent` (GET /authored, covered in test/authored.test.ts); no core change was needed, the interface now draws from it.
- [x] A Proposal adding a child Node is placed under its parent (test/proposals.test.ts).
- [x] Checked live at 1440x900 next to mockup A: solid connector Web app to Quote database, dashed accent connector to the Proposal; no console errors. Differences: the Proposal in the mockup is a root beside Web app (here the test Proposal had a parent, so it sits in the child row); connector is an elbow, not a straight side line.
- Changed existing expectation: an added root now takes the second grid slot (x 280) because a child no longer occupies a grid slot.

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
