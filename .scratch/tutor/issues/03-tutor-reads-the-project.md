# 03: The Tutor reads the project, only inside its folder

**What to build:** The Tutor roles get read-only tools through the core's Canvas tool server: read the authored layers and a Node with its Rationale, read a code snippet or a file inside the open Project's folder, list the Project's files, and read a Playback recording. They have no shell, no write tool and no way to read outside the Project folder, including through links, relative paths or alternative spellings. The tools return small, structured results.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Through the protocol: each read tool returns the expected content on a fixture project.
- [ ] A path outside the Project (parent traversal, absolute path elsewhere, a link pointing out, a different casing or a drive-relative form on Windows) is refused with a clear message and nothing is read.
- [ ] No tool of the Tutor roles can write, delete, move or execute; the tool list is asserted.
- [ ] Large files are cut with a note of what was left out.
- [ ] The Tutor tools are not available to the builder's session.
