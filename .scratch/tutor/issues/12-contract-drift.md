# 12: Drift: where the built code differs from the Contract, and questions about it

**What to build:** The core compares the Contract with the derived layers and lists differences: a requirement with no linked code or Architecture element, an Architecture relationship that the code does not have, a code dependency the Architecture does not allow (crossing a boundary), a Pattern group violation (ticket 14 when it exists). The list is shown in the Tutor column and marks the affected Nodes on their layers. The Tutor can turn each difference into a question in a class (why did this requirement lose its code? why does this module reach across the boundary?), and the answer is Evidence. A difference is information, never a block, and a requirement that has not been built yet is not drift (it is reported only when the person has marked it as built or when its trace link broke).

**Blocked by:** 05, 11

**Status:** ready-for-agent

- [ ] Through the protocol on fixtures: each kind of difference is detected; a requirement not yet built is not reported as drift; a broken trace link is.
- [ ] The difference list is deterministic and includes Node ids, kind and a plain-words explanation.
- [ ] A drift question started from a difference carries the difference as the class topic and is recorded as Evidence.
- [ ] Verified with a headless browser: screenshot of the drift list and of a marked Node; no console errors.
