# 02: Write the Instances spec

**What to build:** The person extended ADR 0008: any plugin, not only roles, declares a minimum number of instances and can be started N times: N Builders (each with its provider and, in parallel, its own git branch), N Tutors (a second class without breaking the first; a DeepSeek Tutor beside a Codex one), N Canvases each showing a different layer. Write the spec: what an instance is, the manifest fields (minimum and maximum), sessions per instance, how the Panel registry and the saved Layout name an instance, how parallel Builders are coordinated on branches, and which services stay single.

**Blocked by:** None (can start immediately).

**Status:** needs-info: the person decides the open points

- [ ] The spec answers the points ADR 0008 left open (single-instance services, coordination of parallel Builders).
- [ ] It says how the saved Layout names instances and what happens when a plugin is removed while instances run.
- [ ] The person has read and approved it; the tickets that follow are written from it.

Source: ADR 0008 point 7; `.scratch/plugins/interview.md` 9 and 9b.
