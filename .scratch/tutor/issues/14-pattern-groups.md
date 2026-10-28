# 14: Pattern groups on the Architecture layer

**What to build:** On the Architecture layer the person or the builder declares a Pattern group (for example a hexagonal architecture) as a set of Nodes each labelled with its role. aidea compares the group with the derived layers and reports violations (for example a domain module importing infrastructure) as differences in the Contract drift list and as a mark on the group. Declaring a Pattern group is a Blocking decision (ticket 10). The group is drawn on the Architecture layer as a labelled boundary, in the C4-style notation already used.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] Through the protocol: a Pattern group is stored with the Architecture layer with validated roles; a violation fixture (a domain module importing an infrastructure module) is reported with the two Nodes and the rule.
- [ ] A group with no violations reports none; a role pointing to a missing Node is reported as a problem like other bad data.
- [ ] The builder can propose a group through a Proposal.
- [ ] Verified with a headless browser: screenshot of a group with and without a violation.
