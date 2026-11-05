# 10: The Learner graph starts empty in the first build

**What to build:** The first packaged build starts with no Learner graph. Anything written while developing aidea does not travel. A test fails the build if a graph is shipped.

**Blocked by:** packaging 01.

**Status:** ready-for-agent

- [ ] A fresh install has an empty graph.
- [ ] A test fails if the packaged files contain Learner data.
- [ ] Nothing in the repository's own learner folder is copied.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
