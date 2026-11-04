# 12: "Fix" and "Explain and fix"

**What to build:** In the terminal and in the Code panel, the selection control also offers "Fix" and "Explain and fix". "Fix" hands the selected text to the Builder, which works knowing the cause and the Contract and may depart from the Contract only through a Proposal the person accepts. "Explain and fix" asks the Tutor to explain and the Builder to repair, in one move. In every other Panel these two buttons do not appear. The text travels as data. See `.scratch/run-and-terminal/spec.md` (stories 44, 45 and 49).

**Blocked by:** 11.

**Status:** done, checked live in Electron on the second monitor (2026-11-04)

- [x] The terminal and the Code panel show four buttons; the other Panels show two.
- [x] "Fix" sends the selection to the Builder as data together with the Contract it already respects; the Builder's change still goes through the usual permission cards and Proposals.
- [x] "Explain and fix" produces the Tutor's explanation and the Builder's work from the same selection.
- [x] The same limit, secret check (ticket 13) and data-only rule apply as for "Explain".
- [x] Core API tests with a fake Builder and page tests pass (test/fix-selection.test.ts, test/fix-buttons-page.test.ts).
- [x] Verified live on the second monitor. (live: four buttons in the terminal, two elsewhere; Fix and Explain and fix not pressed (they call the real Builder and Tutor))
