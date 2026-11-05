# 01: The release-numbers plugin (v1.0.0)

**What to build:** A plugin that keeps the version number of a Project so the person does not have to understand it. It reads the git tags and the commits since the last one, counts fixes, features and breaking changes (conventional commits), proposes the next number (a fix raises the last digit, a feature the middle one, a breaking change the first), and says why in plain words. The person accepts or not; on acceptance it creates the git tag, which is a write to the Project and goes through the policies. It is not the git history plugin. It ships a lesson on what v1.2.3 means (the person never understood it) and a teaching surface.

**Blocked by:** plugin-lessons 01, plugin-teaching 01.

**Status:** ready-for-agent

- [ ] With no tags the plugin explains where numbering starts and proposes a first number (0.1.0 unless the person says it is stable), with the reason.
- [ ] From a fixture history it proposes the right next number and lists the commits behind it.
- [ ] Accepting creates the tag; rejecting changes nothing; the plugin never tags by itself.
- [ ] The plugin ships a lesson and a teaching surface and passes the scan.
- [ ] A history with no conventional commits gets a plain message, not a guess.

Source: The person's idea of 2026-11-04.
