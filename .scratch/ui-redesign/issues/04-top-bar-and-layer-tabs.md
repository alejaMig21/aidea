# 04: Top bar with Project switcher and Layer tab bar

**What to build:** With a Project open, a top bar shows the brand and a Project switcher (current Project, recents, "Open folder…" behaving exactly like Home's, and a way back to Home). The Layers become a tab bar in a reserved strip on top of the Canvas: Business, Requirements, Architecture (authored, amber) then Components, Algorithms, Code (derived, teal). The selected Layer is clearly marked and each tab shows how many Proposals wait on that Layer. The tabs never cover a Node.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The switcher lists the current Project and the recents; choosing one switches Project.
- [ ] "Open folder…" in the switcher behaves like the Home button.
- [ ] The person can return to Home from the work session.
- [ ] Layers appear as tabs on top of the Canvas, grouped by colour (authored vs derived), selected one marked.
- [ ] A tab shows the number of pending Proposals on its Layer.
- [ ] The first Node of any Layer is never covered by the tabs.
- [ ] Permission cards and Proposals still work in the new layout.
- [ ] Checked live; result noted in the ticket.

## Review notes

- No core change: the pending Proposals per Layer come from the existing `GET /proposals` (each Proposal carries its `layer`, already counted by `markTabs` in `70-proposals.js`), covered by `test/proposals.test.ts`. The recents list in the switcher is `GET /recents` (`test/recents.test.ts`). Nothing new to automate.
- Added: `src/ui/features/06-topbar.js` (Project switcher: current Project, recents, "Open folder…", Home), top bar and reserved 40px tab strip in `src/ui/index.html`, tab order/colour grouping (authored amber, derived teal) and a disabled "Code" tab in `src/ui/features/20-authored.js`.
- NOT verified live (no running window in this session), so no live criterion is ticked. To check by hand: switcher lists current + recents and switching works; "Open folder…" focuses the path box (Home has no folder button yet; ticket 02 should make both use the same picker); Home reachable from the switcher; tabs in the order Business, Requirements, Architecture, Components, Algorithms, Code with amber/teal grouping and the selected one marked; a Proposal count shows on its tab; the first Node is not under the strip (Canvas has `padding-top: 40px`); permission cards, Proposals and chat still work.
- Known gaps: the "Code" tab is disabled because there is no Code view (source opens in a box when a Node is selected on Components); only authored tabs ever show a count (Proposals exist only on authored Layers).
