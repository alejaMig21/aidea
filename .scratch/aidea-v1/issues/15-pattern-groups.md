# 15: Pattern groups

**What to build:** On the Architecture layer the person or the builder declares a Pattern group, such as a hexagonal architecture, as a set of Nodes each labelled with its role. aidea compares the group with the Derived layers and flags any place where the code violates the pattern, for example a domain module importing infrastructure.

**Blocked by:** 04, 08

**Status:** superseded (see .scratch/tutor/spec.md and .scratch/tutor/issues)

- [ ] A Pattern group with role-labelled Nodes can be declared and appears on the Canvas.
- [ ] A violation in the fixture Project is reported against the group and the offending Nodes.
- [ ] Removing the violation and refreshing clears the report.
