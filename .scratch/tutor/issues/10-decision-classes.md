# 10: Decision classes: Class mode stops the builder at a Blocking decision

**What to build:** In Class mode, when the builder proposes a Blocking decision (a new or changed Node on Business, Requirements or Architecture, a technology choice, or the declaration of a Pattern group) the builder's Proposal is held until the person has answered a decision class: a short class (predict the choice, then the reason, then a check) about that decision. When the person answers, the reason and the rejected alternatives are written to the Node's Rationale through the Proposal and the builder continues. In Direct mode nothing is held. The mode is a per-Project setting shown in the Tutor column. Code changes are never blocking. The person can skip a decision class ("decide for me") and the skip is Evidence.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Through the protocol with scripted builder and Tutor: in Class mode a Blocking decision creates a decision class and the builder's Proposal does not become acceptable until it is answered or skipped; in Direct mode it is acceptable immediately.
- [ ] Code changes and non-blocking changes never start a class.
- [ ] The answer, the reason and the rejected alternatives appear in the Node's Rationale after acceptance.
- [ ] The mode setting is remembered per Project and survives a restart.
- [ ] Verified with a headless browser: the mode switch in the Tutor column and a held Proposal marked as waiting for a class.
