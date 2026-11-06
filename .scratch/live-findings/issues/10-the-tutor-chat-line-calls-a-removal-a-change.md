# 10: The Tutor's chat line calls a removal "a change"

**What to build:** Found in the live pass of 2026-11-06. When the Tutor proposes removing a Node, the line in the Tutor chat reads `From the Tutor: proposal to change "quote-db" on the architecture layer.` while the Proposal card says "remove". Cause (read in the code): `src/ui/features/50-tutor.js` line 235 only knows `add`; every other kind is written as "change". The line must say "remove" for a removal (and keep "add" and "change"). `tpr` (roles-and-contract 12) said "no interface change" and so was never looked at in the page.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The line says "proposal to remove" for a removal, "add" for an addition and "change" for a change.
- [ ] A page test covers the three words.

Source: live pass 2026-11-06, ticket roles-and-contract 12.
